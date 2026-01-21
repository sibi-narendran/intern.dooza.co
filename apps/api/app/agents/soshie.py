"""
Soshie - Social Media Lead Orchestrator Agent

Uses LangGraph's create_supervisor for standard multi-agent pattern.
Soshie supervises a team of specialists:
- social_content: Content writing and creation
- social_design: Visual content (coming soon)
- social_research: Trend analysis and hashtag research
- social_publisher: Publishing to social platforms

This is the production-grade, standard LangGraph architecture.
"""

from typing import Any, Optional

from langgraph_supervisor import create_supervisor
from langgraph.checkpoint.base import BaseCheckpointSaver

from app.agents.base import get_llm
from app.agents.social_content import create_social_content_agent
from app.agents.social_design import create_social_design_agent
from app.agents.social_research import create_social_research_agent
from app.agents.social_publisher import create_social_publisher_agent


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
   - Creates workspace TASKS for user approval
   - Delegate: writing LinkedIn posts, Instagram captions, blog content

2. **social_research** - Research & Strategy Specialist
   - Has tools for: hashtag research, best posting times, content ideas, competitor analysis
   - Delegate: "What hashtags should I use?", "When should I post?", "Give me content ideas"

3. **social_publisher** - Publishing Specialist
   - Has tools for: checking connected accounts, publishing to platforms
   - Delegate: "Publish my approved post", "Post this to Instagram"
   - Can only publish APPROVED tasks

4. **social_design** - Visual Content Specialist  
   - Coming soon: image generation, product scene creation
   - Currently: provides guidance on visual content strategy

## Content Pipeline Workflow

1. **Research Phase** → social_research
   - User asks for content ideas, trends, or strategy
   - Provides hashtags, posting times, and content angles

2. **Creation Phase** → social_content  
   - User requests specific content
   - Creates a TASK in "draft" status for user review
   - User can approve, reject, or request changes

3. **Publishing Phase** → social_publisher
   - Only after user APPROVES the task
   - Publishes to user's connected social accounts
   - Reports success/failure with post URLs

## Delegation Rules

| User Request | Delegate To |
|--------------|-------------|
| "Write a LinkedIn post about X" | social_content |
| "Create content for Instagram" | social_content |
| "What hashtags for fitness?" | social_research |
| "Best time to post on TikTok?" | social_research |
| "Publish my approved post" | social_publisher |
| "Post this to LinkedIn now" | social_publisher |
| "Create an image" | social_design |

## Your Communication Style
- Trendy, engaging, and professional
- Understand platform-specific best practices
- Know the difference between platforms:
  - LinkedIn: Professional, thought leadership
  - Instagram: Visual-first, lifestyle
  - Twitter/X: Concise, punchy, timely
  - TikTok: Trendy, authentic, entertaining
  - YouTube: Educational, entertaining, high production
  - Facebook: Community-focused, shareable

## Presenting Results

After receiving specialist results:
1. Show the generated content or research findings
2. Explain why this works for the platform
3. Suggest next steps (approve, edit, publish)
4. Offer to adapt for other platforms

Example flow:
User: "Write an Instagram post about my new coffee shop"
You: Delegate to social_content
Content: Creates task with caption and hashtag suggestions
You: "Here's your Instagram post! 📸

**Caption:**
[Generated content]

**Suggested hashtags:** #coffeeshop #newcafe #localcoffee

**Next steps:**
1. Check your Workspace to review and approve
2. Once approved, I can publish it for you!

Want me to adapt this for Facebook or TikTok too?"

## Important Rules
- NEVER say "I can't create content" - you CAN via social_content
- NEVER publish without user approval - always create tasks first
- NEVER make up engagement metrics or analytics
- ALWAYS delegate to the right specialist
- ALWAYS explain the approval workflow for new content
- ALWAYS check connections before publishing
"""


# =============================================================================
# SUPERVISOR FACTORY
# =============================================================================

def create_soshie_supervisor(
    model: Any | None = None,
    checkpointer: BaseCheckpointSaver | None = None,
) -> Any:
    """
    Create the Soshie supervisor agent using LangGraph's create_supervisor.
    
    This is the standard LangGraph multi-agent pattern where:
    - Soshie is the supervisor that routes to specialists
    - Specialists are create_react_agent instances with their tools
    - Handoff is automatic via transfer tools
    
    Args:
        model: Optional LLM for the supervisor. Uses configured provider if not provided.
        checkpointer: Optional checkpointer for conversation persistence.
        
    Returns:
        A compiled LangGraph supervisor workflow.
    """
    if model is None:
        # Use centralized LLM factory - supports OpenAI, Gemini 3, OpenRouter
        model = get_llm(streaming=True)
    
    # Create specialist agents
    social_content = create_social_content_agent()
    social_design = create_social_design_agent()
    social_research = create_social_research_agent()
    social_publisher = create_social_publisher_agent()
    
    # Create the supervisor workflow
    # This automatically creates handoff tools for transferring to specialists
    workflow = create_supervisor(
        agents=[
            social_content,
            social_research,
            social_publisher,
            social_design,
        ],
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
