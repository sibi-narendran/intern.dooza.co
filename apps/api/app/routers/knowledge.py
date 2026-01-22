"""
Knowledge Router - Brand settings, assets, and knowledge base API.

All endpoints are org-scoped. Users access their organization's data
through their membership (resolved from user_id → org_id).

Endpoints:
- GET/PUT /brand - Brand settings (colors, voice, description, etc.)
- GET/POST/DELETE /assets - Media library (logos, images, videos)
- GET /context - Combined brand context for agents
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.services.knowledge_service import (
    get_knowledge_service,
    BrandSettings,
    BrandAsset,
    BrandContext,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# =============================================================================
# Request/Response Models
# =============================================================================

class BrandSettingsUpdate(BaseModel):
    """Request to update brand settings."""
    business_name: Optional[str] = None
    website: Optional[str] = None
    tagline: Optional[str] = None
    brand_voice: Optional[str] = None
    colors: Optional[dict] = Field(None, description="{ primary, secondary, tertiary }")
    fonts: Optional[dict] = Field(None, description="{ heading, body }")
    description: Optional[str] = None
    value_proposition: Optional[str] = None
    industry: Optional[str] = None
    target_audience: Optional[str] = None


class BrandSettingsResponse(BaseModel):
    """Brand settings response."""
    id: str
    org_id: str
    business_name: Optional[str] = None
    website: Optional[str] = None
    tagline: Optional[str] = None
    brand_voice: Optional[str] = None
    colors: dict = {}
    fonts: dict = {}
    description: Optional[str] = None
    value_proposition: Optional[str] = None
    industry: Optional[str] = None
    target_audience: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class BrandAssetResponse(BaseModel):
    """Brand asset response."""
    id: str
    org_id: str
    asset_type: str
    name: str
    description: Optional[str] = None
    file_path: str
    public_url: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    metadata: dict = {}
    usage_count: int = 0
    created_at: Optional[str] = None


class BrandAssetCreate(BaseModel):
    """Request to create a brand asset record."""
    asset_type: str = Field(..., description="logo, image, video, document, font")
    name: str
    description: Optional[str] = None
    file_path: str
    public_url: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    metadata: Optional[dict] = None


class BrandContextResponse(BaseModel):
    """Complete brand context for agents."""
    settings: Optional[BrandSettingsResponse] = None
    logo_url: Optional[str] = None
    recent_images: list[BrandAssetResponse] = []
    prompt_context: str = ""


# =============================================================================
# Helper Functions
# =============================================================================

def settings_to_response(settings: BrandSettings) -> BrandSettingsResponse:
    """Convert BrandSettings to response model."""
    return BrandSettingsResponse(
        id=settings.id,
        org_id=settings.org_id,
        business_name=settings.business_name,
        website=settings.website,
        tagline=settings.tagline,
        brand_voice=settings.brand_voice,
        colors=settings.colors,
        fonts=settings.fonts,
        description=settings.description,
        value_proposition=settings.value_proposition,
        industry=settings.industry,
        target_audience=settings.target_audience,
        created_at=settings.created_at,
        updated_at=settings.updated_at,
    )


def asset_to_response(asset: BrandAsset) -> BrandAssetResponse:
    """Convert BrandAsset to response model."""
    return BrandAssetResponse(
        id=asset.id,
        org_id=asset.org_id,
        asset_type=asset.asset_type,
        name=asset.name,
        description=asset.description,
        file_path=asset.file_path,
        public_url=asset.public_url,
        file_size=asset.file_size,
        mime_type=asset.mime_type,
        metadata=asset.metadata,
        usage_count=asset.usage_count,
        created_at=asset.created_at,
    )


# =============================================================================
# Brand Settings Endpoints
# =============================================================================

@router.get("/brand", response_model=BrandSettingsResponse)
async def get_brand_settings(
    user_id: str = Depends(get_current_user),
):
    """
    Get brand settings for the user's organization.
    
    Returns empty settings with org_id if not configured yet.
    """
    service = get_knowledge_service()
    
    org_id = await service.get_user_org_id(user_id)
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No organization found for user",
        )
    
    settings = await service.get_brand_settings(org_id)
    
    if not settings:
        # Return empty settings structure
        return BrandSettingsResponse(
            id="",
            org_id=org_id,
        )
    
    return settings_to_response(settings)


@router.put("/brand", response_model=BrandSettingsResponse)
async def update_brand_settings(
    update: BrandSettingsUpdate,
    user_id: str = Depends(get_current_user),
):
    """
    Update brand settings for the user's organization.
    
    Uses UPSERT - creates settings if they don't exist.
    Only provided fields are updated.
    """
    service = get_knowledge_service()
    
    org_id = await service.get_user_org_id(user_id)
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No organization found for user",
        )
    
    settings = await service.save_brand_settings(
        org_id,
        business_name=update.business_name,
        website=update.website,
        tagline=update.tagline,
        brand_voice=update.brand_voice,
        colors=update.colors,
        fonts=update.fonts,
        description=update.description,
        value_proposition=update.value_proposition,
        industry=update.industry,
        target_audience=update.target_audience,
        created_by=user_id,
    )
    
    if not settings:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save brand settings",
        )
    
    logger.info(f"Updated brand settings for org {org_id}")
    return settings_to_response(settings)


# =============================================================================
# Brand Assets Endpoints
# =============================================================================

@router.get("/assets", response_model=list[BrandAssetResponse])
async def list_brand_assets(
    asset_type: Optional[str] = Query(None, description="Filter by type: logo, image, video, document, font"),
    limit: int = Query(50, le=100),
    user_id: str = Depends(get_current_user),
):
    """
    List brand assets for the user's organization.
    
    Optional filter by asset_type. Returns most recent first.
    """
    service = get_knowledge_service()
    
    org_id = await service.get_user_org_id(user_id)
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No organization found for user",
        )
    
    assets = await service.get_brand_assets(org_id, asset_type=asset_type, limit=limit)
    
    return [asset_to_response(a) for a in assets]


@router.post("/assets", response_model=BrandAssetResponse, status_code=status.HTTP_201_CREATED)
async def create_brand_asset(
    asset: BrandAssetCreate,
    user_id: str = Depends(get_current_user),
):
    """
    Create a brand asset record.
    
    Note: This creates the database record. File upload should be done
    separately via Supabase Storage, then this endpoint called with
    the file_path and public_url.
    
    Typical flow:
    1. Upload file to Supabase Storage (frontend)
    2. Call this endpoint with file details
    """
    service = get_knowledge_service()
    
    org_id = await service.get_user_org_id(user_id)
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No organization found for user",
        )
    
    # Validate asset_type
    valid_types = ["logo", "image", "video", "document", "font"]
    if asset.asset_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid asset_type. Must be one of: {valid_types}",
        )
    
    saved = await service.save_brand_asset(
        org_id,
        asset_type=asset.asset_type,
        name=asset.name,
        file_path=asset.file_path,
        description=asset.description,
        public_url=asset.public_url,
        file_size=asset.file_size,
        mime_type=asset.mime_type,
        metadata=asset.metadata,
        uploaded_by=user_id,
    )
    
    if not saved:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save brand asset",
        )
    
    logger.info(f"Created brand asset '{asset.name}' for org {org_id}")
    return asset_to_response(saved)


@router.delete("/assets/{asset_id}")
async def delete_brand_asset(
    asset_id: str,
    user_id: str = Depends(get_current_user),
):
    """
    Delete a brand asset (soft delete).
    
    Marks the asset as deleted but preserves the record for audit.
    """
    service = get_knowledge_service()
    
    org_id = await service.get_user_org_id(user_id)
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No organization found for user",
        )
    
    deleted = await service.delete_brand_asset(org_id, asset_id)
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found or already deleted",
        )
    
    logger.info(f"Deleted brand asset {asset_id} for org {org_id}")
    return {"status": "deleted", "asset_id": asset_id}


# =============================================================================
# Brand Context Endpoint (For Agents)
# =============================================================================

@router.get("/context", response_model=BrandContextResponse)
async def get_brand_context(
    user_id: str = Depends(get_current_user),
):
    """
    Get complete brand context for content creation.
    
    This is used by agents to get brand voice, colors, logo,
    and recent images for creating on-brand content.
    
    Returns:
    - settings: Brand identity (name, voice, colors, etc.)
    - logo_url: Primary logo URL
    - recent_images: Recent brand images for use in posts
    - prompt_context: Pre-formatted text for agent prompts
    """
    service = get_knowledge_service()
    
    context = await service.get_brand_context(user_id)
    
    response = BrandContextResponse(
        logo_url=context.logo_url,
        recent_images=[asset_to_response(a) for a in context.recent_images],
        prompt_context=context.to_prompt_context(),
    )
    
    if context.settings:
        response.settings = settings_to_response(context.settings)
    
    return response


# =============================================================================
# Knowledge Search Endpoint
# =============================================================================

@router.get("/search")
async def search_knowledge(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(5, le=20),
    user_id: str = Depends(get_current_user),
):
    """
    Search knowledge base documents.
    
    Performs full-text search across the organization's knowledge bases.
    """
    service = get_knowledge_service()
    
    org_id = await service.get_user_org_id(user_id)
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No organization found for user",
        )
    
    results = await service.search_knowledge(org_id, q, limit=limit)
    
    return {"results": results, "count": len(results)}
