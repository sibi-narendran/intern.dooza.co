"""
Agent Factory - Creates and manages AI agent instances.

Agents are loaded from the database (gallery_agents table) with
fallback to hardcoded defaults for development/offline mode.
"""

import logging
from typing import Optional
from functools import lru_cache
import time

from app.agents.base import create_base_agent, get_agent_prompt
from app.core.database import get_checkpointer, get_supabase_client

logger = logging.getLogger(__name__)

# In-memory cache for agent configs
_agent_cache: dict = {}
_cache_timestamp: float = 0
CACHE_TTL = 300  # 5 minutes

# Fallback agent slugs (for backwards compatibility and offline mode)
FALLBACK_AGENTS = {"pam", "penn", "seomi", "cassie", "dexter", "soshie"}


def _refresh_cache_if_needed():
    """Refresh agent cache from DB if stale."""
    global _agent_cache, _cache_timestamp
    
    if time.time() - _cache_timestamp < CACHE_TTL and _agent_cache:
        return
    
    supabase = get_supabase_client()
    if not supabase:
        return
    
    try:
        result = supabase.table("gallery_agents").select(
            "id, slug, name, system_prompt"
        ).eq("is_published", True).execute()
        
        _agent_cache = {
            agent["slug"]: {
                "id": agent["id"],
                "slug": agent["slug"],
                "name": agent["name"],
                "system_prompt": agent["system_prompt"]
            }
            for agent in result.data
        }
        _cache_timestamp = time.time()
        logger.debug(f"Refreshed agent cache with {len(_agent_cache)} agents")
        
    except Exception as e:
        logger.warning(f"Failed to refresh agent cache: {e}")


def get_agent_config(agent_slug: str) -> Optional[dict]:
    """
    Get agent configuration by slug.
    
    Returns dict with id, slug, name, system_prompt.
    Returns None if agent not found.
    """
    # Try cache first
    _refresh_cache_if_needed()
    
    if agent_slug in _agent_cache:
        return _agent_cache[agent_slug]
    
    # Try DB directly if not in cache
    supabase = get_supabase_client()
    if supabase:
        try:
            result = supabase.table("gallery_agents").select(
                "id, slug, name, system_prompt"
            ).eq("slug", agent_slug).eq("is_published", True).execute()
            
            if result.data:
                config = {
                    "id": result.data[0]["id"],
                    "slug": result.data[0]["slug"],
                    "name": result.data[0]["name"],
                    "system_prompt": result.data[0]["system_prompt"]
                }
                _agent_cache[agent_slug] = config
                return config
        except Exception as e:
            logger.warning(f"Failed to fetch agent from DB: {e}")
    
    # Fallback to hardcoded prompts for development
    if agent_slug in FALLBACK_AGENTS:
        return {
            "id": None,  # No DB ID in fallback mode
            "slug": agent_slug,
            "name": agent_slug.capitalize(),
            "system_prompt": get_agent_prompt(agent_slug)
        }
    
    return None


def is_valid_agent(agent_slug: str) -> bool:
    """Check if agent_slug is valid (exists in DB or fallback)."""
    return get_agent_config(agent_slug) is not None


def get_agent_by_slug(agent_slug: str, system_prompt: Optional[str] = None):
    """
    Get or create an agent instance by slug.
    
    Args:
        agent_slug: The agent identifier (e.g., 'pam', 'seomi')
        system_prompt: Optional override for system prompt (from DB)
    
    Returns:
        Compiled LangGraph agent.
    
    Raises:
        ValueError: If agent_slug is not valid.
    """
    # Get config if system_prompt not provided
    if system_prompt is None:
        config = get_agent_config(agent_slug)
        if not config:
            raise ValueError(f"Invalid agent_slug: {agent_slug}")
        system_prompt = config["system_prompt"]
    
    checkpointer = get_checkpointer()  # May be None if DB not connected
    return create_base_agent(system_prompt, checkpointer=checkpointer)


# Legacy function for backwards compatibility
def get_agent(agent_id: str):
    """
    Legacy function - use get_agent_by_slug instead.
    
    Kept for backwards compatibility during migration.
    """
    return get_agent_by_slug(agent_id)


def get_all_agent_slugs() -> list[str]:
    """Get list of all valid agent slugs."""
    _refresh_cache_if_needed()
    
    if _agent_cache:
        return list(_agent_cache.keys())
    
    return list(FALLBACK_AGENTS)


def clear_agent_cache():
    """Clear the agent cache (useful for testing or after DB updates)."""
    global _agent_cache, _cache_timestamp
    _agent_cache = {}
    _cache_timestamp = 0
