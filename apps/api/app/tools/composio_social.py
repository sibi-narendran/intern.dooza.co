"""
Composio Social Publishing Tools

LangChain tools for agents to publish content to social media platforms.
These tools are used by the social_publisher agent to actually post content.

Tools:
- get_user_social_connections: Lists available connected platforms
- publish_to_instagram: Post to Instagram
- publish_to_facebook: Post to Facebook
- publish_to_linkedin: Post to LinkedIn
- publish_to_tiktok: Post to TikTok (video)
- publish_to_youtube: Upload to YouTube (video)
"""

from __future__ import annotations

import logging
from typing import Optional, List
from uuid import UUID

from langchain_core.tools import tool

from app.tools.task import get_agent_context
from app.services.connection_service import get_connection_service, SOCIAL_PLATFORMS
from app.services.composio_client import get_composio_client
from app.services.publish_service import get_publish_service

logger = logging.getLogger(__name__)


# =============================================================================
# CONNECTION TOOLS
# =============================================================================

@tool
async def get_user_social_connections() -> dict:
    """
    Get list of social media platforms the user has connected.
    
    Call this FIRST before attempting to publish to any platform.
    Returns which platforms are available and their connection status.
    
    Returns:
        dict with:
        - connected: list of connected platform names
        - disconnected: list of platforms not connected
        - details: dict with platform -> connection info
    """
    ctx = get_agent_context()
    if not ctx or not ctx.user_id:
        return {
            "error": "No user context available",
            "connected": [],
            "disconnected": SOCIAL_PLATFORMS,
        }
    
    connection_service = get_connection_service()
    connections = await connection_service.get_user_connections(ctx.user_id)
    
    connected = []
    details = {}
    
    for conn in connections:
        if conn.status == "active":
            connected.append(conn.platform)
            details[conn.platform] = {
                "connection_id": conn.connection_id,
                "account_name": conn.account_name,
                "status": conn.status,
            }
    
    disconnected = [p for p in SOCIAL_PLATFORMS if p not in connected]
    
    logger.info(f"User {ctx.user_id} has {len(connected)} connected platforms")
    
    # Return structured data only - no LLM-style text
    # Frontend renders this directly, LLM uses it for context
    return {
        "connected": connected,
        "disconnected": disconnected,
        "details": details,
    }


@tool
async def check_platform_connection(platform: str) -> dict:
    """
    Check if a specific platform is connected and ready for publishing.
    
    Args:
        platform: Platform name (instagram, facebook, linkedin, tiktok, youtube)
    
    Returns:
        dict with connected status and connection details
    """
    ctx = get_agent_context()
    if not ctx or not ctx.user_id:
        return {
            "connected": False,
            "error": "No user context available",
        }
    
    platform = platform.lower()
    if platform not in SOCIAL_PLATFORMS:
        return {
            "connected": False,
            "error": f"Unknown platform: {platform}. Valid platforms: {', '.join(SOCIAL_PLATFORMS)}",
        }
    
    connection_service = get_connection_service()
    health = await connection_service.check_connection_health(ctx.user_id, platform)
    
    return {
        "platform": platform,
        "connected": health["healthy"],
        "connection_id": health.get("connection_id"),
        "error": health.get("error"),
    }


# =============================================================================
# PUBLISH TOOLS
# =============================================================================

