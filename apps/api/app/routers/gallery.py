"""
Gallery Router - Public agent gallery and hiring functionality.

This router handles:
- Listing published agents from the gallery
- Getting agent details
- Hiring (installing) agents to user's team
- Managing user's hired agents
"""

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.config import get_settings
from app.core.auth import get_current_user
from app.core.database import get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================================
# Types
# ============================================================================

class GalleryAgent(BaseModel):
    """Public agent information for gallery display."""
    id: str
    slug: str
    name: str
    role: str
    description: str
    avatar_url: Optional[str] = None
    gradient: Optional[str] = None
    capabilities: list[str] = []
    integrations: list[str] = []
    tags: list[str] = []
    is_featured: bool = False
    install_count: int = 0
    rating_avg: float = 0.0
    rating_count: int = 0
    tier: str = "free"
    created_by: Optional[str] = None  # NULL = Dooza, UUID = user
    chat_enabled: bool = False  # Whether agent supports chat (has tools/supervisor)


class GalleryAgentDetail(GalleryAgent):
    """Full agent details including system prompt (for hired agents)."""
    system_prompt: Optional[str] = None  # Only shown if user has hired


class HiredAgent(BaseModel):
    """User's hired agent with full details."""
    id: str  # hired_agents.id
    agent_id: str
    slug: str
    name: str
    role: str
    description: str
    avatar_url: Optional[str] = None
    gradient: Optional[str] = None
    capabilities: list[str] = []
    integrations: list[str] = []
    is_active: bool = True
    hired_at: str
    last_used_at: Optional[str] = None
    chat_enabled: bool = False  # Whether agent supports chat (has tools/supervisor)


class HireRequest(BaseModel):
    """Request to hire an agent."""
    agent_id: str


class HireResponse(BaseModel):
    """Response after hiring an agent."""
    success: bool
    hired_agent_id: str
    message: str


# ============================================================================
# Gallery Endpoints
# ============================================================================

@router.get("/gallery/agents", response_model=list[GalleryAgent])
async def list_gallery_agents(
    tag: Optional[str] = Query(None, description="Filter by tag"),
    featured_only: bool = Query(False, description="Only show featured agents"),
    search: Optional[str] = Query(None, description="Search by name or description"),
    user_id: str = Depends(get_current_user),
):
    """
    List all published agents in the gallery.
    
    Supports filtering by tag, featured status, and search.
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    try:
        query = supabase.table("gallery_agents").select(
            "id, slug, name, role, description, avatar_url, gradient, "
            "capabilities, integrations, tags, is_featured, install_count, "
            "rating_avg, rating_count, tier, created_by, chat_enabled"
        ).eq("is_published", True)
        
        if featured_only:
            query = query.eq("is_featured", True)
        
        if tag:
            query = query.contains("tags", [tag])
        
        if search:
            # Search in name and description
            query = query.or_(f"name.ilike.%{search}%,description.ilike.%{search}%")
        
        result = query.order("is_featured", desc=True).order("install_count", desc=True).execute()
        
        return [GalleryAgent(**agent) for agent in result.data]
        
    except Exception as e:
        logger.error(f"Failed to list gallery agents: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch gallery agents"
        )


@router.get("/gallery/agents/{agent_id_or_slug}", response_model=GalleryAgentDetail)
async def get_gallery_agent(
    agent_id_or_slug: str,
    user_id: str = Depends(get_current_user),
):
    """
    Get detailed information about a gallery agent.
    
    If the user has hired this agent, includes the system prompt.
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    try:
        # Try to find by ID first, then by slug
        query = supabase.table("gallery_agents").select("*").eq("is_published", True)
        
        # Check if it looks like a UUID
        try:
            UUID(agent_id_or_slug)
            query = query.eq("id", agent_id_or_slug)
        except ValueError:
            query = query.eq("slug", agent_id_or_slug)
        
        result = query.single().execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent not found"
            )
        
        agent = result.data
        
        # Check if user has hired this agent
        hired_check = supabase.table("hired_agents").select("id").eq(
            "user_id", user_id
        ).eq("agent_id", agent["id"]).execute()
        
        has_hired = len(hired_check.data) > 0
        
        # Only include system prompt if user has hired
        return GalleryAgentDetail(
            **{k: v for k, v in agent.items() if k != "system_prompt"},
            system_prompt=agent.get("system_prompt") if has_hired else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get agent {agent_id_or_slug}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch agent details"
        )


# ============================================================================
# Hiring Endpoints
# ============================================================================

