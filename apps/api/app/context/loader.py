"""
Context Loader

Loads context for agent requests from the database.
Fetches user profile, organization info, and available integrations.

Production-ready with:
- Thread-safe singleton
- Request-scoped caching
- Graceful fallback on errors
"""

from __future__ import annotations
import asyncio
import logging
import threading
from typing import Any, Dict, List, Optional

from app.context.types import AgentContext
from app.core.database import get_supabase_client

logger = logging.getLogger(__name__)

# Thread-safe singleton
_loader_instance: Optional["ContextLoader"] = None
_loader_lock = threading.Lock()


class ContextLoader:
    """
    Loads agent context from the database.
    
    Fetches:
    - User profile (name, email, tier)
    - Organization info (if user belongs to one)
    - Available integrations (Composio connections)
    
    Note: Cache is request-scoped and cleared after each request.
    For long-running processes, use use_cache=False or clear_cache().
    """
    
    def __init__(self):
        # Thread-safe cache with lock
        self._cache: Dict[str, AgentContext] = {}
        self._cache_lock = threading.Lock()
    
    async def load(self, user_id: str, use_cache: bool = True) -> AgentContext:
        """
        Load full context for a user.
        
        Args:
            user_id: The user's ID
            use_cache: Whether to use cached context if available
            
        Returns:
            AgentContext with all user/org information
        """
        # Check cache first (thread-safe)
        if use_cache:
            with self._cache_lock:
                if user_id in self._cache:
                    return self._cache[user_id]
        
        supabase = get_supabase_client()
        
        if not supabase:
            # Fallback for development without DB
            logger.warning("No database connection, using default context")
            return AgentContext.default(user_id)
        
        try:
            # Fetch user profile (supabase-py is sync, run in thread pool)
            profile = await self._fetch_profile(user_id, supabase)
            
            # Fetch organization if user has one
            org = None
            if profile.get("org_id"):
                org = await self._fetch_organization(profile["org_id"], supabase)
            
            # Fetch integrations
            integrations = await self._fetch_integrations(
                user_id, 
                profile.get("org_id"),
                supabase
            )
            
            context = AgentContext(
                user_id=user_id,
                user_name=self._format_name(profile),
                user_email=profile.get("email", ""),
                user_tier=profile.get("tier", "free"),
                org_id=str(profile["org_id"]) if profile.get("org_id") else None,
                org_name=org.get("name") if org else None,
                integrations=integrations,
                is_org_admin=profile.get("role") == "admin",
            )
            
            # Cache the context (thread-safe)
            with self._cache_lock:
                self._cache[user_id] = context
            
            return context
            
        except Exception as e:
            logger.error(f"Failed to load context for user {user_id}: {e}")
            # Return default context on error
            return AgentContext.default(user_id)
    
    async def _fetch_profile(self, user_id: str, supabase: Any) -> Dict:
        """Fetch user profile from database."""
        try:
            # Run sync supabase call in thread pool
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: supabase.table("profiles").select(
                    "id, first_name, last_name, email, org_id, role, tier"
                ).eq("id", user_id).execute()
            )
            
            if result.data:
                return result.data[0]
            
            return {"id": user_id, "tier": "free"}
            
        except Exception as e:
            logger.warning(f"Failed to fetch profile: {e}")
            return {"id": user_id, "tier": "free"}
    
    async def _fetch_organization(self, org_id: str, supabase: Any) -> Optional[Dict]:
        """Fetch organization info from database."""
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: supabase.table("organizations").select(
                    "id, name, slug, settings"
                ).eq("id", org_id).execute()
            )
            
            if result.data:
                return result.data[0]
            return None
            
        except Exception as e:
            logger.warning(f"Failed to fetch organization: {e}")
            return None
    
    async def _fetch_integrations(
        self, 
        user_id: str, 
        org_id: Optional[str],
        supabase: Any
    ) -> List[str]:
        """
        Fetch available integrations for user.
        
        Gets both:
        - Personal integrations (user's own OAuth connections)
        - Organization integrations (shared by org)
        """
        integrations: set = set()
        loop = asyncio.get_event_loop()
        
        try:
            # Fetch user's personal integrations
            user_result = await loop.run_in_executor(
                None,
                lambda: supabase.table("integrations").select(
                    "app_key"
                ).eq("user_id", user_id).eq("status", "active").execute()
            )
            
            for row in user_result.data or []:
                integrations.add(row["app_key"])
            
            # Fetch organization integrations
            if org_id:
                org_result = await loop.run_in_executor(
                    None,
                    lambda oid=org_id: supabase.table("integrations").select(
                        "app_key"
                    ).eq("org_id", oid).eq("scope", "org").eq("status", "active").execute()
                )
                
                for row in org_result.data or []:
                    integrations.add(row["app_key"])
            
        except Exception as e:
            logger.warning(f"Failed to fetch integrations: {e}")
        
        return list(integrations)
    
    def _format_name(self, profile: Dict) -> str:
        """Format user's display name from profile."""
        first = profile.get("first_name", "")
        last = profile.get("last_name", "")
        
        if first and last:
            return f"{first} {last}"
        elif first:
            return first
        elif last:
            return last
        else:
            return "User"
    
    def clear_cache(self, user_id: Optional[str] = None) -> None:
        """
        Clear cached context.
        
        Args:
            user_id: Specific user to clear, or None to clear all
        """
        with self._cache_lock:
            if user_id:
                self._cache.pop(user_id, None)
            else:
                self._cache.clear()


def get_context_loader() -> ContextLoader:
    """
    Get the singleton context loader instance.
    
    Thread-safe implementation using double-checked locking.
    
    Returns:
        The global ContextLoader instance
    """
    global _loader_instance
    
    if _loader_instance is None:
        with _loader_lock:
            # Double-check after acquiring lock
            if _loader_instance is None:
                _loader_instance = ContextLoader()
    
    return _loader_instance


async def load_context(user_id: str) -> AgentContext:
    """
    Convenience function to load context for a user.
    
    Args:
        user_id: The user's ID
        
    Returns:
        AgentContext with user/org information
    """
    loader = get_context_loader()
    return await loader.load(user_id)
