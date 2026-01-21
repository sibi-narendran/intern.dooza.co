"""
Connection Service

Manages user's Composio connections for social media platforms.
Provides connection verification and retrieval for the publish pipeline.

This service bridges the gap between user-level OAuth connections
(managed via Composio) and the publishing workflow.
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

# Composio app keys mapped to our platform names
PLATFORM_TO_COMPOSIO_APP = {
    "instagram": "instagram",
    "facebook": "facebook",
    "linkedin": "linkedin",
    "tiktok": "tiktok",
    "youtube": "youtube",
}


# =============================================================================
# CONNECTION SERVICE
# =============================================================================

class ConnectionService:
    """
    Manages user's Composio connections for social platforms.
    
    Used by the publish pipeline to:
    1. Verify which platforms a user has connected
    2. Get connection_ids for publishing
    3. Check connection health before publishing
    """
    
    def __init__(self):
        self._client = None
    
    def _get_composio_client(self):
        """Get or create Composio client instance."""
        if self._client is not None:
            return self._client
        
        settings = get_settings()
        
        if not settings.composio_api_key:
            logger.warning("COMPOSIO_API_KEY not set - connection service disabled")
            return None
        
        try:
            from composio import Composio
            self._client = Composio(api_key=settings.composio_api_key)
            logger.info("Composio client initialized for ConnectionService")
            return self._client
        except ImportError:
            logger.error("composio-core not installed")
            return None
        except Exception as e:
            logger.error(f"Failed to init Composio client: {e}")
            return None
    
    def _get_entity_id(self, user_id: str) -> str:
        """Generate Composio entity ID for user."""
        return f"user_{user_id}"
    
    async def get_user_connections(self, user_id: str) -> list[SocialConnection]:
        """
        List all connected social platforms for a user.
        
        Args:
            user_id: The user's ID
            
        Returns:
            List of SocialConnection objects for connected platforms
        """
        client = self._get_composio_client()
        
        if not client:
            logger.warning("No Composio client available, returning empty connections")
            return []
        
        try:
            entity_id = self._get_entity_id(user_id)
            entity = client.get_entity(id=entity_id)
            connections = entity.get_connections()
            
            result = []
            for conn in connections:
                # Get app key (handles different SDK versions)
                app_key = (
                    getattr(conn, 'appUniqueId', None) or 
                    getattr(conn, 'app_unique_key', None) or 
                    getattr(conn, 'appId', None) or 
                    'unknown'
                ).lower()
                
                # Only include social platforms
                if app_key in SOCIAL_PLATFORMS:
                    result.append(SocialConnection(
                        platform=app_key,
                        connection_id=conn.id,
                        account_name=getattr(conn, 'account_display', None),
                        account_id=getattr(conn, 'accountId', None),
                        status=conn.status,
                    ))
            
            logger.info(f"Found {len(result)} social connections for user {user_id}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to fetch connections for user {user_id}: {e}")
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
            if conn.platform == platform and conn.status == "active":
                return conn.connection_id
        
        return None
    
    async def verify_connections(
        self, 
        user_id: str, 
        platforms: list[str]
    ) -> dict[str, Optional[str]]:
        """
        Check which platforms are connected and return their connection_ids.
        
        This is called before publishing to ensure all required platforms
        are connected. Returns a dict mapping platform to connection_id
        (or None if not connected).
        
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
            if conn.status == "active"
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
        
        Useful for UI to show which platforms are available for publishing.
        
        Args:
            user_id: The user's ID
            
        Returns:
            List of connected platform names
        """
        connections = await self.get_user_connections(user_id)
        return [
            conn.platform 
            for conn in connections 
            if conn.status == "active"
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
        
        # For now, if we have a connection_id, assume it's healthy
        # In the future, we could make a test API call here
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
