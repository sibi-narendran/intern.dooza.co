"""
Social Publisher Agent

Specialist agent responsible for publishing approved content to social media platforms.
Part of the Soshie team - handles the final step of the content pipeline.

Responsibilities:
- Check user's connected social accounts
- Publish approved content to selected platforms
- Handle multi-platform publishing
- Report publish status and results

Tools:
- get_user_social_connections: Check which platforms are connected
- publish_to_instagram: Post to Instagram
- publish_to_facebook: Post to Facebook
- publish_to_linkedin: Post to LinkedIn
- publish_to_tiktok: Post to TikTok
- publish_to_youtube: Upload to YouTube
- publish_task: Publish a workspace task
"""

from __future__ import annotations

import logging
from typing import Optional

from langgraph.prebuilt import create_react_agent

from app.agents.base import get_llm
from app.tools.composio_social import get_social_publish_tools

logger = logging.getLogger(__name__)


# =============================================================================
# SYSTEM PROMPT
# =============================================================================

SOCIAL_PUBLISHER_SYSTEM_PROMPT = """You are social_publisher, the Publishing Specialist at Dooza.

## Your Role
Publish approved content to social media platforms. You are the final step in the content pipeline.

## IMPORTANT: Connection State is Pre-Checked
Connection status is injected into your context by Soshie. You do NOT need to:
- Call get_user_social_connections (already done)
- Tell users about their connection status (Soshie handles this)
- Prompt users to connect (Soshie shows UI for this)

Just focus on publishing to CONNECTED platforms.

## Publishing Workflow

1. **Review the request** - Which platforms and what content?
2. **Publish to connected platforms** - Use the appropriate publish tool
3. **Report results** - Success with URLs or failures with details

## Platform Requirements

| Platform  | Media Req | Char Limit | Notes |
|-----------|-----------|------------|-------|
| Instagram | Required  | 2200 chars | Square/portrait images best |
| Facebook  | Optional  | 63K chars  | Links get auto-preview |
| LinkedIn  | Optional  | 3000 chars | Professional tone |
| TikTok    | Video req | 2200 chars | Vertical video (9:16) |
| YouTube   | Video req | 5000 desc  | Title max 100 chars |

## Tools Available

- `publish_to_instagram(caption, media_urls, hashtags)`
- `publish_to_facebook(text, media_urls, link_url)`
- `publish_to_linkedin(text, media_url, article_url)`
- `publish_to_tiktok(video_url, caption, hashtags)`
- `publish_to_youtube(video_url, title, description, tags, visibility)`
- `publish_task(task_id, platforms)` - Publish an approved workspace task

## Rules

1. Don't modify content - publish as provided
2. Report success with post URLs
3. Report failures with clear error details
4. For content creation, defer to content_workflow
"""


# =============================================================================
# AGENT FACTORY
# =============================================================================

def create_social_publisher_agent(model=None):
    """
    Create the social_publisher specialist agent.
    
    This agent is part of the Soshie supervisor team and handles
    publishing approved content to social media platforms.
    
    Args:
        model: Optional LLM instance. Uses configured provider if not provided.
    
    Returns:
        A LangGraph agent with publishing tools.
    """
    if model is None:
        # Use centralized LLM factory - supports OpenAI, Gemini 3, OpenRouter
        model = get_llm(streaming=False)  # Non-streaming for reliable tool execution
    
    # Get publishing tools
    tools = get_social_publish_tools()
    
    # Create the agent
    agent = create_react_agent(
        model=model,
        tools=tools,
        name="social_publisher",
        prompt=SOCIAL_PUBLISHER_SYSTEM_PROMPT,
    )
    
    logger.info("Created social_publisher agent with %d tools", len(tools))
    
    return agent


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def get_publisher_tools() -> list:
    """Get the tools used by the social_publisher agent."""
    return get_social_publish_tools()
