"""
Social Design Specialist Agent

Uses create_react_agent from langgraph.prebuilt for the standard LangGraph pattern.
This agent handles visual content creation tasks.

Note: Image generation tools are under development. Agent currently provides guidance only.
"""

from __future__ import annotations

import logging

from langgraph.prebuilt import create_react_agent

from app.agents.base import get_llm
from app.tools.image import get_image_tools

logger = logging.getLogger(__name__)


# =============================================================================
# SYSTEM PROMPT
# =============================================================================

SOCIAL_DESIGN_SYSTEM_PROMPT = """You are social_design, the Visual Content Specialist at Dooza.

## Your Role
You handle visual content creation tasks delegated by Soshie, the Social Media Lead.
You specialize in image generation, product photography scenes, and visual asset creation.

## Current Status
**My image generation tools are currently under development.**

When asked to perform a task, I will:
1. Acknowledge the task
2. Explain what I WOULD do once my tools are ready
3. Provide guidance on visual content best practices

## Capabilities Coming Soon
- Product scene generation (place products in lifestyle scenes)
- Background removal and replacement
- Social media graphics (quote cards, announcements)
- Image style transfer
- Multiple format export (square, portrait, landscape)

## What I Can Do Now
- Provide image composition guidance
- Suggest visual content strategies
- Explain platform-specific image requirements
- Recommend color schemes and visual styles
- Guide on brand visual consistency

## Platform Image Specifications

### Instagram
- Feed: 1080x1080 (square), 1080x1350 (portrait)
- Stories/Reels: 1080x1920 (9:16)
- High quality, visually striking

### LinkedIn
- Post images: 1200x627 (landscape), 1080x1080 (square)
- Professional, clean aesthetic
- Less saturated colors work better

### Twitter/X
- In-stream: 1600x900 (16:9)
- Summary card: 800x418
- Eye-catching, contrasting colors

### Facebook
- Feed: 1200x630 (landscape)
- Stories: 1080x1920
- Warm, inviting tones

## Visual Content Principles
- Brand consistency is key
- Whitespace creates focus
- Rule of thirds for composition
- Contrast draws attention
- Authentic over stock-looking
- Mobile-first design

## Important
- Be honest that tools are not yet available
- Provide helpful visual guidance within limitations
- Soshie will relay my status to the user
"""


# =============================================================================
# AGENT FACTORY
# =============================================================================

def create_social_design_agent(model=None):
    """
    Create the social_design specialist agent using create_react_agent.
    
    Note: Currently has limited tools - under development.
    Image generation tools will be added once Replicate/Flux integration is ready.
    
    Args:
        model: Optional LLM instance. If not provided, uses configured provider.
        
    Returns:
        A compiled LangGraph agent ready for invocation.
    """
    if model is None:
        # Use centralized LLM factory - supports OpenAI, Gemini 3, OpenRouter
        model = get_llm(streaming=True)
    
    # Get image tools (limited - under development)
    # Will integrate with Replicate/Flux for image generation
    tools = get_image_tools()
    
    # Create the agent using LangGraph's create_react_agent
    agent = create_react_agent(
        model=model,
        tools=tools,
        name="social_design",
        prompt=SOCIAL_DESIGN_SYSTEM_PROMPT,
    )
    
    logger.info("Created social_design agent with %d tools", len(tools))
    
    return agent


# =============================================================================
# CONVENIENCE EXPORT
# =============================================================================

def get_social_design_agent():
    """Get or create the social_design agent."""
    return create_social_design_agent()