@tool
async def publish_to_instagram(
    caption: str,
    media_urls: List[str],
    hashtags: Optional[List[str]] = None,
) -> dict:
    """
    Publish a post to Instagram.
    
    Instagram requires at least one image or video.
    
    Args:
        caption: The post caption text (max 2200 characters)
        media_urls: List of image/video URLs to post (required, at least 1)
        hashtags: Optional list of hashtags (without # prefix, max 30)
    
    Returns:
        dict with success status, post_url, or error message
    """
    ctx = get_agent_context()
    if not ctx or not ctx.user_id:
        return {"success": False, "error": "No user context available"}
    
    if not media_urls:
        return {"success": False, "error": "Instagram requires at least one image or video"}
    
    # Get connection
    connection_service = get_connection_service()
    connection_id = await connection_service.get_connection_for_platform(ctx.user_id, "instagram")
    
    if not connection_id:
        return {
            "success": False,
            "error": "Instagram not connected. User needs to connect their Instagram account first.",
        }
    
    # Add hashtags to caption
    if hashtags:
        hashtag_text = " ".join(f"#{tag.lstrip('#')}" for tag in hashtags[:30])
        caption = f"{caption}\n\n{hashtag_text}"
    
    # Publish
    composio_client = get_composio_client()
    result = await composio_client.publish_instagram(
        user_id=ctx.user_id,
        connection_id=connection_id,
        caption=caption,
        media_urls=media_urls,
    )
    
    if result.success:
        logger.info(f"Published to Instagram: {result.post_url}")
        return {
            "success": True,
            "platform": "instagram",
            "post_id": result.post_id,
            "post_url": result.post_url,
            "message": f"Successfully published to Instagram! View at: {result.post_url}",
        }
    else:
        logger.error(f"Instagram publish failed: {result.error}")
        return {
            "success": False,
            "platform": "instagram",
            "error": result.error,
        }


@tool
async def publish_to_facebook(
    text: str,
    media_urls: Optional[List[str]] = None,
    link_url: Optional[str] = None,
) -> dict:
    """
    Publish a post to Facebook.
    
    Supports text posts, posts with images/videos, and link shares.
    
    Args:
        text: The post text content
        media_urls: Optional list of image/video URLs to attach
        link_url: Optional URL to share (creates link preview)
    
    Returns:
        dict with success status, post_url, or error message
    """
    ctx = get_agent_context()
    if not ctx or not ctx.user_id:
        return {"success": False, "error": "No user context available"}
    
    # Get connection
    connection_service = get_connection_service()
    connection_id = await connection_service.get_connection_for_platform(ctx.user_id, "facebook")
    
    if not connection_id:
        return {
            "success": False,
            "error": "Facebook not connected. User needs to connect their Facebook account first.",
        }
    
    # Publish
    composio_client = get_composio_client()
    result = await composio_client.publish_facebook(
        user_id=ctx.user_id,
        connection_id=connection_id,
        text=text,
        media_urls=media_urls,
        link_url=link_url,
    )
    
    if result.success:
        logger.info(f"Published to Facebook: {result.post_url}")
        return {
            "success": True,
            "platform": "facebook",
            "post_id": result.post_id,
            "post_url": result.post_url,
            "message": f"Successfully published to Facebook! View at: {result.post_url}",
        }
    else:
        logger.error(f"Facebook publish failed: {result.error}")
        return {
            "success": False,
            "platform": "facebook",
            "error": result.error,
        }


@tool
async def publish_to_linkedin(
    text: str,
    media_url: Optional[str] = None,
    article_url: Optional[str] = None,
) -> dict:
    """
    Publish a post to LinkedIn.
    
    Supports text posts, posts with images, and article shares.
    
    Args:
        text: The post text content (max 3000 characters)
        media_url: Optional image URL to attach
        article_url: Optional article URL to share
    
    Returns:
        dict with success status, post_url, or error message
    """
    ctx = get_agent_context()
    if not ctx or not ctx.user_id:
        return {"success": False, "error": "No user context available"}
    
    # Get connection
    connection_service = get_connection_service()
    connection_id = await connection_service.get_connection_for_platform(ctx.user_id, "linkedin")
    
    if not connection_id:
        return {
            "success": False,
            "error": "LinkedIn not connected. User needs to connect their LinkedIn account first.",
        }
    
    # Publish
    composio_client = get_composio_client()
    result = await composio_client.publish_linkedin(
        user_id=ctx.user_id,
        connection_id=connection_id,
        text=text,
        media_url=media_url,
        article_url=article_url,
    )
    
    if result.success:
        logger.info(f"Published to LinkedIn: {result.post_url}")
        return {
            "success": True,
            "platform": "linkedin",
            "post_id": result.post_id,
            "post_url": result.post_url,
            "message": f"Successfully published to LinkedIn! View at: {result.post_url}",
        }
    else:
        logger.error(f"LinkedIn publish failed: {result.error}")
        return {
            "success": False,
            "platform": "linkedin",
            "error": result.error,
        }


