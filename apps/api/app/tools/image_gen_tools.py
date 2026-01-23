"""
Image Generation Tools for the Image Generation Subagent

These tools are used autonomously by the Image Generation subagent to:
1. Load brand visual identity
2. Create optimized prompts
3. Generate images (stub for now)

Tools:
- get_brand_visuals: Load brand colors, fonts, logo from knowledge base
- generate_image_prompt: Create an optimized prompt for image generation
- create_image: Generate the actual image (stub - ready for API integration)

Usage:
    These tools are registered with the Image Generation subagent, not Soshie directly.
    The subagent decides when and how to call them.
"""

from __future__ import annotations

import logging
from typing import Optional

from langchain_core.tools import tool

from app.tools.task import get_agent_context

logger = logging.getLogger(__name__)


# =============================================================================
# PLATFORM SPECIFICATIONS
# =============================================================================

PLATFORM_SPECS = {
    "instagram": {
        "recommended_ratio": "1:1",
        "dimensions": "1080x1080",
        "style_notes": "Vibrant, eye-catching, high contrast, lifestyle-focused",
        "avoid": "Too much text, corporate look, low saturation",
    },
    "linkedin": {
        "recommended_ratio": "1:1",
        "dimensions": "1080x1080",
        "style_notes": "Professional, clean, corporate-friendly, trustworthy",
        "avoid": "Overly casual, too playful, complex backgrounds",
    },
    "twitter": {
        "recommended_ratio": "16:9",
        "dimensions": "1600x900",
        "style_notes": "Bold, attention-grabbing, simple composition, contrast",
        "avoid": "Subtle details that get lost, too much text",
    },
    "facebook": {
        "recommended_ratio": "16:9",
        "dimensions": "1200x630",
        "style_notes": "Warm, inviting, community-focused, authentic",
        "avoid": "Cold/sterile look, overly promotional",
    },
    "tiktok": {
        "recommended_ratio": "9:16",
        "dimensions": "1080x1920",
        "style_notes": "Trendy, dynamic, youthful, entertaining",
        "avoid": "Static, boring, overly polished",
    },
}

STYLE_PROMPTS = {
    "photo_realistic": "photorealistic, 8k, high detail, professional photography, studio lighting",
    "illustration": "digital illustration, vector art style, clean lines, modern design",
    "infographic": "infographic style, data visualization, clean layout, icons, minimal",
    "quote_card": "quote card design, typography focus, elegant background, minimal",
    "product_shot": "product photography, studio lighting, white background, commercial quality",
    "lifestyle": "lifestyle photography, natural lighting, authentic moment, candid",
    "abstract": "abstract art, geometric shapes, modern art, creative composition",
    "minimal": "minimalist design, negative space, simple, elegant, clean",
    "cartoon": "cartoon style, animated, fun, colorful, character design",
    "artistic": "artistic, painterly, creative, unique composition, expressive",
}


# =============================================================================
# BRAND VISUALS TOOL
# =============================================================================

@tool
async def get_brand_visuals() -> dict:
    """
    Load brand visual identity from the knowledge base.
    
    Call this first if you need to ensure brand consistency in the generated image.
    Returns brand colors, fonts, logo URL, and visual tone.
    
    Returns:
        dict with:
        - brand_name: Business name
        - primary_color: Primary brand color (hex)
        - secondary_color: Secondary brand color (hex)
        - accent_color: Accent color (hex)
        - logo_url: URL to brand logo (if available)
        - font_style: Font style preference (modern, classic, playful)
        - visual_tone: Visual tone (professional, casual, bold, minimal)
    """
    from app.services.knowledge_service import get_knowledge_service
    
    ctx = get_agent_context()
    if not ctx:
        logger.warning("No agent context - returning default brand visuals")
        return {
            "error": "no_context",
            "brand_name": "Your Brand",
            "primary_color": "#2563EB",  # Default blue
            "secondary_color": "#1E40AF",
            "accent_color": "#F59E0B",
            "visual_tone": "professional",
        }
    
    user_id = ctx.user_id
    service = get_knowledge_service()
    
    try:
        org_id = await service.get_user_org_id(user_id)
        if not org_id:
            return {
                "error": "no_organization",
                "message": "No organization found. Using default brand visuals.",
                "brand_name": "Your Brand",
                "primary_color": "#2563EB",
                "visual_tone": "professional",
            }
        
        brand = await service.get_brand_settings(org_id)
        colors = brand.colors or {}
        
        return {
            "brand_name": brand.business_name or "Your Brand",
            "primary_color": colors.get("primary", "#2563EB"),
            "secondary_color": colors.get("secondary"),
            "accent_color": colors.get("accent") or colors.get("tertiary"),
            "logo_url": None,  # TODO: Get from brand assets
            "font_style": "modern",  # TODO: Store in brand settings
            "visual_tone": brand.brand_voice or "professional",
            "industry": brand.industry,
            "tagline": brand.tagline,
        }
        
    except Exception as e:
        logger.error(f"Failed to load brand visuals: {e}")
        return {
            "error": "load_failed",
            "message": f"Could not load brand visuals: {str(e)}",
            "brand_name": "Your Brand",
            "primary_color": "#2563EB",
            "visual_tone": "professional",
        }


