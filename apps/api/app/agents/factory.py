"""
Agent Factory - Creates and manages AI agent instances.

Agents are loaded from the database (gallery_agents table) with
fallback to hardcoded defaults for development/offline mode.

This factory supports both:
- New DoozaAgent system (with tools) for agents like Seomi
- Legacy simple agents (without tools) for backwards compatibility

Production-ready with:
- Thread-safe caching
- TTL-based cache invalidation
- Graceful fallback on DB failures
"""

from __future__ import annotations
import logging
import threading
import time
from typing import Any, Dict, FrozenSet, List, Optional, Set, Union

from app.agents.base import DoozaAgent, create_base_agent, get_agent_prompt
from app.agents.config import AgentConfig
from app.core.database import get_checkpointer, get_supabase_client

logger = logging.getLogger(__name__)

# Thread-safe cache
_agent_cache: Dict[str, Any] = {}
_cache_timestamp: float = 0
_cache_lock = threading.Lock()
CACHE_TTL = 300  # 5 minutes

# Fallback agent slugs (for backwards compatibility and offline mode)
# Using frozenset for immutability
FALLBACK_AGENTS: FrozenSet[str] = frozenset({"pam", "penn", "seomi", "cassie", "dexter", "soshie"})

# Agents that use the new DoozaAgent system with tools
TOOL_ENABLED_AGENTS: FrozenSet[str] = frozenset({"seomi"})


def _refresh_cache_if_needed() -> None:
    """
    Refresh agent cache from DB if stale.
    
    Thread-safe with proper locking.
    """
    global _agent_cache, _cache_timestamp
    
    # Quick check without lock
    if time.time() - _cache_timestamp < CACHE_TTL and _agent_cache:
        return
    
    supabase = get_supabase_client()
    if not supabase:
        return
    
    with _cache_lock:
        # Double-check after acquiring lock
        if time.time() - _cache_timestamp < CACHE_TTL and _agent_cache:
            return
        
        try:
            # Query only columns that exist - skip missing columns gracefully
            result = supabase.table("gallery_agents").select(
                "id, slug, name, role, description, system_prompt, "
                "avatar_url, gradient, tier, is_published, is_featured"
            ).eq("is_published", True).execute()
            
            new_cache = {}
            for agent in result.data:
                # Add default values for potentially missing columns
                agent.setdefault("tool_categories", [])
                agent.setdefault("allowed_integrations", [])
                agent.setdefault("can_delegate_to", [])
                new_cache[agent["slug"]] = agent
            
            _agent_cache = new_cache
            _cache_timestamp = time.time()
            logger.debug(f"Refreshed agent cache with {len(_agent_cache)} agents")
            
        except Exception as e:
            logger.warning(f"Failed to refresh agent cache: {e}")


def get_agent_config(agent_slug: str) -> Optional[Dict[str, Any]]:
    """
    Get agent configuration by slug.
    
    Thread-safe retrieval with caching.
    
    Args:
        agent_slug: The agent's unique identifier
        
    Returns:
        Dict with agent data or None if not found
    """
    # Refresh cache if needed
    _refresh_cache_if_needed()
    
    # Check cache (thread-safe read)
    with _cache_lock:
        if agent_slug in _agent_cache:
            return _agent_cache[agent_slug].copy()  # Return copy to prevent mutation
    
    # Try DB directly if not in cache
    supabase = get_supabase_client()
    if supabase:
        try:
            result = supabase.table("gallery_agents").select(
                "id, slug, name, role, description, system_prompt, "
                "avatar_url, gradient, tier, is_published, is_featured"
            ).eq("slug", agent_slug).eq("is_published", True).execute()
            
            if result.data:
                config = result.data[0]
                # Add default values for potentially missing columns
                config.setdefault("tool_categories", [])
                config.setdefault("allowed_integrations", [])
                config.setdefault("can_delegate_to", [])
                
                # Cache it (thread-safe write)
                with _cache_lock:
                    _agent_cache[agent_slug] = config
                return config.copy()
        except Exception as e:
            logger.warning(f"Failed to fetch agent from DB: {e}")
    
    # Fallback to hardcoded configs for development
    if agent_slug in FALLBACK_AGENTS:
        return _get_fallback_config(agent_slug)
    
    return None


