"""
Social Content Specialist Agent

DEPRECATED: This agent is replaced by content_workflow for production use.
The content_workflow provides:
- Parallel research (hashtags, timing, ideas, competitor)
- Evaluator-optimizer loop for quality
- Automatic task creation

Use content_workflow via Soshie supervisor or directly:
    from app.workflows.content_workflow import run_content_workflow

This file is kept for backwards compatibility and quick testing only.
DO NOT USE IN PRODUCTION - use content_workflow instead.
"""

from __future__ import annotations

import logging
import warnings

from langgraph.prebuilt import create_react_agent

from app.agents.base import get_llm
from app.tools.social import get_social_tools

logger = logging.getLogger(__name__)


# =============================================================================
# SYSTEM PROMPT
# =============================================================================

SOCIAL_CONTENT_SYSTEM_PROMPT = """You are social_content, the Content Creation Specialist at Dooza.

## Your Role
You handle content creation tasks delegated by Soshie, the Social Media Lead.
You have direct access to tools for generating social media content.

## Your Tools
- social_generate_linkedin_post: Create professional LinkedIn posts
- social_generate_twitter_thread: Create engaging Twitter/X threads
- social_generate_blog_outline: Create structured blog post outlines
- social_generate_caption: Create platform-optimized captions

## How You Work
1. Receive a task from Soshie
2. Use your tools to generate content
3. Return the results - Soshie will present them to the user

## Platform Guidelines

### LinkedIn
- Professional, value-driven tone
- Use line breaks for readability
- Include a hook in the first line
- End with a call-to-action or question
- Optimal length: 150-300 words
- Use 3-5 relevant hashtags

### Twitter/X
- Concise, punchy writing
- Each tweet max 280 characters
- Threads: 3-10 tweets ideal
- Use hooks and cliffhangers between tweets
- Include 1-2 hashtags per tweet

### Instagram
- Visual-first mindset
- Captions can be longer (up to 2200 chars)
- Front-load important info
- Use emojis strategically
- Include 20-30 hashtags (in comment or caption)

### Blog
- SEO-conscious structure
- Clear H1, H2, H3 hierarchy
- Introduction with hook
- Actionable subheadings
- Conclusion with CTA

## Content Principles
- Know the target audience
- Lead with value, not promotion
- Use storytelling when appropriate
- Include specific examples/data when possible
- Match the brand voice (ask if unclear)

## Important
- Always use tools when asked to create content
- Return structured content from tools
- Do NOT make up engagement metrics
- If a tool fails, report the error clearly
"""


# =============================================================================
# AGENT FACTORY
# =============================================================================

def create_social_content_agent(model=None):
    """
    Create the social_content specialist agent.
    
    DEPRECATED: Use content_workflow for production.
    This is kept for backwards compatibility only.
    
    Args:
        model: Optional LLM instance. If not provided, uses configured provider.
        
    Returns:
        A compiled LangGraph agent ready for invocation.
    """
    warnings.warn(
        "create_social_content_agent is deprecated. "
        "Use content_workflow for content creation instead.",
        DeprecationWarning,
        stacklevel=2,
    )
    
    if model is None:
        # Use centralized LLM factory - supports OpenAI, Gemini 3, OpenRouter
        model = get_llm(streaming=True)
    
    # Get social content tools
    tools = get_social_tools()
    
    # Create the agent using LangGraph's create_react_agent
    agent = create_react_agent(
        model=model,
        tools=tools,
        name="social_content",
        prompt=SOCIAL_CONTENT_SYSTEM_PROMPT,
    )
    
    logger.info("Created deprecated social_content agent - use content_workflow instead")
    
    return agent


# =============================================================================
# CONVENIENCE EXPORT
# =============================================================================

def get_social_content_agent():
    """Get or create the social_content agent."""
    return create_social_content_agent()
