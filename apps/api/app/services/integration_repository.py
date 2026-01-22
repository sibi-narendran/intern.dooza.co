"""
Integration Repository

Database operations for the user_integrations table.
Handles CRUD for storing connection metadata locally.

Why local storage?
- Fast reads (no Composio API call for every page load)
- Connection history preserved
- Single source of truth for UI
- Composio still handles actual OAuth tokens

Production pattern:
- Sync ON connect/disconnect events (not polling)
- Read from local DB
- Write credentials as {"composio_connection_id": "xxx"} (no actual tokens)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from uuid import UUID

from app.core.database import get_supabase_client

logger = logging.getLogger(__name__)


# =============================================================================
# TYPES
# =============================================================================

@dataclass
class StoredConnection:
    """A connection record from the database."""
    id: str
    user_id: str
    integration_slug: str  # Platform name: instagram, facebook, etc.
    provider: str          # Always "composio" for OAuth connections
    composio_connection_id: str
    account_name: Optional[str]
    account_id: Optional[str]
    status: str           # active, revoked, expired, error
    connected_at: str     # ISO timestamp string from Supabase
    updated_at: str       # ISO timestamp string from Supabase


# =============================================================================
# CONSTANTS
# =============================================================================

SOCIAL_PLATFORMS = [
    "instagram",
    "facebook",
    "linkedin",
    "tiktok",
    "youtube",
]


# =============================================================================
# INTEGRATION REPOSITORY
# =============================================================================

class IntegrationRepository:
    """
    Repository for user_integrations table.
    
    Handles local storage of connection metadata.
    Composio handles actual OAuth tokens - we just store references.
    """
    
    def __init__(self):
        self.client = get_supabase_client()
        if not self.client:
            logger.warning("Supabase client not available for IntegrationRepository")
    
    async def save_connection(
        self,
        *,
        user_id: str,
        platform: str,
        composio_connection_id: str,
        account_name: Optional[str] = None,
        account_id: Optional[str] = None,
        org_id: Optional[str] = None,
    ) -> Optional[StoredConnection]:
        """
        Save a new connection after OAuth completes.
        
        Uses UPSERT to handle reconnections to the same platform.
        
        Args:
            user_id: User's ID
            platform: Platform slug (instagram, facebook, etc.)
            composio_connection_id: Composio's connection ID
            account_name: Display name for the connected account
            account_id: External platform account ID
            org_id: Optional organization ID
            
        Returns:
            StoredConnection if successful, None on error
        """
        if not self.client:
            logger.error("Cannot save connection: Supabase client not available")
            return None
        
        platform = platform.lower()
        
        insert_data = {
            "user_id": user_id,
            "integration_slug": platform,
            "provider": "composio",
            "credentials": {"composio_connection_id": composio_connection_id},
            "account_name": account_name,
            "account_id": account_id,
            "status": "active",
            "connected_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        if org_id:
            insert_data["org_id"] = org_id
        
        try:
            # UPSERT: Update if exists, insert if not
            # Unique constraint: (user_id, integration_slug)
            result = (
                self.client.table("user_integrations")
                .upsert(insert_data, on_conflict="user_id,integration_slug")
                .execute()
            )
            
            if not result.data:
                logger.error(f"Failed to save connection for {platform}")
                return None
            
            row = result.data[0]
            logger.info(f"Saved connection for user {user_id} platform {platform}")
            
            return self._row_to_connection(row)
            
        except Exception as e:
            logger.error(f"Database error saving connection: {e}")
            return None
    
    async def get_user_connections(
        self, 
        user_id: str,
        platforms: Optional[list[str]] = None,
    ) -> list[StoredConnection]:
        """
        Get all connections for a user.
        
        Args:
            user_id: User's ID
            platforms: Optional filter for specific platforms
            
        Returns:
            List of StoredConnection objects
        """
        if not self.client:
            return []
        
        try:
            query = (
                self.client.table("user_integrations")
                .select("*")
                .eq("user_id", user_id)
            )
            
            # Filter to social platforms by default
            if platforms:
                query = query.in_("integration_slug", platforms)
            else:
                query = query.in_("integration_slug", SOCIAL_PLATFORMS)
            
            result = query.execute()
            
            if not result.data:
                return []
            
            return [self._row_to_connection(row) for row in result.data]
            
        except Exception as e:
            logger.error(f"Database error fetching connections: {e}")
            return []
    
    async def get_connection_by_platform(
        self,
        user_id: str,
        platform: str,
    ) -> Optional[StoredConnection]:
        """
        Get a specific connection by platform.
        
        Args:
            user_id: User's ID
            platform: Platform slug
            
        Returns:
            StoredConnection if found, None otherwise
        """
        if not self.client:
            return None
        
        platform = platform.lower()
        
        try:
            result = (
                self.client.table("user_integrations")
                .select("*")
                .eq("user_id", user_id)
                .eq("integration_slug", platform)
                .limit(1)
                .execute()
            )
            
            if not result.data:
                return None
            
            return self._row_to_connection(result.data[0])
            
        except Exception as e:
            logger.error(f"Database error fetching connection: {e}")
            return None
    
    async def update_connection_status(
        self,
        user_id: str,
        platform: str,
        status: str,
        last_error: Optional[str] = None,
    ) -> bool:
        """
        Update connection status (e.g., on disconnect).
        
        Args:
            user_id: User's ID
            platform: Platform slug
            status: New status (active, revoked, expired, error)
            last_error: Optional error message
            
        Returns:
            True if updated, False otherwise
        """
        if not self.client:
            return False
        
        platform = platform.lower()
        
        update_data = {
            "status": status,
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        if last_error:
            update_data["last_error"] = last_error
        
        try:
            result = (
                self.client.table("user_integrations")
                .update(update_data)
                .eq("user_id", user_id)
                .eq("integration_slug", platform)
                .execute()
            )
            
            if result.data:
                logger.info(f"Updated {platform} status to {status} for user {user_id}")
                return True
            return False
            
        except Exception as e:
            logger.error(f"Database error updating connection status: {e}")
            return False
    
    async def delete_connection(
        self,
        user_id: str,
        platform: str,
    ) -> bool:
        """
        Hard delete a connection record.
        
        Note: Usually prefer update_connection_status to 'revoked' 
        for audit trail. This is for cleanup.
        
        Args:
            user_id: User's ID
            platform: Platform slug
            
        Returns:
            True if deleted, False otherwise
        """
        if not self.client:
            return False
        
        platform = platform.lower()
        
        try:
            result = (
                self.client.table("user_integrations")
                .delete()
                .eq("user_id", user_id)
                .eq("integration_slug", platform)
                .execute()
            )
            
            if result.data:
                logger.info(f"Deleted {platform} connection for user {user_id}")
                return True
            return False
            
        except Exception as e:
            logger.error(f"Database error deleting connection: {e}")
            return False
    
    def _row_to_connection(self, row: dict) -> StoredConnection:
        """Convert database row to StoredConnection dataclass."""
        credentials = row.get("credentials", {})
        
        return StoredConnection(
            id=row["id"],
            user_id=row["user_id"],
            integration_slug=row["integration_slug"],
            provider=row["provider"],
            composio_connection_id=credentials.get("composio_connection_id", ""),
            account_name=row.get("account_name"),
            account_id=row.get("account_id"),
            status=row.get("status", "active"),
            connected_at=row.get("connected_at", ""),
            updated_at=row.get("updated_at", ""),
        )


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_repository: Optional[IntegrationRepository] = None


def get_integration_repository() -> IntegrationRepository:
    """Get or create the integration repository singleton."""
    global _repository
    if _repository is None:
        _repository = IntegrationRepository()
    return _repository
