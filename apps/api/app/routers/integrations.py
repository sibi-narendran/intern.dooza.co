"""
Integrations Router - Composio OAuth connections for users/orgs.

This router handles connecting external services (Gmail, Slack, etc.)
via Composio's OAuth management. Connections can be:
- Organization-level: Shared by all org members
- User-level (Personal): Only accessible by that user
"""

import logging
import time
from typing import Optional, Literal
from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from app.config import get_settings
from app.core.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

# ============================================================================
# In-Memory Cache for Apps (reduces Composio API calls)
# ============================================================================

_apps_cache: list = []
_apps_cache_timestamp: float = 0
APPS_CACHE_TTL = 3600  # 1 hour in seconds


# ============================================================================
# Types
# ============================================================================

class ConnectionScope(str, Enum):
    """Whether connection is org-level or personal."""
    ORGANIZATION = "organization"
    PERSONAL = "personal"


class AppInfo(BaseModel):
    """Information about an available integration app."""
    key: str
    name: str
    description: str
    logo: Optional[str] = None
    categories: list[str] = []


class ConnectionInfo(BaseModel):
    """Information about a connected account."""
    id: str
    app_key: str
    app_name: str
    status: str
    created_at: str
    account_display: Optional[str] = None  # e.g., email or username


class ConnectRequest(BaseModel):
    """Request to initiate a connection."""
    app_key: str
    scope: ConnectionScope = ConnectionScope.PERSONAL
    org_id: Optional[str] = None
    redirect_url: Optional[str] = None


class ConnectResponse(BaseModel):
    """Response with OAuth redirect URL."""
    redirect_url: str
    connection_id: str


# ============================================================================
# Composio Client Helpers
# ============================================================================

_composio_client = None


def get_composio_client():
    """Get or create Composio client instance."""
    global _composio_client
    
    if _composio_client is not None:
        return _composio_client
    
    settings = get_settings()
    
    if not settings.composio_api_key:
        logger.warning("COMPOSIO_API_KEY not set - integrations disabled")
        return None
    
    try:
        from composio import Composio
        _composio_client = Composio(api_key=settings.composio_api_key)
        logger.info("Composio client initialized")
        return _composio_client
    except ImportError:
        logger.error("composio-core not installed")
        return None
    except Exception as e:
        logger.error(f"Failed to init Composio client: {e}")
        return None


def get_entity_id(scope: ConnectionScope, user_id: str, org_id: Optional[str]) -> str:
    """
    Generate Composio entity ID based on scope.
    
    - Organization scope: org_{org_id}
    - Personal scope: user_{user_id}
    
    This ensures proper isolation between users and organizations.
    """
    if scope == ConnectionScope.ORGANIZATION:
        if not org_id:
            raise ValueError("org_id required for organization scope")
        return f"org_{org_id}"
    return f"user_{user_id}"


# ============================================================================
# Endpoints
# ============================================================================

def get_static_apps() -> list[AppInfo]:
    """Return static fallback apps when Composio is not configured."""
    return [
        AppInfo(key="gmail", name="Gmail", description="Email and Google Workspace", categories=["email", "productivity"]),
        AppInfo(key="slack", name="Slack", description="Team messaging and notifications", categories=["communication"]),
        AppInfo(key="google_calendar", name="Google Calendar", description="Calendar and scheduling", categories=["productivity", "scheduling"]),
        AppInfo(key="notion", name="Notion", description="Docs and knowledge management", categories=["productivity", "documentation"]),
        AppInfo(key="hubspot", name="HubSpot", description="CRM and marketing", categories=["crm", "marketing"]),
        AppInfo(key="twitter", name="X (Twitter)", description="Social media posting and monitoring", categories=["social"]),
        AppInfo(key="linkedin", name="LinkedIn", description="Professional networking and posting", categories=["social"]),
        AppInfo(key="instagram", name="Instagram", description="Photo and video sharing", categories=["social"]),
        AppInfo(key="zendesk", name="Zendesk", description="Customer support ticketing", categories=["support"]),
        AppInfo(key="google_sheets", name="Google Sheets", description="Spreadsheets and data", categories=["productivity", "data"]),
        AppInfo(key="stripe", name="Stripe", description="Payments and billing data", categories=["finance"]),
        AppInfo(key="salesforce", name="Salesforce", description="CRM and sales platform", categories=["crm", "sales"]),
        AppInfo(key="mailchimp", name="Mailchimp", description="Email marketing", categories=["marketing", "email"]),
        AppInfo(key="trello", name="Trello", description="Project management boards", categories=["productivity"]),
        AppInfo(key="asana", name="Asana", description="Work management platform", categories=["productivity"]),
        AppInfo(key="github", name="GitHub", description="Code repositories and collaboration", categories=["development"]),
        AppInfo(key="intercom", name="Intercom", description="Customer messaging platform", categories=["support", "communication"]),
        AppInfo(key="google_drive", name="Google Drive", description="Cloud storage and file sharing", categories=["storage", "productivity"]),
        AppInfo(key="dropbox", name="Dropbox", description="Cloud storage", categories=["storage"]),
        AppInfo(key="airtable", name="Airtable", description="Spreadsheet-database hybrid", categories=["productivity", "data"]),
    ]