@tool
async def publish_to_tiktok(
    video_url: str,
    caption: str,
    hashtags: Optional[List[str]] = None,
) -> dict:
    """
    Publish a video to TikTok.
    
    TikTok requires video content.
    
    Args:
        video_url: URL of the video to upload (required)
        caption: Video caption text (max 2200 characters)
        hashtags: Optional list of hashtags (without # prefix)
    
    Returns:
        dict with success status, post_url, or error message
    """
    ctx = get_agent_context()
    if not ctx or not ctx.user_id:
        return {"success": False, "error": "No user context available"}
    
    if not video_url:
        return {"success": False, "error": "TikTok requires a video URL"}
    
    # Get connection
    connection_service = get_connection_service()
    connection_id = await connection_service.get_connection_for_platform(ctx.user_id, "tiktok")
    
    if not connection_id:
        return {
            "success": False,
            "error": "TikTok not connected. User needs to connect their TikTok account first.",
        }
    
    # Add hashtags to caption
    if hashtags:
        hashtag_text = " ".join(f"#{tag.lstrip('#')}" for tag in hashtags)
        caption = f"{caption}\n\n{hashtag_text}"
    
    # Publish
    composio_client = get_composio_client()
    result = await composio_client.publish_tiktok(
        user_id=ctx.user_id,
        connection_id=connection_id,
        video_url=video_url,
        caption=caption,
    )
    
    if result.success:
        logger.info(f"Published to TikTok: {result.post_url}")
        return {
            "success": True,
            "platform": "tiktok",
            "post_id": result.post_id,
            "post_url": result.post_url,
            "message": f"Successfully published to TikTok! View at: {result.post_url}",
        }
    else:
        logger.error(f"TikTok publish failed: {result.error}")
        return {
            "success": False,
            "platform": "tiktok",
            "error": result.error,
        }


@tool
async def publish_to_youtube(
    video_url: str,
    title: str,
    description: str,
    tags: Optional[List[str]] = None,
    visibility: str = "private",
) -> dict:
    """
    Upload a video to YouTube.
    
    Args:
        video_url: URL of the video to upload (required)
        title: Video title (max 100 characters)
        description: Video description (max 5000 characters)
        tags: Optional list of tags
        visibility: "private", "unlisted", or "public" (default: private)
    
    Returns:
        dict with success status, video_url, or error message
    """
    ctx = get_agent_context()
    if not ctx or not ctx.user_id:
        return {"success": False, "error": "No user context available"}
    
    if not video_url:
        return {"success": False, "error": "YouTube requires a video URL"}
    
    # Get connection
    connection_service = get_connection_service()
    connection_id = await connection_service.get_connection_for_platform(ctx.user_id, "youtube")
    
    if not connection_id:
        return {
            "success": False,
            "error": "YouTube not connected. User needs to connect their YouTube account first.",
        }
    
    # Publish
    composio_client = get_composio_client()
    result = await composio_client.publish_youtube(
        user_id=ctx.user_id,
        connection_id=connection_id,
        video_url=video_url,
        title=title,
        description=description,
        tags=tags,
        visibility=visibility,
    )
    
    if result.success:
        logger.info(f"Published to YouTube: {result.post_url}")
        return {
            "success": True,
            "platform": "youtube",
            "video_id": result.post_id,
            "video_url": result.post_url,
            "message": f"Successfully uploaded to YouTube! View at: {result.post_url}",
        }
    else:
        logger.error(f"YouTube upload failed: {result.error}")
        return {
            "success": False,
            "platform": "youtube",
            "error": result.error,
        }


# =============================================================================
# TASK PUBLISHING TOOL
# =============================================================================

