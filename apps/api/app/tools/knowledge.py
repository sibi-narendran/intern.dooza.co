"""
Knowledge Tools

Tools for agents to access brand context and media library.
Used by content-creating agents (Soshie, Seomi, Penn) to maintain brand consistency.

Production-ready with:
- Async execution
- Proper error handling
- Structured output for agent consumption
"""

from __future__ import annotations
import logging
from typing import Optional

from langchain_core.tools import tool

from app.services.knowledge_service import get_knowledge_service

logger = logging.getLogger(__name__)


# =============================================================================
# Brand Context Tool
# =============================================================================

@tool
async def get_brand_context(user_id: str) -> dict:
    """
    Get brand voice, colors, and guidelines for content creation.
    
    Use this tool BEFORE creating any content to ensure brand consistency.
    Returns the organization's brand identity including:
    - Business name and website
    - Brand voice and tone guidelines
    - Color palette
    - Company description and value proposition
    - Target audience information
    
    Args:
        user_id: The user's ID (for org resolution)
        
    Returns:
        Dictionary with brand settings and context string for prompts
    """
    try:
        service = get_knowledge_service()
        context = await service.get_brand_context(user_id)
        
        if not context.settings:
            return {
                "has_brand_context": False,
                "message": "No brand settings configured. Create content with general best practices.",
                "prompt_context": "",
            }
        
        settings = context.settings
        
        return {
            "has_brand_context": True,
            "business_name": settings.business_name,
            "website": settings.website,
            "tagline": settings.tagline,
            "brand_voice": settings.brand_voice,
            "colors": settings.colors,
            "description": settings.description,
            "value_proposition": settings.value_proposition,
            "target_audience": settings.target_audience,
            "industry": settings.industry,
            "logo_url": context.logo_url,
            "prompt_context": context.to_prompt_context(),
        }
        
    except Exception as e:
        logger.error(f"Error getting brand context for user {user_id}: {e}")
        return {
            "has_brand_context": False,
            "error": str(e),
            "message": "Failed to load brand context. Create content with general best practices.",
        }


@tool
async def get_media_for_post(
    user_id: str,
    asset_type: str = "image",
    limit: int = 5,
) -> dict:
    """
    Get available brand media for social posts.
    
    Use this tool when you need images, logos, or other media for content.
    Returns URLs and metadata for brand assets.
    
    Args:
        user_id: The user's ID (for org resolution)
        asset_type: Type of media - "logo", "image", "video", "document"
        limit: Maximum number of assets to return (default 5)
        
    Returns:
        Dictionary with list of available media assets
    """
    try:
        service = get_knowledge_service()
        
        org_id = await service.get_user_org_id(user_id)
        if not org_id:
            return {
                "has_media": False,
                "message": "No organization found",
                "assets": [],
            }
        
        assets = await service.get_brand_assets(
            org_id, 
            asset_type=asset_type, 
            limit=limit
        )
        
        if not assets:
            return {
                "has_media": False,
                "message": f"No {asset_type} assets found in media library",
                "assets": [],
            }
        
        asset_list = []
        for asset in assets:
            asset_list.append({
                "id": asset.id,
                "name": asset.name,
                "description": asset.description,
                "url": asset.public_url,
                "file_path": asset.file_path,
                "mime_type": asset.mime_type,
                "metadata": asset.metadata,
            })
        
        return {
            "has_media": True,
            "count": len(asset_list),
            "asset_type": asset_type,
            "assets": asset_list,
        }
        
    except Exception as e:
        logger.error(f"Error getting media for user {user_id}: {e}")
        return {
            "has_media": False,
            "error": str(e),
            "assets": [],
        }


@tool
async def get_brand_logo(user_id: str) -> dict:
    """
    Get the organization's logo URL.
    
    Use this when you need the brand logo for visual content.
    
    Args:
        user_id: The user's ID (for org resolution)
        
    Returns:
        Dictionary with logo URL and metadata, or message if not found
    """
    try:
        service = get_knowledge_service()
        
        org_id = await service.get_user_org_id(user_id)
        if not org_id:
            return {
                "has_logo": False,
                "message": "No organization found",
            }
        
        logo = await service.get_logo(org_id)
        
        if not logo:
            return {
                "has_logo": False,
                "message": "No logo uploaded. Content can be created without logo.",
            }
        
        return {
            "has_logo": True,
            "url": logo.public_url,
            "file_path": logo.file_path,
            "name": logo.name,
            "metadata": logo.metadata,
        }
        
    except Exception as e:
        logger.error(f"Error getting logo for user {user_id}: {e}")
        return {
            "has_logo": False,
            "error": str(e),
        }


@tool
async def search_knowledge_base(
    user_id: str,
    query: str,
    limit: int = 5,
) -> dict:
    """
    Search the organization's knowledge base for relevant information.
    
    Use this to find company information, FAQs, product details, etc.
    that can inform content creation.
    
    Args:
        user_id: The user's ID (for org resolution)
        query: Search query text
        limit: Maximum results to return
        
    Returns:
        Dictionary with search results from knowledge base
    """
    try:
        service = get_knowledge_service()
        
        org_id = await service.get_user_org_id(user_id)
        if not org_id:
            return {
                "has_results": False,
                "message": "No organization found",
                "results": [],
            }
        
        results = await service.search_knowledge(org_id, query, limit=limit)
        
        if not results:
            return {
                "has_results": False,
                "message": f"No knowledge base documents found for '{query}'",
                "results": [],
            }
        
        return {
            "has_results": True,
            "count": len(results),
            "query": query,
            "results": results,
        }
        
    except Exception as e:
        logger.error(f"Error searching knowledge for user {user_id}: {e}")
        return {
            "has_results": False,
            "error": str(e),
            "results": [],
        }


# =============================================================================
# Tool Registration
# =============================================================================

KNOWLEDGE_TOOLS = [
    get_brand_context,
    get_media_for_post,
    get_brand_logo,
    search_knowledge_base,
]


def get_knowledge_tools() -> list:
    """Get all knowledge tools for agent registration."""
    return KNOWLEDGE_TOOLS
