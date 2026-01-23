"""
Image Generation Subagent

A true subagent with its own ReAct loop that autonomously handles image generation.
It can load brand visuals, create optimized prompts, and generate images.

This subagent is invoked by Soshie via the generate_image tool.
It decides which tools to call and synthesizes findings into an ImageGenerationResult.

Architecture:
    Soshie → generate_image tool → Image Gen Agent → returns result → Soshie

The Image Generation Agent has its own tools:
- get_brand_visuals: Load brand colors/logo from knowledge base
- generate_image_prompt: Create optimized prompts for the target platform
- create_image: Generate the actual image (stub until API integration)

Usage:
    from app.agents.image_gen import create_image_gen_agent
    
    agent = create_image_gen_agent()
    result = await agent.ainvoke({"messages": [HumanMessage(...)]})
"""

from __future__ import annotations

import logging
from typing import Optional

from langchain.agents import create_agent
from langgraph.checkpoint.base import BaseCheckpointSaver

from app.agents.base import get_llm
from app.tools.image_gen_tools import IMAGE_GEN_TOOLS

logger = logging.getLogger(__name__)


# =============================================================================
# SYSTEM PROMPT
# =============================================================================

IMAGE_GEN_SYSTEM_PROMPT = """You are an Image Generation Specialist working as part of the Dooza social media team.

## Your Role
You create visual content for social media posts. You understand platform requirements, brand consistency, and how to craft prompts that generate high-quality images.

## Your Tools

### 1. get_brand_visuals
**Call this first if brand consistency matters.**
Loads brand colors, fonts, and visual identity from the knowledge base.

Returns: brand name, primary/secondary/accent colors, visual tone.

### 2. generate_image_prompt
Create an optimized prompt for image generation.

Parameters:
- description: What the image should show
- style: Visual style (photo_realistic, illustration, minimal, etc.)
- platform: Target platform (instagram, linkedin, twitter, etc.)
- include_brand_colors: Whether to use brand colors
- brand_visuals: The brand visuals dict (if you loaded them)

Returns: optimized prompt, negative prompt, style keywords, recommended dimensions.

### 3. create_image
Generate the actual image with the optimized prompt.

**Note:** This is currently a stub - it returns the optimized prompt but doesn't generate an actual image yet. The prompt is ready for when API integration is complete.

Parameters:
- prompt: The full optimized prompt
- style: Visual style
- aspect_ratio: Image ratio (1:1, 16:9, 9:16, 4:5)
- platform: Target platform
- negative_prompt: What to avoid

Returns: status, prompt used, recommended dimensions, message.

## Your Process

1. **Understand the request**: What kind of image? For which platform?
2. **Get brand visuals** (if brand consistency is important)
3. **Generate an optimized prompt** using platform and style knowledge
4. **Create the image** with the optimized prompt

## Platform-Specific Guidelines

### Instagram
- Aspect: 1:1 (feed), 4:5 (portrait), 9:16 (stories/reels)
- Style: Vibrant, eye-catching, high contrast
- Avoid: Too much text, corporate look

### LinkedIn
- Aspect: 1:1 or 16:9
- Style: Professional, clean, trustworthy
- Avoid: Overly casual, too playful

### Twitter
- Aspect: 16:9
- Style: Bold, attention-grabbing, simple
- Avoid: Subtle details, too much text

### Facebook
- Aspect: 16:9 or 1:1
- Style: Warm, inviting, authentic
- Avoid: Cold/sterile look

### TikTok
- Aspect: 9:16
- Style: Trendy, dynamic, youthful
- Avoid: Static, boring, overly polished

## Important
- Always use generate_image_prompt before create_image
- Consider the platform when choosing style and dimensions
- Include brand colors when creating professional/brand content
- The create_image tool is currently a stub - explain this to the user
"""


# =============================================================================
# AGENT FACTORY
# =============================================================================

def create_image_gen_agent(
    model=None,
    checkpointer: Optional[BaseCheckpointSaver] = None
):
    """
    Create the Image Generation subagent.
    
    This is a full ReAct agent with its own tools that can autonomously
    decide how to generate images for different platforms.
    
    Args:
        model: Optional LLM instance. If not provided, uses configured provider.
        checkpointer: Optional checkpointer (usually None for subagents).
        
    Returns:
        A compiled LangGraph agent ready for invocation.
    """
    if model is None:
        # Use non-streaming for subagent (results go to parent, not user)
        model = get_llm(streaming=False)
    
    agent = create_agent(
        model=model,
        tools=IMAGE_GEN_TOOLS,
        name="image_gen",
        system_prompt=IMAGE_GEN_SYSTEM_PROMPT,
        checkpointer=checkpointer,
    )
    
    logger.info(
        "Created image_gen subagent with %d tools: %s",
        len(IMAGE_GEN_TOOLS),
        [t.name for t in IMAGE_GEN_TOOLS]
    )
    
    return agent


# =============================================================================
# CONVENIENCE EXPORT
# =============================================================================

def get_image_gen_agent(checkpointer: Optional[BaseCheckpointSaver] = None):
    """
    Get or create the Image Generation subagent.
    
    Note: Unlike Soshie, Image Gen typically doesn't need a checkpointer
    since it's invoked fresh for each generation request.
    """
    return create_image_gen_agent(checkpointer=checkpointer)