def _get_fallback_config(agent_slug: str) -> Dict[str, Any]:
    """Get fallback config for development/offline mode."""
    # For Seomi, use the full config from seomi.py
    if agent_slug == "seomi":
        from app.agents.seomi import SEOMI_CONFIG
        return {
            "id": None,
            "slug": SEOMI_CONFIG.slug,
            "name": SEOMI_CONFIG.name,
            "role": SEOMI_CONFIG.role,
            "description": SEOMI_CONFIG.description,
            "system_prompt": SEOMI_CONFIG.system_prompt,
            "tool_categories": SEOMI_CONFIG.tool_categories,
            "allowed_integrations": SEOMI_CONFIG.allowed_integrations,
            "can_delegate_to": SEOMI_CONFIG.can_delegate_to,
            "avatar_url": SEOMI_CONFIG.avatar_url,
            "gradient": SEOMI_CONFIG.gradient,
            "tier": SEOMI_CONFIG.min_tier,
            "is_published": SEOMI_CONFIG.is_published,
            "is_featured": SEOMI_CONFIG.is_featured,
        }
    
    # For other agents, use legacy prompts
    return {
        "id": None,
        "slug": agent_slug,
        "name": agent_slug.capitalize(),
        "role": "AI Assistant",
        "description": "",
        "system_prompt": get_agent_prompt(agent_slug),
        "tool_categories": [],
        "allowed_integrations": [],
        "can_delegate_to": [],
        "avatar_url": None,
        "gradient": None,
        "tier": "free",
        "is_published": True,
        "is_featured": False,
    }


def is_valid_agent(agent_slug: str) -> bool:
    """Check if agent_slug is valid (exists in DB or fallback)."""
    return get_agent_config(agent_slug) is not None


def create_dooza_agent(
    agent_slug: str,
    user_id: str,
) -> DoozaAgent:
    """
    Create a DoozaAgent instance with tools.
    
    This is the new way to create agents that support:
    - Tool execution
    - SSE event streaming
    - Delegation
    
    Args:
        agent_slug: The agent identifier (e.g., 'seomi')
        user_id: The user ID for context loading
        
    Returns:
        Configured DoozaAgent instance
        
    Raises:
        ValueError: If agent_slug is not valid
    """
    from app.tools.registry import get_tool_registry
    from app.context.types import AgentContext
    
    # Get agent config
    config_dict = get_agent_config(agent_slug)
    if not config_dict:
        raise ValueError(f"Invalid agent_slug: {agent_slug}")
    
    # Build AgentConfig from dict
    config = AgentConfig.from_db_row(config_dict)
    
    # Create context (simplified for now - full loader used in chat endpoint)
    context = AgentContext.default(user_id)
    
    # Get tool registry
    tool_registry = get_tool_registry()
    
    # Get checkpointer
    checkpointer = get_checkpointer()
    
    return DoozaAgent(
        config=config,
        tool_registry=tool_registry,
        context=context,
        checkpointer=checkpointer,
    )


def get_agent_by_slug(
    agent_slug: str, 
    system_prompt: Optional[str] = None
) -> Union[DoozaAgent, Any]:
    """
    Get or create an agent instance by slug.
    
    For tool-enabled agents (like Seomi), returns a DoozaAgent.
    For other agents, returns a legacy compiled graph.
    
    Args:
        agent_slug: The agent identifier (e.g., 'pam', 'seomi')
        system_prompt: Optional override for system prompt
    
    Returns:
        Agent instance (DoozaAgent or legacy graph)
    
    Raises:
        ValueError: If agent_slug is not valid
    """
    # Get config if system_prompt not provided
    config = get_agent_config(agent_slug)
    if not config:
        raise ValueError(f"Invalid agent_slug: {agent_slug}")
    
    if system_prompt is None:
        system_prompt = config["system_prompt"]
    
    # For tool-enabled agents, we can't return DoozaAgent here
    # because we don't have user context. This function is kept
    # for backwards compatibility - use create_dooza_agent for new code.
    
    checkpointer = get_checkpointer()
    return create_base_agent(system_prompt, checkpointer=checkpointer)


# Legacy function for backwards compatibility
def get_agent(agent_id: str):
    """
    Legacy function - use get_agent_by_slug or create_dooza_agent instead.
    
    Kept for backwards compatibility during migration.
    """
    return get_agent_by_slug(agent_id)


def get_all_agent_slugs() -> List[str]:
    """
    Get list of all valid agent slugs.
    
    Thread-safe.
    """
    _refresh_cache_if_needed()
    
    with _cache_lock:
        if _agent_cache:
            return list(_agent_cache.keys())
    
    return list(FALLBACK_AGENTS)


def get_tool_enabled_agents() -> FrozenSet[str]:
    """
    Get set of agent slugs that use the new tool system.
    
    Returns immutable frozenset.
    """
    return TOOL_ENABLED_AGENTS


def is_tool_enabled(agent_slug: str) -> bool:
    """Check if an agent uses the new tool-enabled system."""
    return agent_slug in TOOL_ENABLED_AGENTS


def clear_agent_cache() -> None:
    """
    Clear the agent cache.
    
    Thread-safe. Useful for testing or after DB updates.
    """
    global _agent_cache, _cache_timestamp
    with _cache_lock:
        _agent_cache = {}
        _cache_timestamp = 0
