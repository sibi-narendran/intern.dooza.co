"""
Connection Service

Manages user's social media connections for agents and the publish pipeline.

ARCHITECTURE:
- Reads from LOCAL DATABASE (user_integrations table) for fast access
- Falls back to Composio API if local DB is empty (migration support)
- Used by all agents (Seomi, Soshie, social_publisher, etc.)

This provides a centralized source of truth for all agents.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)


# =============================================================================
# TYPES
# =============================================================================

@dataclass
class SocialConnection:
    """Represents a user's connection to a social platform."""
    platform: str
    connection_id: str
    account_name: Optional[str] = None
    account_id: Optional[str] = None
    status: str = "active"


# =============================================================================
# CONSTANTS
# =============================================================================

# Supported social platforms for publishing
SOCIAL_PLATFORMS = [
    "instagram",
    "facebook", 
    "linkedin",
    "tiktok",
    "youtube",
]


# =============================================================================
# CONNECTION SERVICE
# =============================================================================

class ConnectionService:
    """
    Centralized connection service for all agents.
    
    Reads from LOCAL DATABASE first, with Composio fallback for migration.
    
    Used by:
    - Soshie (social media agent)
    - Seomi (SEO agent - for future integrations)
    - social_publisher (publishing specialist)
    - Any agent that needs to check user's connected platforms
    """
    
    def __init__(self):
        self._composio_client = None
    
    def _get_composio_client(self):
        """Get or create Composio client instance (for migration fallback)."""
        if self._composio_client is not None:
            return self._composio_client
        
        settings = get_settings()
        
        if not settings.composio_api_key:
            logger.warning("COMPOSIO_API_KEY not set - Composio fallback disabled")
            return None
        
        try:
            from composio import Composio
            self._composio_client = Composio(api_key=settings.composio_api_key)
            return self._composio_client
        except ImportError:
            logger.error("composio-core not installed")
            return None
        except Exception as e:
            logger.error(f"Failed to init Composio client: {e}")
            return None
    
    def _get_entity_id(self, user_id: str) -> str:
        """Generate Composio entity ID for user."""
        return f"user_{user_id}"
    
    async def _get_from_local_db(self, user_id: str) -> list[SocialConnection]:
        """Get connections from local user_integrations table."""
        try:
            from app.services.integration_repository import get_integration_repository
            
            repo = get_integration_repository()
            stored_conns = await repo.get_user_connections(user_id)
            
            return [
                SocialConnection(
                    platform=c.integration_slug,
                    connection_id=c.composio_connection_id,
                    account_name=c.account_name,
                    account_id=c.account_id,
                    status=c.status,
                )
                for c in stored_conns
            ]
        except Exception as e:
            logger.error(f"Failed to read from local DB: {e}")
            return []
    
    async def _get_from_composio(self, user_id: str) -> list[SocialConnection]:
        """Get connections directly from Composio API (fallback)."""
        client = self._get_composio_client()
        
        if not client:
            return []
        
        try:
            entity_id = self._get_entity_id(user_id)
            entity = client.get_entity(id=entity_id)
            connections = entity.get_connections()
            
            result = []
            for conn in connections:
                app_key = (
                    getattr(conn, 'appUniqueId', None) or 
                    getattr(conn, 'app_unique_key', None) or 
                    getattr(conn, 'appId', None) or 
                    'unknown'
                ).lower()
                
                if app_key in SOCIAL_PLATFORMS:
                    result.append(SocialConnection(
                        platform=app_key,
                        connection_id=conn.id,
                        account_name=getattr(conn, 'account_display', None),
                        account_id=getattr(conn, 'accountId', None),
                        status=conn.status,
                    ))
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to fetch from Composio: {e}")
            return []
    
    async def _sync_composio_to_local(self, user_id: str, composio_conns: list[SocialConnection]) -> None:
        """Sync Composio connections to local database (migration)."""
        try:
            from app.services.integration_repository import get_integration_repository
            
            repo = get_integration_repository()
            
            for conn in composio_conns:
                if conn.status.lower() == "active":
                    await repo.save_connection(
                        user_id=user_id,
                        platform=conn.platform,
                        composio_connection_id=conn.connection_id,
                        account_name=conn.account_name,
                        account_id=conn.account_id,
                    )
            
            logger.info(f"Migrated {len(composio_conns)} connections to local DB for user {user_id}")
        except Exception as e:
            logger.error(f"Failed to sync to local DB: {e}")
    
    async def get_user_connections(self, user_id: str) -> list[SocialConnection]:
        """
        Get all connected social platforms for a user.
        
        Reads from LOCAL DATABASE first. Falls back to Composio if empty
        (for migration of existing users).
        
        Args:
            user_id: The user's ID
            
        Returns:
            List of SocialConnection objects for connected platforms
        """
        # Step 1: Try local database first (fast)
        connections = await self._get_from_local_db(user_id)
        
        if connections:
            logger.debug(f"Found {len(connections)} connections in local DB for user {user_id}")
            return connections
        
        # Step 2: Fallback to Composio (migration support)
        logger.info(f"No local connections for user {user_id}, checking Composio...")
        composio_conns = await self._get_from_composio(user_id)
        
        if composio_conns:
            # Sync to local database for future fast access
            await self._sync_composio_to_local(user_id, composio_conns)
            return composio_conns
        
        return []
    
    async def get_connection_for_platform(
        self, 
        user_id: str, 
        platform: str
    ) -> Optional[str]:
        """
        Get connection_id for a specific platform.
        
        Args:
            user_id: The user's ID
            platform: Platform name (instagram, facebook, etc.)
            
        Returns:
            Connection ID if connected, None otherwise
        """
        platform = platform.lower()
        
        if platform not in SOCIAL_PLATFORMS:
            logger.warning(f"Unknown platform: {platform}")
            return None
        
        connections = await self.get_user_connections(user_id)
        
        for conn in connections:
            if conn.platform == platform and conn.status.lower() == "active":
                return conn.connection_id
        
        return None
    
    async def verify_connections(
        self, 
        user_id: str, 
        platforms: list[str]
    ) -> dict[str, Optional[str]]:
        """
        Check which platforms are connected and return their connection_ids.
        
        Used before publishing to ensure all required platforms are connected.
        
        Args:
            user_id: The user's ID
            platforms: List of platforms to verify
            
        Returns:
            Dict mapping platform name to connection_id (or None)
        """
        connections = await self.get_user_connections(user_id)
        
        # Build lookup dict
        connection_map = {
            conn.platform: conn.connection_id 
            for conn in connections 
            if conn.status.lower() == "active"
        }
        
        # Return requested platforms with their connection_ids
        result = {}
        for platform in platforms:
            platform = platform.lower()
            result[platform] = connection_map.get(platform)
        
        # Log warnings for missing connections
        missing = [p for p, c in result.items() if c is None]
        if missing:
            logger.warning(
                f"User {user_id} missing connections for: {', '.join(missing)}"
            )
        
        return result
    
    async def get_connected_platforms(self, user_id: str) -> list[str]:
        """
        Get list of platform names that user has connected.
        
        Useful for agents to know which platforms are available.
        
        Args:
            user_id: The user's ID
            
        Returns:
            List of connected platform names
        """
        connections = await self.get_user_connections(user_id)
        return [
            conn.platform 
            for conn in connections 
            if conn.status.lower() == "active"
        ]
    
    async def check_connection_health(
        self, 
        user_id: str, 
        platform: str
    ) -> dict:
        """
        Check if a connection is healthy and can be used for publishing.
        
        Args:
            user_id: The user's ID
            platform: Platform to check
            
        Returns:
            Dict with 'healthy' bool and 'error' message if unhealthy
        """
        connection_id = await self.get_connection_for_platform(user_id, platform)
        
        if not connection_id:
            return {
                "healthy": False,
                "error": f"No active connection for {platform}. Please connect your account."
            }
        
        return {
            "healthy": True,
            "connection_id": connection_id
        }


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_connection_service: Optional[ConnectionService] = None


def get_connection_service() -> ConnectionService:
    """Get or create the connection service singleton."""
    global _connection_service
    if _connection_service is None:
        _connection_service = ConnectionService()
    return _connection_service
