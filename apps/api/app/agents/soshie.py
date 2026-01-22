"""
Soshie - Social Media Lead Agent

Standard LangGraph tool-calling agent using create_react_agent.
This is the same pattern used by Cursor, ChatGPT, and other production AI systems:
- LLM decides when to use tools via structured JSON tool calls
- Tools execute and return results
- LLM interprets results and responds to user

Flow:
    input → LLM → (tool call → execute → observe)* → final response

Tools:
- create_social_content: Full content creation pipeline (research, draft, evaluate, adapt)
  Creates tasks in workspace for user approval.

This pattern ensures:
- LLM has full control over tool usage decisions
- Standard JSON tool calls (not string parsing)
- Easy to extend with new tools
- Compatible with LangGraph Server and checkpointing
"""

from __future__ import annotations

import logging
from typing import Optional

from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.base import BaseCheckpointSaver

from app.agents.base import get_llm
from app.tools.workflows import WORKFLOW_TOOLS

logger = logging.getLogger(__name__)


# =============================================================================
# SYSTEM PROMPT
# =============================================================================

SOSHIE_SYSTEM_PROMPT = """You are Soshie, the Social Media Lead at Dooza.

## Your Role
You help users with all their social media needs - creating content, strategizing, and managing their social presence.

## Your Tools

### create_social_content
Use this tool when the user wants to CREATE, WRITE, or DRAFT content.

**Parameters:**
- request: What the user wants (e.g., "Write about AI trends")
- platforms: List of target platforms (e.g., ["linkedin", "instagram"])
- content_type: "post" (default) or "thread"

**Supported platforms:** linkedin, instagram, twitter, facebook, tiktok

**IMPORTANT:** If the user doesn't specify which platforms, ASK THEM FIRST before calling this tool.

**Examples:**
- "Write a LinkedIn post about our product launch" 
  → create_social_content(request="Write about our product launch", platforms=["linkedin"])
  
- "Create content for all my platforms about AI"
  → create_social_content(request="Write about AI", platforms=["linkedin", "instagram", "twitter", "facebook", "tiktok"])

## When NOT to Use Tools
Answer these questions directly WITHOUT calling tools:
- Questions about social media strategy
- Best practices for platforms
- Timing advice
- Hashtag strategy
- Greetings and chitchat
- Clarifying questions

## Platform Expertise
- **LinkedIn**: Professional tone, 150-300 words, industry insights
- **Instagram**: Visual-first, strong hashtags (10-15), casual but polished
- **Twitter/X**: Concise (max 280 chars), engaging hooks, timely
- **TikTok**: Trendy, entertaining, younger audience
- **Facebook**: Community-focused, mix of personal and professional

## Response Style
- Be friendly, professional, and concise
- Remember context from the conversation (user's name, preferences)
- After content is created, summarize what was done and mention tasks were created for review

## Important Rules
- NEVER publish content without user approval - the tool creates TASKS for review
- Always confirm platforms before creating content
- If content creation fails, explain why and offer alternatives
"""


# =============================================================================
# AGENT FACTORY
# =============================================================================

def create_soshie_agent(
    model=None,
    checkpointer: Optional[BaseCheckpointSaver] = None
):
    """
    Create the Soshie agent using LangGraph's create_react_agent.
    
    This is the standard tool-calling agent pattern:
    - LLM outputs JSON tool calls (not string parsing)
    - Tools execute and return structured results
    - LLM interprets results and formulates response
    
    Args:
        model: Optional LLM instance. If not provided, uses configured provider.
        checkpointer: Optional LangGraph checkpointer for conversation memory.
        
    Returns:
        A compiled LangGraph agent ready for invocation.
    """
    if model is None:
        # Use centralized LLM factory - supports OpenAI, Gemini 3, OpenRouter
        model = get_llm(streaming=True)
    
    # Get workflow tools (create_social_content, etc.)
    tools = WORKFLOW_TOOLS.copy()
    
    # Create the agent using LangGraph's standard create_react_agent
    agent = create_react_agent(
        model=model,
        tools=tools,
        name="soshie",
        prompt=SOSHIE_SYSTEM_PROMPT,
        checkpointer=checkpointer,
    )
    
    logger.info("Created soshie agent with %d tools: %s", 
                len(tools), 
                [t.name for t in tools])
    
    return agent


# =============================================================================
# REGISTRY INTERFACE
# =============================================================================

def get_soshie_app(checkpointer: Optional[BaseCheckpointSaver] = None):
    """
    Factory function for the agent registry.
    
    Args:
        checkpointer: Optional LangGraph checkpointer for memory.
        
    Returns:
        Compiled Soshie agent graph.
    """
    return create_soshie_agent(checkpointer=checkpointer)
