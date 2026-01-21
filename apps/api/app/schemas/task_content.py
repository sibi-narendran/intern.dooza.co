"""
Task Content Validation Schemas

Pydantic models for validating task content payloads.
Prevents schema drift between agents and frontend UI.

Each task_type has a corresponding schema that defines required fields.
Unknown task types pass through validation (for extensibility).
"""

from __future__ import annotations

from typing import Optional, Any
from pydantic import BaseModel, Field, field_validator


# =============================================================================
# SEO DOMAIN CONTENT SCHEMAS
# =============================================================================

class BlogPostContent(BaseModel):
    """
    Schema for blog_post task type.
    
    Used by SEOmi to create SEO-optimized blog posts.
    """
    title: str = Field(
        ..., 
        min_length=1, 
        max_length=200,
        description="Blog post title (also used as H1)"
    )
    body: str = Field(
        ..., 
        min_length=1,
        description="Full blog post content in markdown"
    )
    keywords: list[str] = Field(
        default_factory=list,
        description="Target SEO keywords"
    )
    meta_description: Optional[str] = Field(
        None, 
        max_length=160,
        description="Meta description for search results"
    )
    featured_image_url: Optional[str] = Field(
        None,
        description="URL of the featured image"
    )
    slug: Optional[str] = Field(
        None,
        description="URL slug for the post"
    )
    
    @field_validator('keywords', mode='before')
    @classmethod
    def ensure_keywords_list(cls, v: Any) -> list[str]:
        """Ensure keywords is always a list."""
        if v is None:
            return []
        if isinstance(v, str):
            # Handle comma-separated string
            return [k.strip() for k in v.split(',') if k.strip()]
        return list(v)


class ContentBriefContent(BaseModel):
    """
    Schema for content_brief task type.
    
    Used by SEOmi to create content briefs for writers.
    """
    topic: str = Field(..., min_length=1, description="Main topic")
    target_keyword: str = Field(..., min_length=1, description="Primary keyword to target")
    secondary_keywords: list[str] = Field(default_factory=list)
    target_word_count: int = Field(default=1500, gt=0)
    outline: list[str] = Field(default_factory=list, description="Suggested headings/sections")
    competitor_urls: list[str] = Field(default_factory=list)
    notes: Optional[str] = None


# =============================================================================
# SOCIAL DOMAIN CONTENT SCHEMAS
# =============================================================================

class TweetContent(BaseModel):
    """
    Schema for tweet task type.
    
    Used by Soshie to create Twitter/X posts.
    """
    text: str = Field(
        ..., 
        min_length=1, 
        max_length=280,
        description="Tweet text content"
    )
    hashtags: list[str] = Field(
        default_factory=list,
        description="Hashtags (without # prefix)"
    )
    media_url: Optional[str] = Field(
        None,
        description="URL of attached media"
    )
    thread_position: Optional[int] = Field(
        None,
        ge=1,
        description="Position in thread (1 = first tweet)"
    )
    
    @field_validator('hashtags', mode='before')
    @classmethod
    def clean_hashtags(cls, v: Any) -> list[str]:
        """Remove # prefix if present and ensure list."""
        if v is None:
            return []
        if isinstance(v, str):
            v = [v]
        return [tag.lstrip('#').strip() for tag in v if tag.strip()]


class SocialPostContent(BaseModel):
    """
    Schema for generic social_post task type.
    
    Platform-agnostic social media post.
    """
    platform: str = Field(
        ..., 
        description="Target platform (twitter, instagram, linkedin, facebook)"
    )
    text: str = Field(
        ..., 
        min_length=1,
        description="Post content"
    )
    hashtags: list[str] = Field(default_factory=list)
    media_urls: list[str] = Field(default_factory=list)
    scheduled_time: Optional[str] = Field(
        None, 
        description="ISO datetime for scheduling"
    )
    
    @field_validator('platform')
    @classmethod
    def validate_platform(cls, v: str) -> str:
        """Ensure platform is valid."""
        valid = {'twitter', 'instagram', 'linkedin', 'facebook', 'threads'}
        if v.lower() not in valid:
            raise ValueError(f"Platform must be one of: {', '.join(valid)}")
        return v.lower()