@router.post("/agents/hire", response_model=HireResponse)
async def hire_agent(
    request: HireRequest,
    user_id: str = Depends(get_current_user),
):
    """
    Hire (install) an agent to the user's team.
    
    This adds the agent to the user's hired_agents and increments
    the agent's install count.
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    try:
        # Verify agent exists and is published
        agent_check = supabase.table("gallery_agents").select("id, name").eq(
            "id", request.agent_id
        ).eq("is_published", True).execute()
        
        if not agent_check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent not found or not available"
            )
        
        agent = agent_check.data[0]
        
        # Check if already hired
        existing = supabase.table("hired_agents").select("id").eq(
            "user_id", user_id
        ).eq("agent_id", request.agent_id).execute()
        
        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"You have already hired {agent['name']}"
            )
        
        # Create hired_agents record
        result = supabase.table("hired_agents").insert({
            "user_id": user_id,
            "agent_id": request.agent_id,
            "is_active": True
        }).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to hire agent"
            )
        
        return HireResponse(
            success=True,
            hired_agent_id=result.data[0]["id"],
            message=f"{agent['name']} has been added to your team!"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to hire agent {request.agent_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to hire agent"
        )


@router.delete("/agents/{agent_id}/release")
async def release_agent(
    agent_id: str,
    user_id: str = Depends(get_current_user),
):
    """
    Release (uninstall) an agent from the user's team.
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    try:
        # Find the hired agent record
        hired = supabase.table("hired_agents").select("id").eq(
            "user_id", user_id
        ).eq("agent_id", agent_id).execute()
        
        if not hired.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent not found in your team"
            )
        
        # Delete the hired_agents record (trigger will decrement install_count)
        supabase.table("hired_agents").delete().eq(
            "id", hired.data[0]["id"]
        ).execute()
        
        return {"success": True, "message": "Agent released from your team"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to release agent {agent_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to release agent"
        )


@router.get("/agents/team", response_model=list[HiredAgent])
async def get_my_team(
    user_id: str = Depends(get_current_user),
):
    """
    Get all agents hired by the current user.
    
    Returns full agent details for each hired agent.
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    try:
        # Join hired_agents with gallery_agents (include chat_enabled)
        result = supabase.table("hired_agents").select(
            "id, agent_id, is_active, hired_at, last_used_at, "
            "gallery_agents(slug, name, role, description, avatar_url, gradient, capabilities, integrations, chat_enabled)"
        ).eq("user_id", user_id).eq("is_active", True).order("hired_at", desc=True).execute()
        
        hired_agents = []
        for item in result.data:
            agent = item.get("gallery_agents", {})
            hired_agents.append(HiredAgent(
                id=item["id"],
                agent_id=item["agent_id"],
                slug=agent.get("slug", ""),
                name=agent.get("name", "Unknown"),
                role=agent.get("role", ""),
                description=agent.get("description", ""),
                avatar_url=agent.get("avatar_url"),
                gradient=agent.get("gradient"),
                capabilities=agent.get("capabilities", []),
                integrations=agent.get("integrations", []),
                is_active=item["is_active"],
                hired_at=item["hired_at"],
                last_used_at=item.get("last_used_at"),
                chat_enabled=agent.get("chat_enabled", False),
            ))
        
        return hired_agents
        
    except Exception as e:
        logger.error(f"Failed to get user's team: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch your team"
        )


@router.get("/agents/hired-ids")
async def get_hired_agent_ids(
    user_id: str = Depends(get_current_user),
):
    """
    Get all agent IDs that the current user has hired.
    
    This is a batch endpoint for efficiently checking hire status
    of multiple agents at once (avoids N+1 queries).
    """
    supabase = get_supabase_client()
    if not supabase:
        return {"agent_ids": []}
    
    try:
        result = supabase.table("hired_agents").select("agent_id").eq(
            "user_id", user_id
        ).eq("is_active", True).execute()
        
        return {
            "agent_ids": [item["agent_id"] for item in result.data]
        }
        
    except Exception as e:
        logger.error(f"Failed to get hired agent IDs: {e}")
        return {"agent_ids": []}


@router.get("/agents/{agent_id}/check-hired")
async def check_if_hired(
    agent_id: str,
    user_id: str = Depends(get_current_user),
):
    """
    Check if the current user has hired a specific agent.
    
    Useful for UI to show correct button state.
    For multiple agents, prefer /agents/hired-ids endpoint.
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    try:
        result = supabase.table("hired_agents").select("id, hired_at").eq(
            "user_id", user_id
        ).eq("agent_id", agent_id).eq("is_active", True).execute()
        
        if result.data:
            return {
                "is_hired": True,
                "hired_at": result.data[0]["hired_at"]
            }
        
        return {"is_hired": False}
        
    except Exception as e:
        logger.error(f"Failed to check hired status: {e}")
        return {"is_hired": False}