# =============================================================================
# PROMPT GENERATION TOOL
# =============================================================================

@tool
async def generate_image_prompt(
    description: str,
    style: str = "photo_realistic",
    platform: str = "instagram",
    include_brand_colors: bool = True,
    brand_visuals: Optional[dict] = None
) -> dict:
    """
    Create an optimized prompt for image generation.
    
    Takes a basic description and enhances it with:
    - Style-specific keywords
    - Platform-optimized specifications
    - Brand color integration (optional)
    - Negative prompts to avoid common issues
    
    Args:
        description: What the image should show (e.g., "person working with AI")
        style: Visual style (photo_realistic, illustration, minimal, etc.)
        platform: Target social platform (instagram, linkedin, twitter, etc.)
        include_brand_colors: Whether to incorporate brand colors
        brand_visuals: Optional brand visuals dict (if already loaded)
    
    Returns:
        dict with:
        - prompt: The optimized full prompt
        - negative_prompt: What to avoid
        - style_keywords: Keywords applied
        - platform_notes: Platform-specific adjustments
        - recommended_dimensions: Suggested image size
    """
    # Get platform specs
    platform_lower = platform.lower()
    platform_spec = PLATFORM_SPECS.get(platform_lower, PLATFORM_SPECS["instagram"])
    
    # Get style prompt additions
    style_lower = style.lower()
    style_additions = STYLE_PROMPTS.get(style_lower, STYLE_PROMPTS["photo_realistic"])
    
    # Build the enhanced prompt
    prompt_parts = [
        description,
        style_additions,
        platform_spec["style_notes"],
    ]
    
    # Add brand colors if requested
    color_note = ""
    if include_brand_colors and brand_visuals:
        primary = brand_visuals.get("primary_color")
        if primary:
            color_note = f"incorporating {primary} color tones"
            prompt_parts.append(color_note)
    
    # Combine into full prompt
    full_prompt = ", ".join(prompt_parts)
    
    # Build negative prompt
    negative_parts = [
        "low quality",
        "blurry",
        "distorted",
        "watermark",
        "text overlay",
        "logo",
        platform_spec["avoid"],
    ]
    negative_prompt = ", ".join(negative_parts)
    
    return {
        "prompt": full_prompt,
        "negative_prompt": negative_prompt,
        "style_keywords": style_additions.split(", "),
        "platform_notes": platform_spec["style_notes"],
        "recommended_dimensions": platform_spec["dimensions"],
        "recommended_ratio": platform_spec["recommended_ratio"],
        "brand_colors_applied": bool(color_note),
    }


# =============================================================================
# IMAGE CREATION TOOL (STUB)
# =============================================================================

@tool
async def create_image(
    prompt: str,
    style: str = "photo_realistic",
    aspect_ratio: str = "1:1",
    platform: str = "instagram",
    negative_prompt: str = ""
) -> dict:
    """
    Generate an image using the provided prompt.
    
    **STATUS: STUB IMPLEMENTATION**
    This tool is ready for API integration but currently returns a placeholder.
    When Replicate/Flux API is integrated, this will generate actual images.
    
    Args:
        prompt: The full optimized prompt for image generation
        style: Visual style applied
        aspect_ratio: Target aspect ratio (1:1, 16:9, 9:16, 4:5)
        platform: Target social platform
        negative_prompt: What to avoid in the image
    
    Returns:
        dict with:
        - status: "stub" (will be "success" when API is ready)
        - image_url: None (will be actual URL when API is ready)
        - prompt_used: The prompt that would be/was used
        - message: Human-readable status
        - ready_for_api: True (indicates this is ready for real integration)
    """
    from app.schemas.image_generation import (
        ImageGenerationResult,
        ImageStatus,
        ImageStyle,
        get_platform_dimensions,
    )
    
    logger.info(f"create_image called (stub) - style: {style}, platform: {platform}")
    
    # Map string style to enum
    try:
        style_enum = ImageStyle(style)
    except ValueError:
        style_enum = ImageStyle.photo_realistic
    
    dimensions = get_platform_dimensions(platform, aspect_ratio)
    
    # TODO: Replace this stub with actual API call
    # Example integration point for Replicate:
    # 
    # import replicate
    # output = replicate.run(
    #     "black-forest-labs/flux-schnell",
    #     input={
    #         "prompt": prompt,
    #         "aspect_ratio": aspect_ratio,
    #         "num_outputs": 1,
    #     }
    # )
    # image_url = output[0]
    
    result = ImageGenerationResult(
        status=ImageStatus.stub,
        image_url=None,
        prompt_used=prompt,
        negative_prompt=negative_prompt if negative_prompt else None,
        style=style_enum,
        aspect_ratio=aspect_ratio,
        platform=platform,
        dimensions=dimensions,
        brand_colors_used=False,
        message=(
            f"Image generation is under development. "
            f"Here's the optimized prompt for {platform} ({dimensions}): "
            f"\n\n{prompt}"
        ),
        ready_for_api=True,
    )
    
    return result.model_dump()


# =============================================================================
# TOOL EXPORTS
# =============================================================================

IMAGE_GEN_TOOLS = [
    get_brand_visuals,
    generate_image_prompt,
    create_image,
]
