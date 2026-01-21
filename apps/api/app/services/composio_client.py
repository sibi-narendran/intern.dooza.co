"""
Composio Publish Client

Platform-specific publishing via Composio API.
Handles the actual API calls to social media platforms.

Each platform has its own method to handle platform-specific
requirements (e.g., media upload for Instagram, video for TikTok).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional, Any

from app.config import get_settings

logger = logging.getLogger(__name__)


# =============================================================================
# TYPES
# =============================================================================

@dataclass
class PublishResult:
    """Result of a publish operation to a single platform."""
    success: bool
    platform: str
    post_id: Optional[str] = None
    post_url: Optional[str] = None
    media_id: Optional[str] = None  # For two-step uploads
    error: Optional[str] = None
    raw_response: dict = field(default_factory=dict)
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "success": self.success,
            "platform": self.platform,
            "post_id": self.post_id,
            "post_url": self.post_url,
            "media_id": self.media_id,
            "error": self.error,
        }


@dataclass
class MediaUploadResult:
    """Result of a media upload operation."""
    success: bool
    platform: str
    media_id: Optional[str] = None
    media_url: Optional[str] = None
    error: Optional[str] = None


# =============================================================================
# COMPOSIO PUBLISH CLIENT
# =============================================================================

class ComposioPublishClient:
    """
    Platform-specific publishing via Composio.
    
    Handles the actual API calls to publish content to social media platforms.
    Each platform method handles platform-specific requirements:
    
    - Instagram: Two-step (upload media, then create post)
    - Facebook: Supports text, images, videos, and links
    - LinkedIn: Professional posts with optional media
    - TikTok: Video-only with caption
    - YouTube: Video upload with metadata
    """
    
    def __init__(self):
        self._toolset = None
    
    def _get_toolset(self):
        """Get or create Composio toolset."""
        if self._toolset is not None:
            return self._toolset
        
        settings = get_settings()
        
        if not settings.composio_api_key:
            logger.warning("COMPOSIO_API_KEY not set - publish client disabled")
            return None
        
        try:
            from composio import ComposioToolSet
            self._toolset = ComposioToolSet(api_key=settings.composio_api_key)
            logger.info("Composio toolset initialized for publishing")
            return self._toolset
        except ImportError:
            logger.error("composio-core not installed")
            return None
        except Exception as e:
            logger.error(f"Failed to init Composio toolset: {e}")
            return None
    
    async def _execute_action(
        self,
        action: str,
        params: dict,
        user_id: str,
        connection_id: Optional[str] = None,
    ) -> dict:
        """
        Execute a Composio action.
        
        Args:
            action: The Composio action name (e.g., "INSTAGRAM_CREATE_MEDIA_POST")
            params: Parameters for the action
            user_id: The user ID (will be converted to entity_id: "user_{user_id}")
            connection_id: Optional specific connection ID to use
            
        Returns:
            Response from Composio
        """
        toolset = self._get_toolset()
        
        if not toolset:
            return {"error": "Composio not configured"}
        
        try:
            # Entity ID is how Composio identifies the user's connections
            entity_id = f"user_{user_id}"
            
            # Build execute params
            execute_params = {
                "action": action,
                "params": params,
                "entity_id": entity_id,
            }
            
            # If specific connection_id provided, use it
            if connection_id:
                execute_params["connected_account_id"] = connection_id
            
            # Execute the action via Composio
            response = toolset.execute_action(**execute_params)
            return response
        except Exception as e:
            logger.error(f"Composio action {action} failed: {e}")
            return {"error": str(e)}
    
    # =========================================================================
    # INSTAGRAM
    # =========================================================================
    
    async def upload_instagram_media(
        self,
        user_id: str,
        connection_id: str,
        media_url: str,
        media_type: str = "IMAGE",
    ) -> MediaUploadResult:
        """
        Upload media to Instagram (step 1 of two-step process).
        
        Args:
            user_id: User's ID
            connection_id: User's Instagram connection ID
            media_url: URL of the media to upload
            media_type: "IMAGE" or "VIDEO"
            
        Returns:
            MediaUploadResult with media_id for creating the post
        """
        try:
            response = await self._execute_action(
                action="INSTAGRAM_UPLOAD_MEDIA",
                params={
                    "image_url": media_url,
                    "media_type": media_type,
                },
                user_id=user_id,
                connection_id=connection_id,
            )
            
            if "error" in response:
                return MediaUploadResult(
                    success=False,
                    platform="instagram",
                    error=response["error"],
                )
            
            media_id = response.get("media_id") or response.get("id")
            
            return MediaUploadResult(
                success=True,
                platform="instagram",
                media_id=media_id,
            )
            
        except Exception as e:
            logger.error(f"Instagram media upload failed: {e}")
            return MediaUploadResult(
                success=False,
                platform="instagram",
                error=str(e),
            )
    
    async def publish_instagram(
        self,
        user_id: str,
        connection_id: str,
        caption: str,
        media_urls: list[str],
        media_ids: Optional[list[str]] = None,
    ) -> PublishResult:
        """
        Publish to Instagram.
        
        Instagram requires media - at least one image or video.
        If media_ids not provided, uploads media first.
        
        Args:
            user_id: User's ID
            connection_id: User's Instagram connection ID
            caption: Post caption
            media_urls: URLs of media to post
            media_ids: Pre-uploaded media IDs (optional)
            
        Returns:
            PublishResult with post details
        """
        try:
            # If no pre-uploaded media IDs, upload first
            if not media_ids:
                media_ids = []
                for url in media_urls:
                    result = await self.upload_instagram_media(user_id, connection_id, url)
                    if not result.success:
                        return PublishResult(
                            success=False,
                            platform="instagram",
                            error=f"Media upload failed: {result.error}",
                        )
                    media_ids.append(result.media_id)
            
            # Create the post with uploaded media
            response = await self._execute_action(
                action="INSTAGRAM_CREATE_MEDIA_POST",
                params={
                    "caption": caption,
                    "media_ids": media_ids,
                },
                user_id=user_id,
                connection_id=connection_id,
            )
            
            if "error" in response:
                return PublishResult(
                    success=False,
                    platform="instagram",
                    error=response["error"],
                    raw_response=response,
                )
            
            post_id = response.get("id") or response.get("post_id")
            post_url = response.get("permalink") or response.get("url")
            
            logger.info(f"Published to Instagram: {post_id}")
            
            return PublishResult(
                success=True,
                platform="instagram",
                post_id=post_id,
                post_url=post_url,
                raw_response=response,
            )
            
        except Exception as e:
            logger.error(f"Instagram publish failed: {e}")
            return PublishResult(
                success=False,
                platform="instagram",
                error=str(e),
            )
    
    # =========================================================================
    # FACEBOOK
    # =========================================================================
    
    async def publish_facebook(
        self,
        user_id: str,
        connection_id: str,
        text: str,
        media_urls: Optional[list[str]] = None,
        link_url: Optional[str] = None,
    ) -> PublishResult:
        """
        Publish to Facebook.
        
        Supports text posts, posts with images/videos, and link shares.
        
        Args:
            user_id: User's ID
            connection_id: User's Facebook connection ID
            text: Post text content
            media_urls: Optional media URLs to attach
            link_url: Optional URL to share (creates link preview)
            
        Returns:
            PublishResult with post details
        """
        try:
            params = {"message": text}
            
            if link_url:
                params["link"] = link_url
            
            if media_urls:
                # For now, use first media URL
                # Facebook API handles multiple photos differently
                params["url"] = media_urls[0]
            
            action = "FACEBOOK_CREATE_POST"
            if media_urls:
                action = "FACEBOOK_CREATE_PHOTO_POST"
            
            response = await self._execute_action(
                action=action,
                params=params,
                user_id=user_id,
                connection_id=connection_id,
            )
            
            if "error" in response:
                return PublishResult(
                    success=False,
                    platform="facebook",
                    error=response["error"],
                    raw_response=response,
                )
            
            post_id = response.get("id") or response.get("post_id")
            post_url = response.get("permalink_url") or response.get("url")
            
            logger.info(f"Published to Facebook: {post_id}")
            
            return PublishResult(
                success=True,
                platform="facebook",
                post_id=post_id,
                post_url=post_url,
                raw_response=response,
            )
            
        except Exception as e:
            logger.error(f"Facebook publish failed: {e}")
            return PublishResult(
                success=False,
                platform="facebook",
                error=str(e),
            )
    
    # =========================================================================
    # LINKEDIN
    # =========================================================================
    
    async def publish_linkedin(
        self,
        user_id: str,
        connection_id: str,
        text: str,
        media_url: Optional[str] = None,
        article_url: Optional[str] = None,
    ) -> PublishResult:
        """
        Publish to LinkedIn.
        
        Supports text posts, posts with images, and article shares.
        
        Args:
            user_id: User's ID
            connection_id: User's LinkedIn connection ID
            text: Post text content
            media_url: Optional image URL to attach
            article_url: Optional article URL to share
            
        Returns:
            PublishResult with post details
        """
        try:
            params = {"text": text}
            
            if article_url:
                params["article_url"] = article_url
            
            if media_url:
                params["image_url"] = media_url
            
            response = await self._execute_action(
                action="LINKEDIN_CREATE_POST",
                params=params,
                user_id=user_id,
                connection_id=connection_id,
            )
            
            if "error" in response:
                return PublishResult(
                    success=False,
                    platform="linkedin",
                    error=response["error"],
                    raw_response=response,
                )
            
            post_id = response.get("id") or response.get("post_id")
            post_url = response.get("url")
            
            logger.info(f"Published to LinkedIn: {post_id}")
            
            return PublishResult(
                success=True,
                platform="linkedin",
                post_id=post_id,
                post_url=post_url,
                raw_response=response,
            )
            
        except Exception as e:
            logger.error(f"LinkedIn publish failed: {e}")
            return PublishResult(
                success=False,
                platform="linkedin",
                error=str(e),
            )
    
    # =========================================================================
    # TIKTOK
    # =========================================================================
    
    async def publish_tiktok(
        self,
        user_id: str,
        connection_id: str,
        video_url: str,
        caption: str,
    ) -> PublishResult:
        """
        Publish to TikTok.
        
        TikTok requires video content.
        
        Args:
            user_id: User's ID
            connection_id: User's TikTok connection ID
            video_url: URL of the video to upload
            caption: Video caption
            
        Returns:
            PublishResult with post details
        """
        try:
            response = await self._execute_action(
                action="TIKTOK_UPLOAD_VIDEO",
                params={
                    "video_url": video_url,
                    "caption": caption,
                },
                user_id=user_id,
                connection_id=connection_id,
            )
            
            if "error" in response:
                return PublishResult(
                    success=False,
                    platform="tiktok",
                    error=response["error"],
                    raw_response=response,
                )
            
            post_id = response.get("id") or response.get("video_id")
            post_url = response.get("share_url") or response.get("url")
            
            logger.info(f"Published to TikTok: {post_id}")
            
            return PublishResult(
                success=True,
                platform="tiktok",
                post_id=post_id,
                post_url=post_url,
                raw_response=response,
            )
            
        except Exception as e:
            logger.error(f"TikTok publish failed: {e}")
            return PublishResult(
                success=False,
                platform="tiktok",
                error=str(e),
            )
    
    # =========================================================================
    # YOUTUBE
    # =========================================================================
    
    async def publish_youtube(
        self,
        user_id: str,
        connection_id: str,
        video_url: str,
        title: str,
        description: str,
        tags: Optional[list[str]] = None,
        visibility: str = "private",
    ) -> PublishResult:
        """
        Publish to YouTube.
        
        Uploads a video with metadata.
        
        Args:
            user_id: User's ID
            connection_id: User's YouTube connection ID
            video_url: URL of the video to upload
            title: Video title
            description: Video description
            tags: Optional list of tags
            visibility: "private", "unlisted", or "public"
            
        Returns:
            PublishResult with video details
        """
        try:
            params = {
                "video_url": video_url,
                "title": title,
                "description": description,
                "privacy_status": visibility,
            }
            
            if tags:
                params["tags"] = tags
            
            response = await self._execute_action(
                action="YOUTUBE_UPLOAD_VIDEO",
                params=params,
                user_id=user_id,
                connection_id=connection_id,
            )
            
            if "error" in response:
                return PublishResult(
                    success=False,
                    platform="youtube",
                    error=response["error"],
                    raw_response=response,
                )
            
            video_id = response.get("id") or response.get("video_id")
            video_url = f"https://youtube.com/watch?v={video_id}" if video_id else None
            
            logger.info(f"Published to YouTube: {video_id}")
            
            return PublishResult(
                success=True,
                platform="youtube",
                post_id=video_id,
                post_url=video_url,
                raw_response=response,
            )
            
        except Exception as e:
            logger.error(f"YouTube publish failed: {e}")
            return PublishResult(
                success=False,
                platform="youtube",
                error=str(e),
            )
    
    # =========================================================================
    # GENERIC PUBLISH
    # =========================================================================
    
    async def publish(
        self,
        platform: str,
        user_id: str,
        connection_id: str,
        content: dict,
        media_ids: Optional[dict[str, str]] = None,
    ) -> PublishResult:
        """
        Generic publish method that routes to platform-specific publishers.
        
        Args:
            platform: Platform name (instagram, facebook, etc.)
            user_id: User's ID
            connection_id: User's connection ID for the platform
            content: Content dict with platform-specific fields
            media_ids: Pre-uploaded media IDs (optional)
            
        Returns:
            PublishResult from the platform-specific publisher
        """
        platform = platform.lower()
        
        if platform == "instagram":
            return await self.publish_instagram(
                user_id=user_id,
                connection_id=connection_id,
                caption=content.get("caption", ""),
                media_urls=content.get("media_urls", []),
                media_ids=media_ids.get("instagram") if media_ids else None,
            )
        
        elif platform == "facebook":
            return await self.publish_facebook(
                user_id=user_id,
                connection_id=connection_id,
                text=content.get("text", ""),
                media_urls=content.get("media_urls"),
                link_url=content.get("link_url"),
            )
        
        elif platform == "linkedin":
            return await self.publish_linkedin(
                user_id=user_id,
                connection_id=connection_id,
                text=content.get("text", ""),
                media_url=content.get("media_url"),
                article_url=content.get("article_url"),
            )
        
        elif platform == "tiktok":
            return await self.publish_tiktok(
                user_id=user_id,
                connection_id=connection_id,
                video_url=content.get("video_url", ""),
                caption=content.get("caption", ""),
            )
        
        elif platform == "youtube":
            return await self.publish_youtube(
                user_id=user_id,
                connection_id=connection_id,
                video_url=content.get("video_url", ""),
                title=content.get("title", ""),
                description=content.get("description", ""),
                tags=content.get("tags"),
                visibility=content.get("visibility", "private"),
            )
        
        else:
            return PublishResult(
                success=False,
                platform=platform,
                error=f"Unsupported platform: {platform}",
            )


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_composio_client: Optional[ComposioPublishClient] = None


def get_composio_client() -> ComposioPublishClient:
    """Get or create the Composio publish client singleton."""
    global _composio_client
    if _composio_client is None:
        _composio_client = ComposioPublishClient()
    return _composio_client