def get_cached_apps() -> Optional[list[AppInfo]]:
    """Get apps from cache if still valid."""
    global _apps_cache, _apps_cache_timestamp
    
    if _apps_cache and (time.time() - _apps_cache_timestamp) < APPS_CACHE_TTL:
        return _apps_cache
    return None


def set_cached_apps(apps: list[AppInfo]) -> None:
    """Store apps in cache."""
    global _apps_cache, _apps_cache_timestamp
    _apps_cache = apps
    _apps_cache_timestamp = time.time()


@router.get("/apps", response_model=list[AppInfo])
async def list_available_apps(
    user_id: str = Depends(get_current_user),
):
    """
    List all available integration apps from Composio.
    Uses in-memory caching (1h TTL) for fast response.
    """
    # Check cache first
    cached = get_cached_apps()
    if cached:
        return cached
    
    client = get_composio_client()
    
    if not client:
        # Return static list when Composio is not configured
        static_apps = get_static_apps()
        set_cached_apps(static_apps)
        return static_apps
    
    try:
        apps = client.apps.get()
        result = [
            AppInfo(
                key=app.key,
                name=app.name,
                description=app.description or "",
                logo=getattr(app, 'logo', None),
                categories=getattr(app, 'categories', [])
            )
            for app in apps
        ]
        set_cached_apps(result)
        return result
    except Exception as e:
        logger.error(f"Failed to fetch apps from Composio: {e}")
        # Return static apps as fallback on error
        static_apps = get_static_apps()
        return static_apps


@router.get("/connections", response_model=list[ConnectionInfo])
async def list_connections(
    scope: ConnectionScope = Query(ConnectionScope.PERSONAL),
    org_id: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user),
):
    """
    List all connected accounts for user or organization.
    
    - scope=personal: User's personal connections
    - scope=organization: Organization's shared connections (requires org_id)
    """
    client = get_composio_client()
    
    if not client:
        return []
    
    try:
        entity_id = get_entity_id(scope, user_id, org_id)
        entity = client.get_entity(id=entity_id)
        connections = entity.get_connections()
        
        result = []
        for conn in connections:
            # Handle both old (snake_case) and new (camelCase) SDK attribute names
            app_key = getattr(conn, 'appUniqueId', None) or getattr(conn, 'app_unique_key', None) or getattr(conn, 'appId', None) or 'unknown'
            app_name = getattr(conn, 'appName', None) or getattr(conn, 'app_name', None) or app_key
            created_at = getattr(conn, 'createdAt', None) or getattr(conn, 'created_at', None) or ''
            
            result.append(ConnectionInfo(
                id=conn.id,
                app_key=app_key,
                app_name=app_name,
                status=conn.status,
                created_at=str(created_at),
                account_display=getattr(conn, 'account_display', None)
            ))
        
        return result
    except Exception as e:
        logger.error(f"Failed to fetch connections: {e}")
        return []


@router.post("/connect", response_model=ConnectResponse)
async def initiate_connection(
    request: ConnectRequest,
    user_id: str = Depends(get_current_user),
):
    """
    Initiate OAuth connection flow for an app.
    
    Returns a redirect URL that the frontend should open
    (either in a popup or by redirecting the user).
    """
    client = get_composio_client()
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Integration service not configured. Set COMPOSIO_API_KEY."
        )
    
    try:
        entity_id = get_entity_id(request.scope, user_id, request.org_id)
        entity = client.get_entity(id=entity_id)
        
        # Initiate the connection - Composio handles OAuth complexity
        connection_request = entity.initiate_connection(
            app_name=request.app_key,
            redirect_url=request.redirect_url,
        )
        
        return ConnectResponse(
            redirect_url=connection_request.redirectUrl,
            connection_id=connection_request.connectedAccountId,
        )
    except Exception as e:
        logger.error(f"Failed to initiate connection for {request.app_key}: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to initiate connection: {str(e)}"
        )


@router.delete("/connections/{connection_id}")
async def disconnect(
    connection_id: str,
    user_id: str = Depends(get_current_user),
):
    """
    Disconnect (revoke) an integration connection.
    
    This revokes the OAuth tokens and removes the connection.
    """
    client = get_composio_client()
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Integration service not configured"
        )
    
    try:
        # Delete the connected account
        client.connected_accounts.delete(connection_id)
        
        return {"status": "disconnected", "connection_id": connection_id}
    except Exception as e:
        logger.error(f"Failed to disconnect {connection_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to disconnect: {str(e)}"
        )


@router.get("/status")
async def integration_status(
    user_id: str = Depends(get_current_user),
):
    """
    Check if integrations service is available.
    
    Returns configuration status and available features.
    """
    client = get_composio_client()
    settings = get_settings()
    
    return {
        "enabled": client is not None,
        "configured": bool(settings.composio_api_key),
        "message": "Composio connected" if client else "Set COMPOSIO_API_KEY to enable integrations"
    }
