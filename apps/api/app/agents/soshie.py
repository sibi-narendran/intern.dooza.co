"""
Soshie - Social Media Lead Orchestrator Agent

Uses LangGraph's create_supervisor for standard multi-agent pattern.
Soshie supervises a team of specialists and workflows:

Specialists:
- social_research: Quick research (hashtags, timing, ideas)
- social_publisher: Publishing to social platforms
- social_design: Visual content (coming soon)

Workflows:
- content_workflow: Full content creation pipeline with:
  - Parallel research (hashtags, timing, ideas, competitor)
  - Content brief creation
  - Draft generation
  - Evaluation-refinement loop (max 3 iterations)
  - Final polish and task creation

This is the production-grade, standard LangGraph architecture.
"""

from typing import Any, Optional

from langgraph_supervisor import create_supervisor
from langgraph.checkpoint.base import BaseCheckpointSaver

from app.agents.base import get_llm
from app.agents.social_design import create_social_design_agent
from app.agents.social_research import create_social_research_agent
from app.agents.social_publisher import create_social_publisher_agent
from app.workflows.content_workflow import create_content_workflow_agent


# =============================================================================
# SYSTEM PROMPT
# =============================================================================

SOSHIE_SYSTEM_PROMPT = """You are Soshie, the Social Media Lead at Dooza.

## Your Role
You are the user-facing social media expert. Users talk to you for all social media needs.
You have a team of specialists and a sophisticated content workflow at your disposal.

## Your Team

### 1. **content_workflow** - Full Content Creation Pipeline (USE FOR ALL CONTENT CREATION)
   - Automatically runs parallel research (hashtags, timing, ideas, competitor analysis)
   - Creates content brief from research
   - Generates high-quality draft content
   - Evaluates and refines content (up to 3 iterations until quality passes)
   - Creates workspace TASK for user approval
   - **USE THIS FOR**: "Write a LinkedIn post", "Create content for Instagram", "Make a Twitter thread"

### 2. **social_research** - Quick Research Specialist
   - For QUICK questions that don't need content creation
   - Has tools for: hashtag suggestions, best posting times, content ideas
   - **USE THIS FOR**: "What hashtags for fitness?", "When should I post?", "Give me content ideas"
   - DO NOT use for content creation - use content_workflow instead

### 3. **social_publisher** - Publishing Specialist
   - Has tools for: checking connected accounts, publishing to platforms
   - Can only publish APPROVED tasks from workspace
   - **USE THIS FOR**: "Publish my approved post", "Post to LinkedIn now"

### 4. **social_design** - Visual Content Specialist  
   - Coming soon: image generation, product scene creation
   - Currently: provides guidance on visual content strategy
   - **USE THIS FOR**: "Create an image", "Design a thumbnail"

## Content Creation Flow

When user asks to CREATE content (write, create, make, draft):

1. **Delegate to content_workflow** with the request
2. The workflow automatically:
   - Researches best hashtags and posting times
   - Generates content brief
   - Creates draft
   - Evaluates quality and refines if needed
   - Saves as task for approval
3. **Present the result** to the user with:
   - The generated content
   - Research insights (best time to post, hashtags)
   - Quality score
   - Next steps (review in workspace)

## Delegation Rules

| User Request | Delegate To | Why |
|--------------|-------------|-----|
| "Write a LinkedIn post about X" | content_workflow | Creates content with research |
| "Create content for Instagram" | content_workflow | Creates content with research |
| "Make a Twitter thread about Y" | content_workflow | Creates content with research |
| "What hashtags for fitness?" | social_research | Quick question, no content needed |
| "Best time to post on TikTok?" | social_research | Quick question, no content needed |
| "Give me content ideas" | social_research | Research only, no content creation |
| "Publish my approved post" | social_publisher | Publishing action |
| "Post this to LinkedIn now" | social_publisher | Publishing action |
| "Create an image" | social_design | Visual content |

## Platform Knowledge
- LinkedIn: Professional, thought leadership, 150-300 words
- Instagram: Visual-first, authentic, strong hashtag strategy
- Twitter/X: Concise, punchy, max 280 chars, 1-2 hashtags
- TikTok: Trendy, authentic, entertaining, casual tone
- YouTube: Educational, high production value
- Facebook: Community-focused, shareable

## Presenting Content Results

When content_workflow returns, present like this:

"Here's your [Platform] post! ✨

**Content:**
[The generated content]

**Hashtags:** [hashtags]

**Research Insights:**
- Best time to post: [time from research]
- Quality Score: [score]/10

📋 I've saved this to your Workspace for review.
Once approved, I can publish it for you!

Want me to adapt this for another platform?"

## Important Rules
- ALWAYS use content_workflow for content CREATION (never social_research)
- Use social_research ONLY for quick questions without content creation
- NEVER publish without user approval
- NEVER make up engagement metrics
- ALWAYS explain the approval workflow
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
    - Soshie is the supervisor that routes to specialists/workflows
    - content_workflow handles full content creation with research and evaluation
    - Other specialists handle quick tasks (research, publishing, design)
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
    
    # Create the content workflow (replaces social_content for content creation)
    # This workflow includes:
    # - Parallel research (hashtags, timing, ideas, competitor)
    # - Content brief creation
    # - Draft generation
    # - Evaluation-refinement loop (max 3 iterations)
    # - Task creation
    content_workflow = create_content_workflow_agent(checkpointer=checkpointer)
    
    # Create specialist agents for non-content-creation tasks
    social_design = create_social_design_agent()
    social_research = create_social_research_agent()
    social_publisher = create_social_publisher_agent()
    
    # Create the supervisor workflow
    # Order matters: content_workflow first for content creation routing
    workflow = create_supervisor(
        agents=[
            content_workflow,    # Full content creation pipeline
            social_research,     # Quick research questions
            social_publisher,    # Publishing to platforms
            social_design,       # Visual content (coming soon)
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
