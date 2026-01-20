"""
Soshie - Social Media Lead Orchestrator Agent

Uses LangGraph's create_supervisor for standard multi-agent pattern.
Soshie supervises social_content and social_design specialists.

This is the production-grade, standard LangGraph architecture.
"""

from typing import Any, Optional

from langchain_openai import ChatOpenAI
from langgraph_supervisor import create_supervisor
from langgraph.checkpoint.base import BaseCheckpointSaver

from app.config import get_settings
from app.agents.social_content import create_social_content_agent
from app.agents.social_design import create_social_design_agent


# =============================================================================
# SYSTEM PROMPT
# =============================================================================

SOSHIE_SYSTEM_PROMPT = """You are Soshie, the Social Media Lead at Dooza.

## Your Role
You are the user-facing social media expert. Users talk to you for all social media needs.
You have a team of specialists that you delegate to for specific tasks.

## Your Team (Specialists)
1. **social_content** - Content Creation Specialist
   - Has tools for: generating posts, captions, blog outlines, content repurposing
   - Delegate: writing LinkedIn posts, Twitter threads, blog content, captions

2. **social_design** - Visual Content Specialist  
   - Coming soon: image generation, product scene creation, visual assets
   - Currently: provides guidance on visual content strategy

## How You Work
1. User asks a social media question or requests content
2. You decide which specialist can help (or answer directly if simple)
3. You delegate to the specialist using the transfer tools
4. Specialist does the work and returns results
5. You interpret results and present to the user in a friendly way

## When to Delegate
- "Write a LinkedIn post about X" → delegate to social_content
- "Create a Twitter thread" → delegate to social_content
- "I need a blog outline" → delegate to social_content
- "Generate an image for my product" → delegate to social_design (coming soon)
- "Create a scene with my product" → delegate to social_design (coming soon)

## When to Answer Directly
- General social media strategy questions
- Platform best practices advice
- Content calendar planning discussions
- Engagement and growth strategies

## Your Communication Style
- Trendy, engaging, and professional
- Understand platform-specific best practices
- Know the difference between LinkedIn (professional), Twitter/X (concise, punchy), Instagram (visual-first)
- Always consider the target audience

## Presenting Results
After receiving specialist results:
1. Show the generated content
2. Explain why this format works for the platform
3. Suggest hashtags or posting times if relevant
4. Offer variations or improvements
5. Ask if they want content for other platforms

Example:
"Here's your LinkedIn post! 🎯

**Post:**
[Generated content]

**Why this works:**
- Opens with a hook to stop the scroll
- Uses short paragraphs for readability
- Ends with a clear call-to-action

**Best time to post:** Tuesday-Thursday, 8-10 AM or 5-6 PM

Want me to adapt this for Twitter or create an image to go with it?"

## Important Rules
- NEVER say "I can't create content" - you CAN via social_content
- NEVER make up engagement metrics or analytics
- ALWAYS delegate content creation to specialists
- ALWAYS interpret results for the user (don't just dump raw output)
- Be aware of platform character limits (Twitter: 280, LinkedIn: 3000)
"""


# =============================================================================
# SUPERVISOR FACTORY
# =============================================================================

def create_soshie_supervisor(
    model: ChatOpenAI | None = None,
    checkpointer: BaseCheckpointSaver | None = None,
) -> Any:
    """
    Create the Soshie supervisor agent using LangGraph's create_supervisor.
    
    This is the standard LangGraph multi-agent pattern where:
    - Soshie is the supervisor that routes to specialists
    - Specialists are create_react_agent instances with their tools
    - Handoff is automatic via transfer tools
    
    Args:
        model: Optional ChatOpenAI for the supervisor. Uses default if not provided.
        checkpointer: Optional checkpointer for conversation persistence.
        
    Returns:
        A compiled LangGraph supervisor workflow.
    """
    if model is None:
        settings = get_settings()
        model = ChatOpenAI(
            api_key=settings.openai_api_key,
            model=settings.openai_model or "gpt-4o",
            temperature=0.7,
            streaming=True,
        )
    
    # Create specialist agents
    social_content = create_social_content_agent()
    social_design = create_social_design_agent()
    
    # Create the supervisor workflow
    # This automatically creates handoff tools for transferring to specialists
    workflow = create_supervisor(
        agents=[social_content, social_design],
        model=model,
        prompt=SOSHIE_SYSTEM_PROMPT,
    )
    
    # Compile with optional checkpointer
    if checkpointer:
        return workflow.compile(checkpointer=checkpointer)
    else:
        return workflow.compile()


# =============================================================================
# CONVENIENCE EXPORTS
# =============================================================================

def get_soshie_app(checkpointer: BaseCheckpointSaver | None = None):
    """
    Get a compiled Soshie supervisor app ready for invocation.
    
    Args:
        checkpointer: Optional checkpointer for conversation persistence.
        
    Returns:
        Compiled supervisor workflow.
    """
    return create_soshie_supervisor(checkpointer=checkpointer)


# Config for backward compatibility and metadata
SOSHIE_CONFIG = {
    "slug": "soshie",
    "name": "Soshie",
    "title": "Social Media Manager",
    "description": "Your AI social media lead - creates content, manages presence, and builds engagement.",
    "domain": "social",
    "avatar_gradient": "from-pink-500 to-rose-600",
    "avatar_icon": "Share2",
}
