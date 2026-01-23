"""
Image Generation Tools for the Image Generation Subagent

These tools are used autonomously by the Image Generation subagent to:
1. Load brand visual identity
2. Create optimized prompts
3. Generate images using Google's Nano Banana Pro model

Tools:
- get_brand_visuals: Load brand colors, fonts, logo from knowledge base
- generate_image_prompt: Create an optimized prompt for image generation
- create_image: Generate images using Nano Banana Pro via OpenRouter

Usage:
    These tools are registered with the Image Generation subagent, not Soshie directly.
    The subagent decides when and how to call them.
    
Configuration:
    Uses OPENROUTER_API_KEY (recommended) for image generation.
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
    Load brand visual identity including logo and uploaded images.
    
    Call this first to get brand assets for image generation.
    Returns brand colors, logo URL, and list of uploaded images you can use.
    
    Returns:
        dict with:
        - brand_name: Business name
        - primary_color: Primary brand color (hex)
        - secondary_color: Secondary brand color (hex)
        - accent_color: Accent color (hex)
        - logo_url: URL to brand logo (use for branded content)
        - logo_name: Name of the logo file
        - uploaded_images: List of available images with name, description, url
        - visual_tone: Visual tone (professional, casual, bold, minimal)
        
    The uploaded_images list contains images you can use as references:
    - Pass their URLs to create_image's reference_image_urls parameter
    - Use logo_url when creating branded content
    - Use product/team images when relevant to the content
    """
    from app.services.knowledge_service import get_knowledge_service
    
    ctx = get_agent_context()
    if not ctx:
        logger.warning("No agent context - returning default brand visuals")
        return {
            "error": "no_context",
            "brand_name": "Your Brand",
            "primary_color": "#2563EB",
            "secondary_color": "#1E40AF",
            "accent_color": "#F59E0B",
            "visual_tone": "professional",
            "logo_url": None,
            "uploaded_images": [],
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
                "logo_url": None,
                "uploaded_images": [],
            }
        
        # Fetch brand settings
        brand = await service.get_brand_settings(org_id)
        colors = brand.colors or {}
        
        # Fetch logo
        logo = await service.get_logo(org_id)
        
        # Fetch uploaded images
        images = await service.get_brand_assets(org_id, asset_type="image", limit=10)
        
        # Format uploaded images for the agent
        uploaded_images = [
            {
                "name": img.name,
                "description": img.description or "",
                "url": img.public_url,
            }
            for img in images
            if img.public_url
        ]
        
        return {
            "brand_name": brand.business_name or "Your Brand",
            "primary_color": colors.get("primary", "#2563EB"),
            "secondary_color": colors.get("secondary"),
            "accent_color": colors.get("accent") or colors.get("tertiary"),
            "logo_url": logo.public_url if logo else None,
            "logo_name": logo.name if logo else None,
            "font_style": "modern",
            "visual_tone": brand.brand_voice or "professional",
            "industry": brand.industry,
            "tagline": brand.tagline,
            "uploaded_images": uploaded_images,
        }
        
    except Exception as e:
        logger.error(f"Failed to load brand visuals: {e}")
        return {
            "error": "load_failed",
            "message": f"Could not load brand visuals: {str(e)}",
            "brand_name": "Your Brand",
            "primary_color": "#2563EB",
            "visual_tone": "professional",
            "logo_url": None,
            "uploaded_images": [],
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
# IMAGE CREATION TOOL (Nano Banana Pro)
# =============================================================================

@tool
async def create_image(
    prompt: str,
    style: str = "photo_realistic",
    aspect_ratio: str = "1:1",
    platform: str = "instagram",
    negative_prompt: str = "",
    reference_image_urls: Optional[list[str]] = None
) -> dict:
    """
    Generate an image using Google's Nano Banana Pro model.
    
    This tool uses Google's latest image generation model (Nano Banana Pro / Gemini 3 Pro Image)
    to create high-quality images optimized for social media platforms.
    
    IMPORTANT: You can pass reference images (logo, uploaded images) to influence the generation.
    Get these URLs from get_brand_visuals() - use logo_url and uploaded_images[].url.
    
    Args:
        prompt: The full optimized prompt for image generation
        style: Visual style applied (for prompt context, not API parameter)
        aspect_ratio: Target aspect ratio (1:1, 16:9, 9:16, 4:5, 4:3, 3:4)
        platform: Target social platform (for dimension reference)
        negative_prompt: What to avoid in the image (appended to prompt)
        reference_image_urls: List of image URLs to use as visual references.
                             Pass logo_url for branded content.
                             Pass uploaded image URLs to use them as style/content references.
                             Maximum 3 images recommended.
    
    Returns:
        dict with:
        - status: "success", "error", "filtered", or "stub"
        - image_url: Public URL of the generated image
        - image_data_url: Base64 data URL (fallback if upload fails)
        - prompt_used: The prompt that was used
        - enhanced_prompt: LLM-enhanced prompt (if enhancement was enabled)
        - message: Human-readable status message
        - provider: The backend used (openrouter, vertex_ai, google_ai_studio)
        - model: The model used (e.g., gemini-3-pro-image-preview)
    
    Example with reference images:
        create_image(
            prompt="Professional LinkedIn post showing our product",
            platform="linkedin",
            reference_image_urls=[
                "https://...logo.png",      # Include brand logo
                "https://...product.jpg"    # Use product image as reference
            ]
        )
    """
    from app.schemas.image_generation import (
        ImageGenerationResult,
        ImageProvider as SchemaImageProvider,
        ImageStatus,
        ImageStyle,
        get_platform_dimensions,
    )
    from app.services.image_gen_service import (
        get_image_gen_service,
        ImageProvider,
        ImageSize,
    )
    
    logger.info(f"create_image called - style: {style}, platform: {platform}, aspect_ratio: {aspect_ratio}")
    
    # Map string style to enum
    try:
        style_enum = ImageStyle(style)
    except ValueError:
        style_enum = ImageStyle.photo_realistic
    
    dimensions = get_platform_dimensions(platform, aspect_ratio)
    
    # Get user_id from context for organizing uploads
    ctx = get_agent_context()
    user_id = ctx.user_id if ctx else None
    
    # Get the image generation service
    service = get_image_gen_service()
    
    # Generate the image (auto-uploads to Supabase Storage)
    generated = await service.generate_image(
        prompt=prompt,
        aspect_ratio=aspect_ratio,
        image_size=ImageSize.size_2k,  # High quality for social media
        negative_prompt=negative_prompt if negative_prompt else None,
        enhance_prompt=True,
        user_id=user_id,
        upload_to_storage=True,
        reference_images=reference_image_urls,  # Pass brand assets as visual references
    )
    
    # Map service provider to schema provider
    provider_map = {
        ImageProvider.openrouter: SchemaImageProvider.openrouter,
        ImageProvider.vertex_ai: SchemaImageProvider.vertex_ai,
        ImageProvider.google_ai_studio: SchemaImageProvider.google_ai_studio,
        ImageProvider.stub: SchemaImageProvider.stub,
    }
    schema_provider = provider_map.get(generated.provider, SchemaImageProvider.stub)
    
    # Determine status and message
    if generated.success:
        status = ImageStatus.success
        message = f"Image generated successfully using Nano Banana Pro ({generated.model})."
        if generated.image_url:
            message += " Image saved to cloud storage."
    elif generated.provider == ImageProvider.stub:
        status = ImageStatus.stub
        message = generated.error_message or (
            f"Image generation not configured. "
            f"Here's the optimized prompt for {platform} ({dimensions}): {prompt[:200]}..."
        )
    elif "safety" in (generated.error_message or "").lower() or "blocked" in (generated.error_message or "").lower():
        status = ImageStatus.filtered
        message = generated.error_message or "Image was blocked by safety filters."
    else:
        status = ImageStatus.error
        message = generated.error_message or "Image generation failed."
    
    result = ImageGenerationResult(
        status=status,
        image_url=generated.image_url,  # Public URL from Supabase Storage
        image_data_url=generated.to_data_url() if generated.success and not generated.image_url else None,
        prompt_used=prompt,
        enhanced_prompt=generated.enhanced_prompt,
        negative_prompt=negative_prompt if negative_prompt else None,
        style=style_enum,
        aspect_ratio=aspect_ratio,
        platform=platform,
        dimensions=dimensions,
        provider=schema_provider,
        model=generated.model,
        brand_colors_used=False,
        message=message,
        ready_for_api=service.is_available,
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