class LinkedInPostContent(BaseModel):
    """Schema for linkedin_post task type."""
    text: str = Field(..., min_length=1, max_length=3000)
    hashtags: list[str] = Field(default_factory=list)
    media_url: Optional[str] = None
    article_url: Optional[str] = Field(None, description="URL to shared article")


class InstagramPostContent(BaseModel):
    """
    Schema for instagram_post task type.
    
    Used by Soshie to create Instagram posts.
    Instagram requires at least one image or video.
    """
    caption: str = Field(
        ..., 
        min_length=1, 
        max_length=2200,
        description="Instagram caption text"
    )
    media_urls: list[str] = Field(
        ..., 
        min_length=1,
        description="At least one image/video URL required for Instagram"
    )
    hashtags: list[str] = Field(
        default_factory=list,
        description="Hashtags (without # prefix), max 30"
    )
    alt_text: Optional[str] = Field(
        None, 
        max_length=100,
        description="Alt text for accessibility"
    )
    location: Optional[str] = Field(
        None,
        description="Location tag for the post"
    )
    
    @field_validator('hashtags', mode='before')
    @classmethod
    def clean_instagram_hashtags(cls, v: Any) -> list[str]:
        """Remove # prefix and limit to 30 hashtags."""
        if v is None:
            return []
        if isinstance(v, str):
            v = [v]
        cleaned = [tag.lstrip('#').strip() for tag in v if tag.strip()]
        return cleaned[:30]  # Instagram max 30 hashtags


class FacebookPostContent(BaseModel):
    """
    Schema for facebook_post task type.
    
    Used by Soshie to create Facebook posts.
    Supports text, images, videos, and link sharing.
    """
    text: str = Field(
        ..., 
        min_length=1, 
        max_length=63206,
        description="Post text content"
    )
    media_urls: list[str] = Field(
        default_factory=list,
        description="Image or video URLs to attach"
    )
    link_url: Optional[str] = Field(
        None,
        description="URL to share (creates link preview)"
    )
    hashtags: list[str] = Field(
        default_factory=list,
        description="Hashtags (sparingly, 1-2 max for Facebook)"
    )
    
    @field_validator('hashtags', mode='before')
    @classmethod
    def clean_facebook_hashtags(cls, v: Any) -> list[str]:
        """Remove # prefix if present."""
        if v is None:
            return []
        if isinstance(v, str):
            v = [v]
        return [tag.lstrip('#').strip() for tag in v if tag.strip()]


class TikTokPostContent(BaseModel):
    """
    Schema for tiktok_post task type.
    
    Used by Soshie to create TikTok posts.
    TikTok requires video content.
    """
    caption: str = Field(
        ..., 
        min_length=1, 
        max_length=2200,
        description="Video caption text"
    )
    video_url: str = Field(
        ...,
        description="Video URL (required - TikTok is video-only)"
    )
    hashtags: list[str] = Field(
        default_factory=list,
        description="Hashtags for discoverability"
    )
    sounds: Optional[str] = Field(
        None,
        description="Sound/music to use (if applicable)"
    )
    cover_time: Optional[float] = Field(
        None,
        ge=0,
        description="Timestamp (seconds) for cover image"
    )
    
    @field_validator('hashtags', mode='before')
    @classmethod
    def clean_tiktok_hashtags(cls, v: Any) -> list[str]:
        """Remove # prefix if present."""
        if v is None:
            return []
        if isinstance(v, str):
            v = [v]
        return [tag.lstrip('#').strip() for tag in v if tag.strip()]


