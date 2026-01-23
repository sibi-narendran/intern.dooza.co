"""
Workflow Tools for LangGraph Agents

This module exposes subagents as tools that Soshie can call.

Tools:
- generate_image: Invokes Image Generation subagent for visual content
"""

from __future__ import annotations

import logging

from langchain_core.tools import tool
from langchain_core.messages import HumanMessage

from app.tools.task import get_agent_context
from app.schemas.subagent import (
    ImageTaskInput,
    ImageTaskOutput,
    build_image_message,
    parse_image_result,
)

logger = logging.getLogger(__name__)


# =============================================================================
# IMAGE GENERATION SUBAGENT TOOL
# =============================================================================

@tool
async def generate_image(
    description: str,
    platform: str = "instagram",
    style: str = "photo_realistic",
    include_brand_colors: bool = True
) -> dict:
    """
    Generate an image by invoking the Image Generation subagent.
    
    Use this when the user wants visual content for their posts.
    
    The Image Generation subagent will autonomously:
    1. Load brand visuals (colors, logo) if brand consistency is needed
    2. Create an optimized prompt for the target platform
    3. Generate the image using Nano Banana Pro (Gemini 3 Pro Image)
    4. Upload to cloud storage and return a public URL
    
    Args:
        description: What the image should show (e.g., "person working with AI assistants")
        platform: Target platform (instagram, linkedin, twitter, facebook, tiktok)
        style: Visual style - one of:
               photo_realistic, illustration, infographic, quote_card,
               product_shot, lifestyle, abstract, minimal, cartoon, artistic
        include_brand_colors: Whether to incorporate brand colors into the image
    
    Returns:
        dict with:
        - status: "success" or "error"
        - image_url: Public URL of the generated image (Supabase Storage)
        - prompt_used: The optimized prompt used for generation
        - style: Style applied
        - aspect_ratio: Aspect ratio used
        - dimensions: Image dimensions
        - message: Human-readable status
    
    Examples:
        - User: "Create an image for my LinkedIn post about AI"
          -> generate_image("AI productivity in modern office", platform="linkedin")
        
        - User: "Make an Instagram graphic with a quote"
          -> generate_image("motivational quote about success", platform="instagram", style="quote_card")
    """
    from app.agents.image_gen import create_image_gen_agent
    
    logger.info(f"generate_image called - platform: {platform}, style: {style}")
    
    # Normalize platform
    platform_lower = platform.lower().strip()
    aliases = {"x": "twitter", "fb": "facebook", "insta": "instagram", "ig": "instagram", "li": "linkedin"}
    platform_normalized = aliases.get(platform_lower, platform_lower)
    
    # Get user context for brand lookups
    ctx = get_agent_context()
    user_id = ctx.user_id if ctx else None
    
    # Build structured task input
    task = ImageTaskInput(
        task_type="generate_image",
        description=description,
        platform=platform_normalized,
        style=style,
        include_brand_colors=include_brand_colors,
        user_id=user_id,
    )
    
    # Create structured JSON message for subagent
    task_json = build_image_message(task)
    
    try:
        # Create and invoke the image generation subagent
        image_agent = create_image_gen_agent()
        
        result = await image_agent.ainvoke({
            "messages": [HumanMessage(content=task_json)]
        })
        
        # Extract the final message from the subagent
        messages = result.get("messages", [])
        if not messages:
            logger.warning("Image generation agent returned no messages")
            return ImageTaskOutput(
                success=False,
                status="error",
                prompt_used=description,
                style=style,
                aspect_ratio="1:1",
                platform=platform_normalized,
                dimensions="1080x1080",
                message="Image generation returned no response",
                error="no_messages",
            ).model_dump()
        
        # Get the last AI message (the final response)
        final_content = None
        for msg in reversed(messages):
            if hasattr(msg, "content") and msg.content:
                # Skip tool messages
                if hasattr(msg, "type") and msg.type == "tool":
                    continue
                final_content = msg.content
                break
        
        if not final_content:
            logger.warning("No final message found in image generation result")
            return ImageTaskOutput(
                success=False,
                status="error",
                prompt_used=description,
                style=style,
                aspect_ratio="1:1",
                platform=platform_normalized,
                dimensions="1080x1080",
                message="Image generation completed but no result found",
                error="no_final_message",
            ).model_dump()
        
        # Parse structured result
        parsed = parse_image_result(final_content, fallback_description=description)
        logger.info(f"Image generation completed with status: {parsed.status}")
        return parsed.model_dump()
        
    except Exception as e:
        logger.error(f"Image generation subagent failed: {e}", exc_info=True)
        return ImageTaskOutput(
            success=False,
            status="error",
            prompt_used=description,
            style=style,
            aspect_ratio="1:1",
            platform=platform_normalized,
            dimensions="1080x1080",
            message=f"Image generation failed: {str(e)}",
            error="subagent_failed",
            error_detail=str(e),
        ).model_dump()
