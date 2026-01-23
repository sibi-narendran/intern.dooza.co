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
from typing import Optional

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
    filtered = "filtered"  # Blocked by safety filters


class ImageProvider(str, Enum):
    """Image generation provider/backend."""
    openrouter = "openrouter"          # OpenRouter API (recommended)
    vertex_ai = "vertex_ai"            # Google Vertex AI (enterprise)
    google_ai_studio = "google_ai_studio"  # Google AI Studio (API key)
    stub = "stub"                       # No provider configured


class AspectRatio(str, Enum):
    """Common aspect ratios for social media."""
    square = "1:1"           # Instagram feed, LinkedIn
    portrait = "4:5"         # Instagram portrait
    story = "9:16"           # Stories, Reels, TikTok
    landscape = "16:9"       # YouTube, Twitter
    wide = "1.91:1"          # Facebook/LinkedIn link preview


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
    image_data_url: Optional[str] = Field(
        None,
        description="Base64 data URL for direct embedding (data:image/png;base64,...)"
    )
    thumbnail_url: Optional[str] = Field(
        None,
        description="URL to thumbnail version"
    )
    
    # Generation details
    prompt_used: str = Field(..., description="The prompt used for generation")
    enhanced_prompt: Optional[str] = Field(
        None, 
        description="LLM-enhanced version of the prompt (if enhancement was used)"
    )
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
    
    # Provider info
    provider: Optional[ImageProvider] = Field(
        None,
        description="The backend used for generation (vertex_ai, google_ai_studio, stub)"
    )
    model: Optional[str] = Field(
        None,
        description="The model used (e.g., gemini-3-pro-image-preview)"
    )
    
    # Brand consistency
    brand_colors_used: bool = Field(
        default=False,
        description="Whether brand colors were incorporated"
    )
    
    # Message for user
    message: str = Field(..., description="Human-readable status message")
    
    # API readiness flag (kept for backwards compatibility)
    ready_for_api: bool = Field(
        default=True,
        description="Flag indicating API is configured and ready"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "success",
                "image_url": None,
                "image_data_url": "data:image/png;base64,iVBORw0KGgo...",
                "prompt_used": "A professional LinkedIn post image, modern office, clean aesthetic",
                "style": "photo_realistic",
                "aspect_ratio": "1:1",
                "platform": "linkedin",
                "dimensions": "1080x1080",
                "provider": "openrouter",
                "model": "google/gemini-3-pro-image-preview",
                "message": "Image generated successfully using Nano Banana Pro.",
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
