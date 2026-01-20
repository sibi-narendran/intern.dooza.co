"""
Agent Factory

Creates and manages AI agent instances with:
- Registry-based supervisor lookup (no hardcoded if/else)
- Legacy simple agents (no tools)
- Thread-safe caching
- Graceful fallback on DB failures

Note: Supervisor agents are now managed via AgentRegistry.
This factory delegates to the registry for supervisor creation.
"""

from __future__ import annotations
import logging
import threading
import time
from typing import Any, Dict, FrozenSet, List, Optional

from app.core.database import get_checkpointer, get_supabase_client
from app.agents.registry import get_agent_registry, AGENT_REGISTRATIONS

logger = logging.getLogger(__name__)

# Thread-safe cache for legacy agents only
# Supervisor caching is handled by AgentRegistry
_agent_cache: Dict[str, Any] = {}
_cache_timestamp: float = 0
_cache_lock = threading.Lock()
CACHE_TTL = 300  # 5 minutes

# Agent types - derived from registry for supervisors
FALLBACK_AGENTS: FrozenSet[str] = frozenset({"pam", "penn", "seomi", "cassie", "dexter", "soshie"})

def _get_supervisor_slugs() -> FrozenSet[str]:
    """Get supervisor slugs from registry."""
    return frozenset(AGENT_REGISTRATIONS.keys())

SUPERVISOR_AGENTS: FrozenSet[str] = _get_supervisor_slugs()


# =============================================================================
# SUPERVISOR FACTORY
# =============================================================================

def get_supervisor_app(agent_slug: str, checkpointer=None):
    """
    Get a compiled supervisor app for agent_slug.
    
    Delegates to AgentRegistry for lazy loading and caching.
    
    Args:
        agent_slug: The agent identifier (e.g., 'seomi')
        checkpointer: Optional checkpointer for memory persistence
        
    Returns:
        Compiled LangGraph supervisor workflow
        
    Raises:
        ValueError: If agent_slug is not a supervisor agent
    """
    registry = get_agent_registry()
    
    if not registry.is_supervisor(agent_slug):
        available = registry.list_supervisors()
        raise ValueError(
            f"'{agent_slug}' is not a supervisor agent. "
            f"Available supervisors: {available}"
        )
    
    # Registry handles caching and lazy loading
    return registry.get_agent(agent_slug, checkpointer=checkpointer)


def is_supervisor_agent(agent_slug: str) -> bool:
    """Check if an agent uses the supervisor pattern."""
    registry = get_agent_registry()
    return registry.is_supervisor(agent_slug)


# =============================================================================
# LEGACY AGENT FACTORY
# =============================================================================

def get_legacy_agent(agent_slug: str, system_prompt: Optional[str] = None):
    """
    Get a legacy simple agent (no tools).
    
    For backwards compatibility with pam, penn, etc.
    """
    from app.agents.base import create_base_agent, get_agent_prompt
    
    if system_prompt is None:
        system_prompt = get_agent_prompt(agent_slug)
    
    checkpointer = get_checkpointer()
    return create_base_agent(system_prompt, checkpointer=checkpointer)


# =============================================================================
# UNIFIED FACTORY
# =============================================================================

def get_agent(agent_slug: str, checkpointer=None):
    """Get an agent by slug (auto-detects supervisor vs legacy)."""
    if is_supervisor_agent(agent_slug):
        return get_supervisor_app(agent_slug, checkpointer)
    else:
        return get_legacy_agent(agent_slug)


# =============================================================================
# CONFIG LOADING
# =============================================================================

def _refresh_cache_if_needed() -> None:
    """Refresh agent cache from DB if stale."""
    global _agent_cache, _cache_timestamp
    
    if time.time() - _cache_timestamp < CACHE_TTL and _agent_cache:
        return
    
    supabase = get_supabase_client()
    if not supabase:
        return
    
    with _cache_lock:
        if time.time() - _cache_timestamp < CACHE_TTL and _agent_cache:
            return
        
        try:
            result = supabase.table("gallery_agents").select(
                "id, slug, name, role, description, system_prompt, "
                "avatar_url, gradient, tier, is_published, is_featured"
            ).eq("is_published", True).execute()
            
            _agent_cache = {agent["slug"]: agent for agent in result.data}
            _cache_timestamp = time.time()
            logger.debug(f"Refreshed agent cache with {len(_agent_cache)} agents")
            
        except Exception as e:
            logger.warning(f"Failed to refresh agent cache: {e}")


def get_agent_config(agent_slug: str) -> Optional[Dict[str, Any]]:
    """Get agent configuration by slug."""
    registry = get_agent_registry()
    
    if registry.is_supervisor(agent_slug):
        return _get_supervisor_config(agent_slug)
    
    _refresh_cache_if_needed()
    
    with _cache_lock:
        if agent_slug in _agent_cache:
            return _agent_cache[agent_slug].copy()
    
    if agent_slug in FALLBACK_AGENTS:
        return _get_fallback_config(agent_slug)
    
    return None


def _get_supervisor_config(agent_slug: str) -> Dict[str, Any]:
    """Get config for supervisor agents from registry."""
    registry = get_agent_registry()
    registration = registry.get_registration(agent_slug)
    
    if registration is None:
        return {
            "id": None,
            "slug": agent_slug,
            "name": agent_slug.capitalize(),
            "is_supervisor": True,
        }
    
    # Try to get detailed config from the agent module
    if agent_slug == "seomi":
        from app.agents.seomi import SEOMI_CONFIG
        return {
            "id": None,
            "slug": SEOMI_CONFIG["slug"],
            "name": SEOMI_CONFIG["name"],
            "description": SEOMI_CONFIG["description"],
            "system_prompt": "",
            "is_supervisor": True,
        }
    
    # Generic config from registration
    return {
        "id": None,
        "slug": registration.slug,
        "name": registration.slug.capitalize(),
        "description": registration.description,
        "is_supervisor": True,
    }


def _get_fallback_config(agent_slug: str) -> Dict[str, Any]:
    """Get fallback config for legacy agents."""
    from app.agents.base import get_agent_prompt
    
    return {
        "id": None,
        "slug": agent_slug,
        "name": agent_slug.capitalize(),
        "role": "AI Assistant",
        "description": "",
        "system_prompt": get_agent_prompt(agent_slug),
        "is_supervisor": False,
    }


def is_valid_agent(agent_slug: str) -> bool:
    """Check if agent_slug is valid."""
    return get_agent_config(agent_slug) is not None


def get_all_agent_slugs() -> List[str]:
    """Get list of all valid agent slugs."""
    _refresh_cache_if_needed()
    
    with _cache_lock:
        if _agent_cache:
            return list(_agent_cache.keys())
    
    return list(FALLBACK_AGENTS)


def clear_agent_cache() -> None:
    """Clear all caches (legacy + registry)."""
    global _agent_cache, _cache_timestamp
    
    # Clear legacy cache
    with _cache_lock:
        _agent_cache = {}
        _cache_timestamp = 0
    
    # Clear supervisor cache via registry
    registry = get_agent_registry()
    registry.clear_cache()