@tool
async def publish_task(
    task_id: str,
    platforms: List[str],
) -> dict:
    """
    Publish an approved task to specified platforms.
    
    The task must be in 'approved' or 'scheduled' status.
    Uses the LangGraph workflow for resumable publishing.
    
    Args:
        task_id: UUID of the task to publish
        platforms: List of platforms to publish to (e.g., ["instagram", "linkedin"])
    
    Returns:
        dict with success status and results per platform
    """
    ctx = get_agent_context()
    if not ctx or not ctx.user_id:
        return {"success": False, "error": "No user context available"}
    
    try:
        task_uuid = UUID(task_id)
    except ValueError:
        return {"success": False, "error": f"Invalid task ID: {task_id}"}
    
    # Validate platforms
    invalid = [p for p in platforms if p.lower() not in SOCIAL_PLATFORMS]
    if invalid:
        return {
            "success": False,
            "error": f"Invalid platforms: {invalid}. Valid: {SOCIAL_PLATFORMS}",
        }
    
    # Use the publish service
    publish_service = get_publish_service()
    result = await publish_service.execute(
        task_id=task_uuid,
        platforms=[p.lower() for p in platforms],
        user_id=ctx.user_id,
    )
    
    if result.get("success"):
        return {
            "success": True,
            "status": result.get("status"),
            "results": result.get("results", {}),
            "platforms_completed": result.get("platforms_completed", []),
            "message": f"Successfully published to: {', '.join(result.get('platforms_completed', []))}",
        }
    else:
        return {
            "success": False,
            "status": result.get("status"),
            "error": result.get("error"),
            "errors": result.get("errors", {}),
        }


# =============================================================================
# INTEGRATION ACTION TOOL (Agent-to-UI)
# =============================================================================

@tool
async def request_connect_integration(platform: str, reason: str = "") -> dict:
    """
    Request user to connect a social media platform.
    
    Use this tool when you need to publish to a platform that is not connected.
    Returns an action card that the frontend renders as a "Connect" button.
    The user can click the button to connect their account without leaving the chat.
    
    Args:
        platform: Platform to connect (instagram, facebook, linkedin, tiktok, youtube)
        reason: Why the connection is needed (e.g., "to publish your post")
    
    Returns:
        Action card data that frontend renders as a connect button
    """
    platform = platform.lower()
    
    if platform not in SOCIAL_PLATFORMS:
        return {
            "success": False,
            "error": f"Unknown platform: {platform}. Valid platforms: {', '.join(SOCIAL_PLATFORMS)}",
        }
    
    # Platform display names
    platform_names = {
        "instagram": "Instagram",
        "facebook": "Facebook",
        "linkedin": "LinkedIn",
        "tiktok": "TikTok",
        "youtube": "YouTube",
    }
    
    display_name = platform_names.get(platform, platform.title())
    
    # Build the message
    if reason:
        message = f"Please connect your {display_name} account {reason}."
    else:
        message = f"Please connect your {display_name} account to continue."
    
    logger.info(f"Requesting user to connect {platform}: {reason}")
    
    return {
        "action": "connect_integration",
        "platform": platform,
        "platform_name": display_name,
        "reason": reason,
        "message": message,
        "help_text": "Click the button below to securely connect your account.",
    }


# =============================================================================
# TOOL FACTORY
# =============================================================================

def get_social_publish_tools() -> list:
    """
    Get all social publishing tools for agents.
    
    Returns list of tools:
    - get_user_social_connections
    - check_platform_connection
    - request_connect_integration
    - publish_to_instagram
    - publish_to_facebook
    - publish_to_linkedin
    - publish_to_tiktok
    - publish_to_youtube
    - publish_task
    """
    return [
        get_user_social_connections,
        check_platform_connection,
        request_connect_integration,
        publish_to_instagram,
        publish_to_facebook,
        publish_to_linkedin,
        publish_to_tiktok,
        publish_to_youtube,
        publish_task,
    ]


def get_connection_tools() -> list:
    """Get only the connection-related tools (no publish capability)."""
    return [
        get_user_social_connections,
        check_platform_connection,
        request_connect_integration,
    ]
