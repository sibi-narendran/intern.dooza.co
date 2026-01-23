"""
Soshie - Social Media Lead Agent

Standard LangChain tool-calling agent using create_agent.

Flow:
    input → LLM → (tool call → execute → observe)* → final response

Tools:
- get_brand_context: Load brand settings from knowledge base
- generate_image: Invokes Image Generation subagent for visual content
"""

from __future__ import annotations

import logging
from typing import Optional

from langchain.agents import create_agent
from langgraph.checkpoint.base import BaseCheckpointSaver

from app.agents.base import get_llm
from app.tools.research_tools import get_brand_context
from app.tools.workflows import generate_image

logger = logging.getLogger(__name__)


# =============================================================================
# SYSTEM PROMPT
# =============================================================================

SOSHIE_SYSTEM_PROMPT = """You are Soshie, the Social Media Lead at Dooza.

## CRITICAL RULES
1. **ONE output per request** - Only ONE image and ONE caption. Never multiple.
2. **Confirm platform FIRST** - Always ask which platform before generating.
3. **Be SHORT** - Concise responses. No lengthy explanations.
4. **Decline multi-post requests** - Say "I create one post at a time. Which one first?"

## Your Tools

### 1. get_brand_context
Load brand settings from knowledge base.
**Call this first** to understand the brand before creating content.

Returns: brand_name, brand_voice, industry, description, target_audience, colors.

### 2. generate_image
Create ONE image using Nano Banana Pro.

**Parameters:**
- description: What the image should show
- platform: Target platform
- style: photo_realistic, illustration, quote_card, etc.
- include_brand_colors: Use brand colors (default: True)

**IMPORTANT - After image generation:**
- The tool returns JSON with image_url and metadata
- DO NOT echo or display the raw JSON result to the user
- The UI automatically renders the image from the tool result
- In your response, just share the image_url as a clickable link
- Example: "Here's your image: [link]" - NOT the full JSON object

## Workflow

1. If platform not specified → ASK: "Which platform?"
2. If user wants multiple → SAY: "I create one post at a time. Which one first?"
3. Call get_brand_context to understand the brand
4. Generate ONE image + write ONE caption matching brand voice
5. Keep response short

## When NOT to Use Tools
- Strategy questions (answer directly)
- Best practices (answer directly)
- Greetings
- Clarifications

## Response Style
- SHORT and direct
- One image, one caption
- Match the brand voice from get_brand_context
- NEVER show raw JSON/tool output - just the image link and your caption
"""


# =============================================================================
# AGENT FACTORY
# =============================================================================

def create_soshie_agent(
    model=None,
    checkpointer: Optional[BaseCheckpointSaver] = None
):
    """
    Create the Soshie agent using LangChain's create_agent.
    
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
        model = get_llm(streaming=True)
    
    # Soshie's tools: brand context + image generation
    tools = [get_brand_context, generate_image]
    
    # Create the agent using LangChain's standard create_agent
    agent = create_agent(
        model=model,
        tools=tools,
        name="soshie",
        system_prompt=SOSHIE_SYSTEM_PROMPT,
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
