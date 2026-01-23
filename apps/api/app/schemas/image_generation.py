"""
Image Generation Schema Models

Pydantic models for communication between Soshie and the Image Generation subagent.
These define the structured contract for image generation requests and results.

Usage:
    from app.schemas.image_generation import ImageGenerationResult, ImageStyle
    
    result = ImageGenerationResult(
        status="success",
        image_url="https://...",
        prompt_used="A professional...",
        ...
    )
"""

from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# =============================================================================
# ENUMS
# =============================================================================

class ImageStyle(str, Enum):
    """Image generation styles supported by the subagent."""
    photo_realistic = "photo_realistic"
    illustration = "illustration"
    infographic = "infographic"
    quote_card = "quote_card"
    product_shot = "product_shot"
    lifestyle = "lifestyle"
    abstract = "abstract"
    minimal = "minimal"
    cartoon = "cartoon"
    artistic = "artistic"


class ImageStatus(str, Enum):
    """Status of image generation request."""
    success = "success"
    pending = "pending"
    stub = "stub"
    error = "error"


class AspectRatio(str, Enum):
    """Common aspect ratios for social media."""
    square = "1:1"           # Instagram feed, LinkedIn
    portrait = "4:5"         # Instagram portrait
    story = "9:16"           # Stories, Reels, TikTok
    landscape = "16:9"       # YouTube, Twitter
    wide = "1.91:1"          # Facebook/LinkedIn link preview


# =============================================================================
# SUB-MODELS
# =============================================================================

class BrandVisuals(BaseModel):
    """Brand visual identity from knowledge base."""
    brand_name: str = Field(default="Your Brand", description="Brand name")
    primary_color: Optional[str] = Field(None, description="Primary brand color hex")
    secondary_color: Optional[str] = Field(None, description="Secondary brand color hex")
    accent_color: Optional[str] = Field(None, description="Accent color hex")
    logo_url: Optional[str] = Field(None, description="URL to brand logo")
    font_style: str = Field(default="modern", description="Font style: modern, classic, playful")
    visual_tone: str = Field(
        default="professional", 
        description="Visual tone: professional, casual, bold, minimal"
    )


class OptimizedPrompt(BaseModel):
    """An optimized prompt for image generation."""
    prompt: str = Field(..., description="The full optimized prompt")
    negative_prompt: Optional[str] = Field(
        None, 
        description="What to avoid in the image"
    )
    style_keywords: List[str] = Field(
        default_factory=list,
        description="Style keywords applied"
    )
    platform_optimizations: str = Field(
        default="",
        description="Platform-specific adjustments made"
    )


# =============================================================================
# MAIN RESULT MODEL
# =============================================================================

class ImageGenerationResult(BaseModel):
    """
    Complete result from the Image Generation subagent.
    
    This is the structured contract between Image Gen and Soshie.
    """
    # Status
    status: ImageStatus = Field(..., description="Generation status")
    
    # Result (if successful)
    image_url: Optional[str] = Field(
        None, 
        description="URL to generated image (None if stub/error)"
    )
    thumbnail_url: Optional[str] = Field(
        None,
        description="URL to thumbnail version"
    )
    
    # Generation details
    prompt_used: str = Field(..., description="The prompt used for generation")
    negative_prompt: Optional[str] = Field(None, description="Negative prompt if used")
    style: ImageStyle = Field(
        default=ImageStyle.photo_realistic,
        description="Style applied"
    )
    aspect_ratio: str = Field(default="1:1", description="Aspect ratio of image")
    
    # Platform info
    platform: str = Field(default="instagram", description="Target platform")
    dimensions: Optional[str] = Field(
        None, 
        description="Actual dimensions (e.g., '1080x1080')"
    )
    
    # Brand consistency
    brand_colors_used: bool = Field(
        default=False,
        description="Whether brand colors were incorporated"
    )
    
    # Message for user
    message: str = Field(..., description="Human-readable status message")
    
    # API readiness flag (for stub implementation)
    ready_for_api: bool = Field(
        default=True,
        description="Flag indicating this is ready for real API integration"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "stub",
                "image_url": None,
                "prompt_used": "A professional LinkedIn post image showing a person working with AI assistants, modern office setting, clean aesthetic, corporate blue tones, 4K quality",
                "negative_prompt": "low quality, blurry, text, watermark",
                "style": "photo_realistic",
                "aspect_ratio": "1:1",
                "platform": "linkedin",
                "dimensions": "1080x1080",
                "brand_colors_used": True,
                "message": "Image generation is under development. Here's the optimized prompt that would be used.",
                "ready_for_api": True,
            }
        }


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_platform_dimensions(platform: str, aspect_ratio: str = "1:1") -> str:
    """Get recommended dimensions for a platform."""
    platform_dims = {
        "instagram": {
            "1:1": "1080x1080",
            "4:5": "1080x1350",
            "9:16": "1080x1920",
        },
        "linkedin": {
            "1:1": "1080x1080",
            "16:9": "1200x627",
            "1.91:1": "1200x628",
        },
        "twitter": {
            "16:9": "1600x900",
            "1:1": "1080x1080",
            "1.91:1": "800x418",
        },
        "facebook": {
            "16:9": "1200x630",
            "1:1": "1080x1080",
            "9:16": "1080x1920",
        },
        "tiktok": {
            "9:16": "1080x1920",
        },
    }
    
    platform_data = platform_dims.get(platform.lower(), platform_dims["instagram"])
    return platform_data.get(aspect_ratio, "1080x1080")


def create_stub_result(
    prompt: str,
    style: ImageStyle = ImageStyle.photo_realistic,
    platform: str = "instagram",
    aspect_ratio: str = "1:1",
) -> ImageGenerationResult:
    """Create a stub result for development/testing."""
    return ImageGenerationResult(
        status=ImageStatus.stub,
        image_url=None,
        prompt_used=prompt,
        style=style,
        aspect_ratio=aspect_ratio,
        platform=platform,
        dimensions=get_platform_dimensions(platform, aspect_ratio),
        message=(
            f"Image generation is under development. "
            f"Here's the optimized prompt for {platform}: {prompt[:100]}..."
        ),
        ready_for_api=True,
    )