class YouTubeVideoContent(BaseModel):
    """
    Schema for youtube_video task type.
    
    Used by Soshie/Vidi to publish YouTube videos.
    """
    title: str = Field(
        ..., 
        min_length=1, 
        max_length=100,
        description="Video title"
    )
    description: str = Field(
        ..., 
        min_length=1, 
        max_length=5000,
        description="Video description"
    )
    video_url: str = Field(
        ...,
        description="Video file URL to upload"
    )
    tags: list[str] = Field(
        default_factory=list,
        description="Video tags for SEO (max 500 chars total)"
    )
    visibility: str = Field(
        default="private",
        description="Video visibility: private, unlisted, or public"
    )
    thumbnail_url: Optional[str] = Field(
        None,
        description="Custom thumbnail image URL"
    )
    category_id: Optional[str] = Field(
        None,
        description="YouTube category ID"
    )
    playlist_id: Optional[str] = Field(
        None,
        description="Playlist to add the video to"
    )
    
    @field_validator('visibility')
    @classmethod
    def validate_visibility(cls, v: str) -> str:
        """Ensure visibility is valid."""
        valid = {'private', 'unlisted', 'public'}
        if v.lower() not in valid:
            raise ValueError(f"Visibility must be one of: {', '.join(valid)}")
        return v.lower()
    
    @field_validator('tags', mode='before')
    @classmethod
    def clean_youtube_tags(cls, v: Any) -> list[str]:
        """Ensure tags is a list."""
        if v is None:
            return []
        if isinstance(v, str):
            return [t.strip() for t in v.split(',') if t.strip()]
        return [str(tag).strip() for tag in v if str(tag).strip()]


# =============================================================================
# VIDEO DOMAIN CONTENT SCHEMAS
# =============================================================================

class VideoScene(BaseModel):
    """Single scene in a video script."""
    timestamp: str = Field(..., description="Start time (e.g., '0:00')")
    visual: str = Field(..., description="What's shown on screen")
    narration: Optional[str] = Field(None, description="Voiceover text")
    notes: Optional[str] = Field(None, description="Production notes")


class VideoScriptContent(BaseModel):
    """
    Schema for video_script task type.
    
    Used by Vidi to create video scripts.
    """
    title: str = Field(..., min_length=1, description="Video title")
    hook: str = Field(
        ..., 
        min_length=1,
        description="Opening hook (first 5 seconds)"
    )
    scenes: list[dict] = Field(
        ..., 
        min_length=1,
        description="List of scenes with timestamp, visual, narration"
    )
    duration_seconds: int = Field(
        ..., 
        gt=0,
        description="Target video duration in seconds"
    )
    cta: Optional[str] = Field(
        None,
        description="Call to action at the end"
    )
    thumbnail_concept: Optional[str] = Field(
        None,
        description="Thumbnail design concept"
    )


# =============================================================================
# DATA DOMAIN CONTENT SCHEMAS
# =============================================================================

class ReportContent(BaseModel):
    """Schema for report task type."""
    title: str = Field(..., min_length=1)
    summary: str = Field(..., min_length=1)
    sections: list[dict] = Field(default_factory=list)
    data_sources: list[str] = Field(default_factory=list)
    generated_at: Optional[str] = None


# =============================================================================
# CONTENT SCHEMA REGISTRY
# =============================================================================

CONTENT_SCHEMAS: dict[str, type[BaseModel]] = {
    # SEO domain
    'blog_post': BlogPostContent,
    'content_brief': ContentBriefContent,
    # Social domain
    'tweet': TweetContent,
    'social_post': SocialPostContent,
    'linkedin_post': LinkedInPostContent,
    'instagram_post': InstagramPostContent,
    'facebook_post': FacebookPostContent,
    'tiktok_post': TikTokPostContent,
    'youtube_video': YouTubeVideoContent,
    # Video domain
    'video_script': VideoScriptContent,
    # Data domain
    'report': ReportContent,
}


def get_content_schema(task_type: str) -> type[BaseModel] | None:
    """
    Get the Pydantic schema for a task type.
    
    Returns None if task type is unknown (allows extensibility).
    """
    return CONTENT_SCHEMAS.get(task_type)


def validate_task_content(task_type: str, content: dict) -> dict:
    """
    Validate content against schema for the given task type.
    
    Args:
        task_type: The type of task (e.g., 'blog_post', 'tweet')
        content: The content payload to validate
        
    Returns:
        Validated and normalized content dict
        
    Raises:
        pydantic.ValidationError: If content doesn't match schema
        
    Note:
        Unknown task types pass through without validation.
        This allows adding new task types without updating this registry.
    """
    schema = CONTENT_SCHEMAS.get(task_type)
    if schema:
        validated = schema.model_validate(content)
        return validated.model_dump()
    # Unknown task types pass through (extensibility)
    return content
