"""
Content Creation Workflow

LangGraph-based workflow implementing three advanced patterns:
1. Parallelization - Research tasks run simultaneously via asyncio.gather()
2. Prompt Chaining - Sequential content creation pipeline
3. Evaluator-Optimizer - Quality loop with feedback (max 3 iterations)

Workflow Steps:
1. parallel_research - Runs all 4 research tasks simultaneously:
   - research_hashtags: Platform-specific hashtag suggestions
   - research_timing: Optimal posting times
   - research_ideas: Content angle/hook ideas
   - research_competitor: Competitive analysis framework
2. validate_research - Ensure we have sufficient research data
3. create_brief - Synthesize research into actionable content brief
4. generate_draft - LLM creates initial content following brief
5. evaluate_content - LLM grades quality (platform fit, engagement, clarity, CTA)
6. refine_content - Incorporate feedback (loops back to evaluate, max 3x)
7. polish_final - Final formatting, hashtag formatting, metadata
8. create_task - Save to workspace as pending_approval task

This workflow can be invoked as an agent by Soshie supervisor.
The parallel research pattern uses asyncio.gather() for true concurrent execution.
"""

from __future__ import annotations

import logging
from typing import TypedDict, Optional, Annotated, List, Any

from langchain_core.messages import BaseMessage, HumanMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.base import BaseCheckpointSaver

# NOTE: Do NOT import from app.agents.base at module level!
# This causes circular import: content_workflow -> agents.base -> agents/__init__ -> soshie -> content_workflow
# Instead, we use lazy import inside functions that need get_llm

from app.schemas.content_workflow import (
    HashtagResearch,
    TimingResearch,
    ContentIdeasResearch,
    CompetitorInsight,
    ContentBrief,
    DraftContent,
    ContentFeedback,
    FinalContent,
)

logger = logging.getLogger(__name__)


# =============================================================================
# WORKFLOW CAPABILITIES (Self-Describing)
# =============================================================================

WORKFLOW_CAPABILITIES = {
    "name": "content_workflow",
    "description": "Creates text-based social media content with research, evaluation, and multi-platform adaptation",
    "supported_platforms": ["linkedin", "instagram", "twitter", "facebook", "tiktok"],
    "content_types": ["post", "thread"],
    "required_fields": ["request", "platforms", "user_id"],
    "what_i_do": [
        "Research hashtags, timing, and content ideas",
        "Generate and evaluate content quality",
        "Adapt content for multiple platforms",
        "Create workspace tasks for approval",
    ],
    "what_i_cannot_do": [
        "Create video content (YouTube, TikTok videos)",
        "Post directly without user approval",
        "Create content for unsupported platforms",
    ],
}


# =============================================================================
# WORKFLOW STATE
# =============================================================================

class ResearchTaskState(TypedDict):
    """State for individual parallel research tasks."""
    topic: str
    platform: str
    content_type: str


class ContentWorkflowState(TypedDict):
    """
    Main state for the content creation workflow.
    
    This state flows through all nodes and accumulates results.
    Supports multi-platform content creation via the "Create Master -> Adapt" pattern.
    
    Self-describing: Returns workflow_status and capabilities so supervisor
    can handle any outcome gracefully.
    """
    # Input from user/supervisor
    request: str
    content_type: str
    user_id: str
    agent_slug: str
    
    # Multi-platform support (LangGraph standard: explicit state fields)
    platforms: List[str]              # Target platforms ["linkedin", "instagram", ...]
    master_platform: str              # First platform, used for master content
    
    # ==========================================================================
    # SELF-DESCRIBING RESPONSE (supervisor reads these to handle result)
    # ==========================================================================
    workflow_status: str              # "success" | "cannot_proceed" | "not_connected" | "error"
    error_type: Optional[str]         # "invalid_platforms" | "missing_field" | "unknown_request" | etc.
    error_detail: Optional[str]       # Human-readable explanation
    capabilities: Optional[dict]      # WORKFLOW_CAPABILITIES (so supervisor knows what we can do)
    
    # Connection validation results
    connected_platforms: List[str]           # Platforms user has connected
    disconnected_platforms: List[str]        # Requested but not connected
    unsupported_platforms: List[str]         # Requested but we can't handle (e.g., youtube)
    
    # Research results (populated by parallel tasks)
    # Research is done for master_platform, adaptations inherit insights
    hashtag_research: Optional[dict]
    timing_research: Optional[dict]
    content_ideas: Optional[dict]
    competitor_insights: Optional[dict]
    
    # Pipeline stages
    content_brief: Optional[dict]
    draft_content: Optional[dict]
    evaluation: Optional[dict]
    iteration_count: int
    
    # Master content (after polish, before adaptation)
    master_content: Optional[dict]
    
    # Multi-platform output
    adapted_content: Optional[dict]   # {platform: {text, hashtags}} for all platforms
    content_group_id: Optional[str]   # Links related tasks together
    task_ids: List[str]               # All created task IDs
    failed_platforms: List[str]       # Platforms that failed task creation
    
    # Legacy single-platform fields (kept for backward compatibility)
    platform: str                     # Alias for master_platform
    final_content: Optional[dict]     # Alias for master_content
    task_id: Optional[str]            # First task ID (for single-platform calls)
    
    # Messages for supervisor compatibility
    messages: Annotated[List[BaseMessage], add_messages]
    
    # UI actions for frontend (e.g., connection prompts)
    ui_actions: List[dict]
    
    # Error handling
    error: Optional[str]


# =============================================================================
# VALIDATE REQUEST NODE (Entry Point - Self-Describing)
# =============================================================================

async def validate_request(state: ContentWorkflowState) -> dict:
    """
    Validate request before starting content creation.
    
    This is the single entry point that checks ALL prerequisites:
    1. Platforms provided (required)
    2. Platforms are supported (filter unsupported)
    3. Platforms are connected (check DB)
    
    Returns self-describing status so supervisor can handle any outcome:
    - workflow_status: "success" | "cannot_proceed" | "not_connected"
    - error_type: explains why (for cannot_proceed)
    - capabilities: WORKFLOW_CAPABILITIES (so supervisor knows what we can do)
    
    This pattern allows the supervisor to handle ANY validation failure gracefully
    without hardcoding conditions for each error type.
    """
    from app.services.connection_service import get_connection_service
    
    platforms = state.get("platforms") or [state.get("platform")]
    user_id = state.get("user_id")
    request = state.get("request", "")
    
    # ---------------------------------------------------------------------------
    # Step 1: Check if platforms provided
    # ---------------------------------------------------------------------------
    if not platforms or platforms == [None]:
        logger.info("No platforms provided in request")
        return {
            "workflow_status": "cannot_proceed",
            "error_type": "missing_platforms",
            "error_detail": "No platforms specified in the request.",
            "capabilities": WORKFLOW_CAPABILITIES,
            "connected_platforms": [],
            "disconnected_platforms": [],
            "unsupported_platforms": [],
        }
    
    # Normalize platforms to lowercase
    platforms = [p.lower() for p in platforms if p]
    
    # ---------------------------------------------------------------------------
    # Step 2: Check if platforms are supported
    # ---------------------------------------------------------------------------
    supported = WORKFLOW_CAPABILITIES["supported_platforms"]
    supported_requested = [p for p in platforms if p in supported]
    unsupported_requested = [p for p in platforms if p not in supported]
    
    if unsupported_requested:
        logger.info(f"Unsupported platforms requested: {unsupported_requested}")
    
    if not supported_requested:
        # ALL platforms are unsupported (e.g., user asked for YouTube only)
        return {
            "workflow_status": "cannot_proceed",
            "error_type": "unsupported_platforms",
            "error_detail": f"I can't create content for {', '.join(p.title() for p in unsupported_requested)}. {WORKFLOW_CAPABILITIES['what_i_cannot_do'][0]}",
            "capabilities": WORKFLOW_CAPABILITIES,
            "connected_platforms": [],
            "disconnected_platforms": [],
            "unsupported_platforms": unsupported_requested,
        }
    
    # ---------------------------------------------------------------------------
    # Step 3: Check if user_id provided (for connection check)
    # ---------------------------------------------------------------------------
    if not user_id:
        logger.warning("No user_id in state, skipping connection check")
        # Proceed with supported platforms, assuming connected
        return {
            "workflow_status": "success",
            "capabilities": WORKFLOW_CAPABILITIES,
            "platforms": supported_requested,
            "master_platform": supported_requested[0],
            "connected_platforms": supported_requested,
            "disconnected_platforms": [],
            "unsupported_platforms": unsupported_requested,
        }
    
    # ---------------------------------------------------------------------------
    # Step 4: Check connections for supported platforms
    # ---------------------------------------------------------------------------
    try:
        connection_service = get_connection_service()
        all_connections = await connection_service.get_user_connections(user_id)
        connected = [c.platform for c in all_connections if c.status == "active"]
        
        logger.info(f"User {user_id} connections: {connected}, requested: {supported_requested}")
        
        connected_requested = [p for p in supported_requested if p in connected]
        disconnected_requested = [p for p in supported_requested if p not in connected]
        
        if not disconnected_requested:
            # All supported platforms are connected - full success
            logger.info("All requested platforms are connected, proceeding")
            return {
                "workflow_status": "success",
                "capabilities": WORKFLOW_CAPABILITIES,
                "platforms": supported_requested,
                "master_platform": supported_requested[0],
                "connected_platforms": connected_requested,
                "disconnected_platforms": [],
                "unsupported_platforms": unsupported_requested,
            }
        
        # Some or all platforms not connected
        ui_actions = list(state.get("ui_actions") or [])
        ui_actions.append({
            "type": "connection_prompt",
            "platforms": disconnected_requested,
            "message": "Connect to continue",
        })
        
        if connected_requested:
            # SOME connected - partial success possible
            logger.info(f"Some platforms connected: {connected_requested}, disconnected: {disconnected_requested}")
            return {
                "workflow_status": "not_connected",
                "error_type": "partial_connection",
                "error_detail": f"{', '.join(p.title() for p in disconnected_requested)} not connected.",
                "capabilities": WORKFLOW_CAPABILITIES,
                "platforms": supported_requested,
                "master_platform": supported_requested[0],
                "connected_platforms": connected_requested,
                "disconnected_platforms": disconnected_requested,
                "unsupported_platforms": unsupported_requested,
                "ui_actions": ui_actions,
            }
        else:
            # NONE connected
            logger.info(f"No requested platforms connected: {disconnected_requested}")
            return {
                "workflow_status": "not_connected",
                "error_type": "no_connection",
                "error_detail": f"None of the requested platforms are connected.",
                "capabilities": WORKFLOW_CAPABILITIES,
                "platforms": supported_requested,
                "connected_platforms": [],
                "disconnected_platforms": disconnected_requested,
                "unsupported_platforms": unsupported_requested,
                "ui_actions": ui_actions,
            }
        
    except Exception as e:
        logger.error(f"Failed to check connections: {e}")
        return {
            "workflow_status": "error",
            "error_type": "connection_check_failed",
            "error_detail": f"Could not verify platform connections: {str(e)}",
            "capabilities": WORKFLOW_CAPABILITIES,
            "connected_platforms": [],
            "disconnected_platforms": [],
            "unsupported_platforms": unsupported_requested,
            "error": str(e),
        }


def route_after_validation(state: ContentWorkflowState) -> str:
    """
    Conditional routing after validation.
    
    - workflow_status == "success" → proceed to parallel_research
    - Any other status → halt workflow (return END)
    
    The supervisor reads workflow_status to handle non-success cases.
    """
    status = state.get("workflow_status", "")
    
    if status == "success":
        logger.info("Validation passed, proceeding to content creation")
        return "parallel_research"
    
    logger.info(f"Validation returned status '{status}', halting workflow")
    return END


# =============================================================================
# RESEARCH NODES (Parallel Execution)
# =============================================================================

async def research_hashtags(state: ResearchTaskState) -> dict:
    """
    Research relevant hashtags for the topic and platform.
    
    Uses the suggest_hashtags tool logic from social_research.
    """
    topic = state.get("topic", "")
    platform = state.get("platform", "instagram").lower()
    
    # Platform-specific hashtag guidelines
    guidelines = {
        "instagram": {"max": 10, "tip": "Mix popular with niche tags"},
        "twitter": {"max": 2, "tip": "1-2 highly relevant tags only"},
        "linkedin": {"max": 5, "tip": "Professional, industry-specific"},
        "tiktok": {"max": 5, "tip": "Include trending + topic hashtags"},
        "facebook": {"max": 3, "tip": "Sparingly, focus on content"},
    }
    
    guide = guidelines.get(platform, guidelines["instagram"])
    
    # Generate topic-based hashtags
    topic_lower = topic.lower().replace(" ", "")
    suggested = [
        topic_lower,
        f"{topic_lower}tips",
        f"{topic_lower}content",
        f"{topic_lower}strategy",
        "contentcreator",
    ][:guide["max"]]
    
    return {
        "hashtag_research": {
            "topic": topic,
            "platform": platform,
            "suggested_hashtags": suggested,
            "platform_tip": guide["tip"],
            "max_recommended": guide["max"],
        }
    }


async def research_timing(state: ResearchTaskState) -> dict:
    """
    Research optimal posting times for the platform.
    
    Uses the analyze_best_posting_time tool logic.
    """
    platform = state.get("platform", "instagram").lower()
    content_type = state.get("content_type", "post")
    
    # Platform-specific timing data
    timing_data = {
        "instagram": {
            "best_days": ["Tuesday", "Wednesday", "Thursday"],
            "best_hours": ["11am-1pm", "7pm-9pm"],
            "avoid": "Late night (12am-6am)",
            "note": "Stories perform best in morning, Reels in evening",
        },
        "linkedin": {
            "best_days": ["Tuesday", "Wednesday", "Thursday"],
            "best_hours": ["7am-8am", "12pm", "5pm-6pm"],
            "avoid": "Weekends and late evenings",
            "note": "B2B content performs best mid-week mornings",
        },
        "twitter": {
            "best_days": ["Tuesday", "Wednesday", "Thursday"],
            "best_hours": ["8am-10am", "12pm-1pm"],
            "avoid": "Weekends (lower engagement)",
            "note": "News/trends peak early morning",
        },
        "tiktok": {
            "best_days": ["Tuesday", "Thursday", "Friday"],
            "best_hours": ["7pm-9pm", "12pm-3pm"],
            "avoid": "Early mornings",
            "note": "Younger audience most active in evenings",
        },
        "facebook": {
            "best_days": ["Wednesday", "Thursday", "Friday"],
            "best_hours": ["9am-1pm"],
            "avoid": "Late night",
            "note": "Engagement drops significantly on weekends",
        },
    }
    
    times = timing_data.get(platform, timing_data["instagram"])
    
    return {
        "timing_research": {
            "platform": platform,
            "content_type": content_type,
            "best_days": times["best_days"],
            "best_hours": times["best_hours"],
            "avoid": times["avoid"],
            "recommendation": times["note"],
        }
    }


async def research_ideas(state: ResearchTaskState) -> dict:
    """
    Generate content ideas for the topic.
    
    Uses the research_content_ideas tool logic.
    """
    topic = state.get("topic", "")
    platform = state.get("platform", "instagram")
    
    # Generate content angle ideas
    ideas = [
        {
            "title": f"5 Common {topic} Mistakes to Avoid",
            "format": "carousel",
            "hook": f"Stop making these {topic} mistakes! 🚫",
        },
        {
            "title": f"How I Improved My {topic} in 30 Days",
            "format": "video",
            "hook": f"My {topic} transformation story 📈",
        },
        {
            "title": f"The Ultimate {topic} Guide for Beginners",
            "format": "carousel",
            "hook": f"New to {topic}? Start here 👇",
        },
    ]
    
    format_tips = {
        "instagram": "Carousels get 3x more engagement. Reels reach 2x more people.",
        "linkedin": "Document posts (PDF carousels) get 3x more clicks.",
        "twitter": "Threads perform well for long-form. Images boost engagement 150%.",
        "tiktok": "Trend-based content and tutorials perform best. Keep under 60s.",
    }
    
    return {
        "content_ideas": {
            "topic": topic,
            "platform": platform,
            "ideas": ideas,
            "format_tip": format_tips.get(platform, "Match content to platform strengths."),
        }
    }


async def research_competitor(state: ResearchTaskState) -> dict:
    """
    Provide competitor analysis framework.
    
    Uses the analyze_competitor tool logic.
    """
    topic = state.get("topic", "")
    platform = state.get("platform", "instagram")
    
    return {
        "competitor_insights": {
            "topic": topic,
            "platform": platform,
            "analysis_framework": {
                "content_types": "Note what formats they use most",
                "posting_frequency": "Track how often they post",
                "engagement_patterns": "Which posts get most engagement",
                "hashtag_strategy": "What hashtags they consistently use",
            },
            "what_to_learn": [
                "Their most engaging content types",
                "Topics that resonate with shared audience",
                "Gaps in their content you can fill",
            ],
        }
    }


# =============================================================================
# PARALLEL RESEARCH EXECUTION
# =============================================================================

async def run_parallel_research(state: ContentWorkflowState) -> dict:
    """
    Run all research tasks in parallel using asyncio.gather().
    
    This is the production-standard way to parallelize multiple
    independent async operations in a single LangGraph node.
    
    All 4 research tasks run simultaneously:
    - research_hashtags: Platform-specific hashtag suggestions
    - research_timing: Optimal posting times analysis  
    - research_ideas: Content angle and hook ideas
    - research_competitor: Competitive analysis framework
    
    Returns:
        dict: Aggregated research results to merge into workflow state
    """
    import asyncio
    
    topic = state.get("request", "")
    # Use master_platform for research (research is done for master, adaptations inherit)
    platform = state.get("master_platform") or state.get("platform", "linkedin")
    content_type = state.get("content_type", "post")
    
    research_input: ResearchTaskState = {
        "topic": topic,
        "platform": platform,
        "content_type": content_type,
    }
    
    logger.info(f"Starting parallel research for: {topic} on {platform}")
    
    # Run all research tasks concurrently
    try:
        results = await asyncio.gather(
            research_hashtags(research_input),
            research_timing(research_input),
            research_ideas(research_input),
            research_competitor(research_input),
            return_exceptions=True,  # Don't fail if one research fails
        )
        
        # Merge results into state update
        state_update = {}
        
        for result in results:
            if isinstance(result, Exception):
                logger.warning(f"Research task failed: {result}")
                continue
            if isinstance(result, dict):
                state_update.update(result)
        
        logger.info(f"Research complete: {list(state_update.keys())}")
        return state_update
        
    except Exception as e:
        logger.error(f"Parallel research failed: {e}")
        return {"error": f"Research failed: {str(e)}"}


def validate_research(state: ContentWorkflowState) -> dict:
    """
    Validate that we have sufficient research to proceed.
    
    This node checks research results and sets error if insufficient.
    """
    logger.info("Validating research results")
    
    # Check what research we have
    has_research = bool(
        state.get("hashtag_research") or
        state.get("timing_research") or
        state.get("content_ideas")
    )
    
    if not has_research:
        logger.warning("No research data collected")
        return {"error": "Research failed - no data collected"}
    
    research_types = []
    if state.get("hashtag_research"):
        research_types.append("hashtags")
    if state.get("timing_research"):
        research_types.append("timing")
    if state.get("content_ideas"):
        research_types.append("ideas")
    if state.get("competitor_insights"):
        research_types.append("competitor")
    
    logger.info(f"Research validated: {research_types}")
    return {}


# =============================================================================
# CONTENT BRIEF NODE
# =============================================================================

async def create_brief(state: ContentWorkflowState) -> dict:
    """
    Synthesize research into an actionable content brief.
    
    This node uses LLM to create a structured brief from all research.
    """
    if state.get("error"):
        return {}
    
    logger.info("Creating content brief from research")
    
    # Gather research data
    hashtag_data = state.get("hashtag_research", {})
    timing_data = state.get("timing_research", {})
    ideas_data = state.get("content_ideas", {})
    
    request = state.get("request", "")
    # Use master_platform for content creation
    platform = state.get("master_platform") or state.get("platform", "linkedin")
    content_type = state.get("content_type", "post")
    
    # Build brief from research
    best_time = ""
    if timing_data:
        days = timing_data.get("best_days", [])
        hours = timing_data.get("best_hours", [])
        if days and hours:
            best_time = f"{days[0]} at {hours[0]}"
    
    # Get content angle from ideas
    content_angle = ""
    if ideas_data and ideas_data.get("ideas"):
        first_idea = ideas_data["ideas"][0]
        content_angle = first_idea.get("hook", "")
    
    # Platform-specific guidelines
    platform_guidelines = {
        "linkedin": {
            "tone": "professional",
            "target_length": "150-300 words",
            "tips": ["Use line breaks for readability", "Start with a hook", "End with CTA/question"],
        },
        "twitter": {
            "tone": "engaging",
            "target_length": "max 280 chars per tweet",
            "tips": ["Punchy first line", "Use numbers", "1-2 hashtags max"],
        },
        "instagram": {
            "tone": "authentic",
            "target_length": "125-150 chars for engagement",
            "tips": ["Front-load important info", "Use emojis strategically", "Strong CTA"],
        },
        "tiktok": {
            "tone": "casual",
            "target_length": "short and punchy",
            "tips": ["Hook in first 3 seconds", "Trendy language", "Clear value prop"],
        },
    }
    
    guidelines = platform_guidelines.get(platform, platform_guidelines["instagram"])
    
    brief = {
        "topic": request,
        "platform": platform,
        "content_type": content_type,
        "target_hashtags": hashtag_data.get("suggested_hashtags", [])[:5],
        "best_posting_time": best_time,
        "content_angle": content_angle,
        "tone": guidelines["tone"],
        "target_length": guidelines["target_length"],
        "key_points": [
            f"Address: {request}",
            "Provide actionable value",
            "Include clear call-to-action",
        ],
        "call_to_action": "Engage with a question or action prompt",
        "platform_tips": guidelines["tips"],
    }
    
    return {"content_brief": brief}


# =============================================================================
# DRAFT GENERATION NODE
# =============================================================================

async def generate_draft(state: ContentWorkflowState) -> dict:
    """
    Generate initial content draft following the brief.
    
    Uses LLM to create platform-appropriate content.
    """
    if state.get("error"):
        return {}
    
    logger.info("Generating content draft")
    
    brief = state.get("content_brief", {})
    if not brief:
        return {"error": "No content brief available"}
    
    platform = brief.get("platform", "instagram")
    topic = brief.get("topic", "")
    tone = brief.get("tone", "professional")
    target_length = brief.get("target_length", "150 words")
    hashtags = brief.get("target_hashtags", [])
    tips = brief.get("platform_tips", [])
    
    # Lazy import to avoid circular dependency
    from app.agents.base import get_llm
    
    # Create prompt for draft generation
    llm = get_llm(streaming=False)
    
    prompt = f"""Create a {platform} post about: {topic}

Requirements:
- Tone: {tone}
- Length: {target_length}
- Include a strong hook in the first line
- End with a call-to-action
- Platform tips: {', '.join(tips)}

Write ONLY the post content. No explanations or meta-commentary.
"""

    response = await llm.ainvoke([HumanMessage(content=prompt)])
    generated_text = response.content.strip()
    
    draft = {
        "platform": platform,
        "content_type": state.get("content_type", "post"),
        "text": generated_text,
        "hashtags": hashtags,
        "hook": generated_text.split('\n')[0] if generated_text else "",
        "call_to_action": brief.get("call_to_action", ""),
    }
    
    return {"draft_content": draft, "iteration_count": 1}


# =============================================================================
# EVALUATION NODE
# =============================================================================

async def evaluate_content(state: ContentWorkflowState) -> dict:
    """
    Evaluate content quality using structured output.
    
    Grades the draft on platform fit, engagement potential,
    clarity, and CTA effectiveness.
    """
    if state.get("error"):
        return {}
    
    logger.info(f"Evaluating content (iteration {state.get('iteration_count', 1)})")
    
    draft = state.get("draft_content", {})
    if not draft:
        return {"error": "No draft content to evaluate"}
    
    platform = draft.get("platform", "instagram")
    text = draft.get("text", "")
    
    # Lazy import to avoid circular dependency
    from app.agents.base import get_llm
    
    # Use LLM with structured output for evaluation
    llm = get_llm(streaming=False)
    
    eval_prompt = f"""Evaluate this {platform} post for quality:

POST:
{text}

Score each aspect from 1-10:
1. Platform Fit: Does it follow {platform} conventions and best practices?
2. Engagement Potential: Will it get likes, comments, shares?
3. Clarity: Is the message clear and easy to understand?
4. CTA Effectiveness: Does it have a compelling call-to-action?

Respond in this exact JSON format:
{{
    "grade": "pass" or "needs_improvement",
    "platform_fit_score": <1-10>,
    "engagement_score": <1-10>,
    "clarity_score": <1-10>,
    "cta_score": <1-10>,
    "feedback": "<specific improvement suggestions>",
    "issues": ["<issue 1>", "<issue 2>"]
}}

Grade as "pass" if average score is 7+ and no major issues.
"""

    response = await llm.ainvoke([HumanMessage(content=eval_prompt)])
    
    # Parse the response (handle both JSON and plain text)
    import json
    try:
        # Try to extract JSON from response
        content = response.content.strip()
        # Find JSON in response
        start = content.find('{')
        end = content.rfind('}') + 1
        if start != -1 and end > start:
            json_str = content[start:end]
            evaluation = json.loads(json_str)
        else:
            # Default evaluation if parsing fails
            evaluation = {
                "grade": "pass",
                "platform_fit_score": 7,
                "engagement_score": 7,
                "clarity_score": 7,
                "cta_score": 7,
                "feedback": "Content looks good.",
                "issues": [],
            }
    except (json.JSONDecodeError, ValueError):
        # Default to pass if we can't parse
        evaluation = {
            "grade": "pass",
            "platform_fit_score": 7,
            "engagement_score": 7,
            "clarity_score": 7,
            "cta_score": 7,
            "feedback": "Content evaluated.",
            "issues": [],
        }
    
    # Calculate overall score
    scores = [
        evaluation.get("platform_fit_score", 7),
        evaluation.get("engagement_score", 7),
        evaluation.get("clarity_score", 7),
        evaluation.get("cta_score", 7),
    ]
    evaluation["overall_score"] = sum(scores) / len(scores)
    
    logger.info(f"Evaluation: {evaluation['grade']}, score: {evaluation['overall_score']:.1f}")
    
    return {"evaluation": evaluation}


# =============================================================================
# REFINEMENT NODE
# =============================================================================

async def refine_content(state: ContentWorkflowState) -> dict:
    """
    Refine content based on evaluation feedback.
    
    Incorporates specific feedback to improve the draft.
    """
    if state.get("error"):
        return {}
    
    iteration = state.get("iteration_count", 1)
    logger.info(f"Refining content (iteration {iteration + 1})")
    
    draft = state.get("draft_content", {})
    evaluation = state.get("evaluation", {})
    brief = state.get("content_brief", {})
    
    current_text = draft.get("text", "")
    feedback = evaluation.get("feedback", "")
    issues = evaluation.get("issues", [])
    
    # Lazy import to avoid circular dependency
    from app.agents.base import get_llm
    
    # Create refinement prompt
    llm = get_llm(streaming=False)
    
    prompt = f"""Improve this {draft.get('platform', 'social media')} post based on feedback:

CURRENT POST:
{current_text}

FEEDBACK:
{feedback}

ISSUES TO FIX:
{chr(10).join(f'- {issue}' for issue in issues) if issues else 'None specified'}

REQUIREMENTS:
- Keep the core message
- Address the feedback
- Maintain {brief.get('tone', 'professional')} tone
- Target length: {brief.get('target_length', '150 words')}

Write ONLY the improved post. No explanations.
"""

    response = await llm.ainvoke([HumanMessage(content=prompt)])
    refined_text = response.content.strip()
    
    # Update draft with refined content
    refined_draft = {
        **draft,
        "text": refined_text,
        "hook": refined_text.split('\n')[0] if refined_text else "",
    }
    
    return {
        "draft_content": refined_draft,
        "iteration_count": iteration + 1,
    }


# =============================================================================
# ROUTING FUNCTION
# =============================================================================

def route_after_evaluation(state: ContentWorkflowState) -> str:
    """
    Route based on evaluation results.
    
    Decides whether to polish (pass) or refine (needs work).
    Max 3 iterations to prevent infinite loops.
    """
    evaluation = state.get("evaluation", {})
    iteration = state.get("iteration_count", 1)
    
    # Max iterations check
    if iteration >= 3:
        logger.info(f"Max iterations ({iteration}) reached, proceeding to polish")
        return "polish_final"
    
    # Check grade
    grade = evaluation.get("grade", "pass")
    overall_score = evaluation.get("overall_score", 7)
    
    if grade == "pass" and overall_score >= 7:
        logger.info(f"Content passed evaluation (score: {overall_score:.1f})")
        return "polish_final"
    else:
        logger.info(f"Content needs improvement (score: {overall_score:.1f})")
        return "refine_content"


# =============================================================================
# POLISH NODE
# =============================================================================

async def polish_final(state: ContentWorkflowState) -> dict:
    """
    Final polish and formatting of master content.
    
    Ensures proper formatting, hashtags, and platform conventions.
    Sets master_content for potential multi-platform adaptation.
    """
    if state.get("error"):
        return {}
    
    logger.info("Polishing master content")
    
    draft = state.get("draft_content", {})
    evaluation = state.get("evaluation", {})
    
    master_platform = state.get("master_platform") or state.get("platform", "linkedin")
    text = draft.get("text", "")
    hashtags = draft.get("hashtags", [])
    
    # Format hashtags properly
    formatted_hashtags = [f"#{tag.lstrip('#')}" for tag in hashtags if tag]
    
    # Build research insights for metadata
    research_insights = {
        "suggested_hashtags": state.get("hashtag_research", {}).get("suggested_hashtags", []),
        "best_posting_time": state.get("timing_research", {}).get("best_hours", ["Anytime"])[0] if state.get("timing_research") else "",
        "best_posting_days": state.get("timing_research", {}).get("best_days", []),
        "content_tip": state.get("content_ideas", {}).get("format_tip", ""),
    }
    
    master_content = {
        "platform": master_platform,
        "content_type": state.get("content_type", "post"),
        "text": text,
        "hashtags": formatted_hashtags,
        "research_insights": research_insights,
        "evaluation_score": evaluation.get("overall_score", 7.0),
        "iterations_needed": state.get("iteration_count", 1),
    }
    
    # Set both master_content and final_content (backward compatibility)
    return {
        "master_content": master_content,
        "final_content": master_content,  # Alias for single-platform compatibility
    }


# =============================================================================
# ADAPT FOR PLATFORMS NODE
# =============================================================================

def _create_simple_adaptation(master: dict, platform: str) -> dict:
    """
    Fallback: rule-based adaptation without LLM.
    
    Used when JSON parsing fails or as a safety net.
    """
    text = master.get("text", "")
    hashtags = master.get("hashtags", [])
    
    # Platform-specific length limits and adjustments
    adaptations = {
        "twitter": {"max_len": 250, "max_tags": 2, "suffix": ""},
        "instagram": {"max_len": 2200, "max_tags": 10, "suffix": ""},
        "tiktok": {"max_len": 300, "max_tags": 5, "suffix": ""},
        "facebook": {"max_len": 500, "max_tags": 3, "suffix": ""},
        "linkedin": {"max_len": 3000, "max_tags": 5, "suffix": ""},
    }
    
    config = adaptations.get(platform, {"max_len": 500, "max_tags": 5, "suffix": ""})
    
    # Truncate text if needed
    if len(text) > config["max_len"]:
        text = text[:config["max_len"] - 3] + "..."
    
    # Limit hashtags
    limited_hashtags = hashtags[:config["max_tags"]]
    
    return {
        "text": text,
        "hashtags": limited_hashtags,
        "platform": platform,
        "adapted_from": master.get("platform", "master"),
    }


async def adapt_for_platforms(state: ContentWorkflowState) -> dict:
    """
    Adapt master content for other platforms in a SINGLE LLM call.
    
    This is the efficient multi-platform pattern:
    - Master content is already created and polished
    - One LLM call produces all platform adaptations
    - Falls back to rule-based adaptation if LLM fails
    
    LangGraph standard: This node only handles adaptation logic,
    state management is handled by the reducer.
    """
    import json
    import uuid
    
    master = state.get("master_content", {})
    platforms = state.get("platforms") or [state.get("platform", "linkedin")]
    master_platform = state.get("master_platform") or platforms[0]
    
    # Generate content group ID for linking tasks
    content_group_id = f"grp_{uuid.uuid4().hex[:8]}"
    
    # If only one platform, no adaptation needed
    if len(platforms) <= 1:
        logger.info(f"Single platform ({master_platform}), skipping adaptation")
        return {
            "adapted_content": {master_platform: master},
            "content_group_id": content_group_id,
        }
    
    # Get other platforms that need adaptation
    other_platforms = [p for p in platforms if p != master_platform]
    logger.info(f"Adapting master ({master_platform}) for: {other_platforms}")
    
    # Platform-specific guidelines for LLM
    platform_guidelines = {
        "linkedin": "Professional tone, 150-300 words, line breaks for readability",
        "twitter": "Punchy and concise, max 280 characters, 1-2 hashtags only",
        "instagram": "Authentic and visual-first, 125-150 chars, strong hashtags (up to 10)",
        "tiktok": "Casual and trendy, hook in first line, short and punchy",
        "facebook": "Community-focused, conversational, moderate length",
    }
    
    # Build adaptation prompt
    guidelines_text = "\n".join(
        f"- {p.upper()}: {platform_guidelines.get(p, 'Adapt appropriately')}"
        for p in other_platforms
    )
    
    prompt = f"""Adapt this {master_platform.upper()} post for other social media platforms.

ORIGINAL {master_platform.upper()} POST:
{master.get('text', '')}

ORIGINAL HASHTAGS: {' '.join(master.get('hashtags', []))}

Adapt for these platforms, following each platform's conventions:
{guidelines_text}

IMPORTANT: Return ONLY valid JSON in this exact format (no markdown, no explanation):
{{
    "{other_platforms[0]}": {{"text": "adapted content here", "hashtags": ["#tag1", "#tag2"]}}{(',' + chr(10) + '    ').join(f'"{p}": {{"text": "...", "hashtags": [...]}}' for p in other_platforms[1:]) if len(other_platforms) > 1 else ''}
}}
"""

    # Try LLM adaptation
    try:
        from app.agents.base import get_llm
        
        llm = get_llm(streaming=False)
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        content = response.content.strip()
        
        # Extract JSON from response (handle markdown code blocks)
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        # Find JSON object
        start = content.find('{')
        end = content.rfind('}') + 1
        
        if start != -1 and end > start:
            json_str = content[start:end]
            adaptations = json.loads(json_str)
            
            # Validate and clean adaptations
            for platform in other_platforms:
                if platform in adaptations:
                    # Ensure required fields
                    if "text" not in adaptations[platform]:
                        adaptations[platform]["text"] = master.get("text", "")
                    if "hashtags" not in adaptations[platform]:
                        adaptations[platform]["hashtags"] = []
                    adaptations[platform]["platform"] = platform
                    adaptations[platform]["adapted_from"] = master_platform
                else:
                    # Platform missing from LLM response, use fallback
                    logger.warning(f"LLM didn't provide adaptation for {platform}, using fallback")
                    adaptations[platform] = _create_simple_adaptation(master, platform)
            
            logger.info(f"Successfully adapted content for {len(adaptations)} platforms via LLM")
        else:
            raise ValueError("No JSON object found in response")
            
    except (json.JSONDecodeError, ValueError, Exception) as e:
        # Fallback: rule-based adaptation
        logger.warning(f"LLM adaptation failed ({e}), using rule-based fallback")
        adaptations = {}
        for platform in other_platforms:
            adaptations[platform] = _create_simple_adaptation(master, platform)
    
    # Combine master + adaptations
    all_content = {master_platform: master}
    all_content.update(adaptations)
    
    return {
        "adapted_content": all_content,
        "content_group_id": content_group_id,
    }


# =============================================================================
# TASK CREATION NODE (Multi-Platform Support)
# =============================================================================

async def create_task_node(state: ContentWorkflowState) -> dict:
    """
    Create workspace tasks for all platforms.
    
    Handles both single-platform (backward compatible) and multi-platform cases.
    Creates one task per platform, linked by content_group_id.
    Tracks failures individually so partial success is possible.
    
    LangGraph standard: Uses partial state updates, errors don't fail entire workflow.
    """
    if state.get("error"):
        return {
            "messages": [
                HumanMessage(content=f"Error in content workflow: {state.get('error')}")
            ]
        }
    
    logger.info("Creating workspace tasks")
    
    # Get content for all platforms
    adapted_content = state.get("adapted_content", {})
    content_group_id = state.get("content_group_id")
    content_type = state.get("content_type", "post")
    request = state.get("request", "Content")
    
    # Fallback to single-platform if no adapted_content
    if not adapted_content:
        final_content = state.get("final_content", {})
        if final_content:
            platform = final_content.get("platform", "linkedin")
            adapted_content = {platform: final_content}
        else:
            return {
                "messages": [
                    HumanMessage(content="No content generated to save as task.")
                ]
            }
    
    # Task type mapping
    task_type_map = {
        ("linkedin", "post"): "linkedin_post",
        ("twitter", "post"): "tweet",
        ("twitter", "thread"): "tweet",
        ("instagram", "post"): "social_post",
        ("facebook", "post"): "social_post",
        ("tiktok", "post"): "social_post",
    }
    
    # Import task tools
    from app.tools.task import set_agent_context, clear_agent_context, create_task
    
    # Set agent context once for all tasks
    user_id = state.get("user_id")
    agent_slug = state.get("agent_slug", "soshie")
    
    if user_id:
        set_agent_context(
            agent_slug=agent_slug,
            user_id=user_id,
        )
    
    # Create task for each platform
    task_ids = []
    failed_platforms = []
    created_tasks = []
    
    try:
        for platform, content in adapted_content.items():
            task_type = task_type_map.get((platform, content_type), "social_post")
            
            # Build task content payload
            content_payload = {
                "text": content.get("text", ""),
                "hashtags": [h.lstrip('#') for h in content.get("hashtags", [])],
                "platform": platform,
                "_content_group_id": content_group_id,  # Link related tasks
                "_adapted_from": content.get("adapted_from"),
                "_research": content.get("research_insights", {}),
                "_evaluation_score": content.get("evaluation_score", 0),
            }
            
            try:
                result = await create_task.ainvoke({
                    "task_type": task_type,
                    "title": f"{platform.title()} Post: {request[:40]}",
                    "content": content_payload,
                })
                
                if result.get("success"):
                    task_id = result.get("task_id")
                    task_ids.append(task_id)
                    created_tasks.append({
                        "platform": platform,
                        "task_id": task_id,
                        "text_preview": content.get("text", "")[:100],
                    })
                    logger.info(f"Created task {task_id} for {platform}")
                else:
                    failed_platforms.append(platform)
                    logger.warning(f"Failed to create task for {platform}: {result.get('error')}")
                    
            except Exception as e:
                failed_platforms.append(platform)
                logger.error(f"Error creating task for {platform}: {e}")
                
    finally:
        clear_agent_context()
    
    # Build response message based on results
    if not task_ids:
        # All failed
        return {
            "task_ids": [],
            "failed_platforms": failed_platforms,
            "messages": [
                HumanMessage(content=f"Could not create tasks for any platform. Platforms attempted: {', '.join(failed_platforms)}")
            ],
        }
    
    # Build success message
    platforms_str = ", ".join(t["platform"].title() for t in created_tasks)
    
    message_parts = [
        f"Content created and saved to your Workspace!",
        f"",
        f"**Created {len(created_tasks)} task(s):** {platforms_str}",
    ]
    
    # Show preview of master content
    master_platform = state.get("master_platform") or list(adapted_content.keys())[0]
    master_content = adapted_content.get(master_platform, {})
    if master_content:
        message_parts.extend([
            f"",
            f"**Master Post ({master_platform.title()}):**",
            f"{master_content.get('text', '')[:200]}{'...' if len(master_content.get('text', '')) > 200 else ''}",
            f"",
            f"**Hashtags:** {' '.join(master_content.get('hashtags', [])[:5])}",
        ])
        
        # Show research insights if available
        research = master_content.get("research_insights", {})
        if research:
            message_parts.extend([
                f"",
                f"**Research Insights:**",
                f"- Best time: {research.get('best_posting_time', 'See workspace')}",
            ])
    
    # Note about other platforms if multi-platform
    if len(created_tasks) > 1:
        other_platforms = [t["platform"].title() for t in created_tasks if t["platform"] != master_platform]
        if other_platforms:
            message_parts.extend([
                f"",
                f"**Also adapted for:** {', '.join(other_platforms)}",
            ])
    
    # Note failures if any
    if failed_platforms:
        message_parts.extend([
            f"",
            f"*Could not create tasks for: {', '.join(failed_platforms)}*",
        ])
    
    message_parts.append("")
    message_parts.append("Check your Workspace to review and approve.")
    
    return {
        "task_ids": task_ids,
        "task_id": task_ids[0] if task_ids else None,  # Backward compatibility
        "failed_platforms": failed_platforms,
        "messages": [HumanMessage(content="\n".join(message_parts))],
    }


# =============================================================================
# WORKFLOW FACTORY
# =============================================================================

def create_content_workflow(
    checkpointer: Optional[BaseCheckpointSaver] = None
) -> StateGraph:
    """
    Create the content creation workflow with multi-platform support.
    
    This workflow implements:
    0. Request validation - Self-describing entry: checks platforms, support, connections
    1. Parallel research - Uses asyncio.gather() to run all 4 research tasks simultaneously
    2. Prompt chaining - Sequential: brief -> draft -> polish
    3. Evaluator-optimizer loop - evaluate -> refine (max 3x until quality passes)
    4. Multi-platform adaptation - Create master content, adapt for other platforms in single LLM call
    
    Self-Describing Pattern:
        The workflow returns workflow_status and capabilities so the supervisor can handle
        ANY validation failure gracefully without hardcoded conditions.
    
    Workflow Flow:
        Entry -> validate_request (self-describing validation)
              -> [if not success: END with status + capabilities for supervisor]
              -> parallel_research (runs hashtags, timing, ideas, competitor simultaneously)
              -> validate_research (check we have data)
              -> create_brief (synthesize research into brief)
              -> generate_draft (LLM creates content)
              -> evaluate_content (LLM grades quality)
              -> [if pass: polish_final | if fail: refine_content -> re-evaluate]
              -> adapt_for_platforms (create adaptations for other platforms)
              -> create_task (save all platforms to workspace)
              -> End
    
    Args:
        checkpointer: Optional checkpointer for persistence.
        
    Returns:
        Compiled LangGraph workflow ready for execution.
    """
    workflow = StateGraph(ContentWorkflowState)
    
    # ==========================================================================
    # ADD NODES
    # ==========================================================================
    
    # Entry: Self-describing validation (checks platforms, support, connections)
    workflow.add_node("validate_request", validate_request)
    
    # Research phase - single node that runs all 4 research tasks in parallel
    # using asyncio.gather() for true simultaneous execution
    workflow.add_node("parallel_research", run_parallel_research)
    workflow.add_node("validate_research", validate_research)
    
    # Content creation pipeline nodes
    workflow.add_node("create_brief", create_brief)
    workflow.add_node("generate_draft", generate_draft)
    workflow.add_node("evaluate_content", evaluate_content)
    workflow.add_node("refine_content", refine_content)
    workflow.add_node("polish_final", polish_final)
    
    # Multi-platform adaptation (new node)
    workflow.add_node("adapt_for_platforms", adapt_for_platforms)
    
    # Task creation (handles multiple platforms)
    workflow.add_node("create_task", create_task_node)
    
    # ==========================================================================
    # ADD EDGES
    # ==========================================================================
    
    # Entry: Start with self-describing validation
    workflow.add_edge(START, "validate_request")
    
    # Conditional: if validation passes (success), proceed; otherwise halt
    # The supervisor reads workflow_status to handle non-success cases
    workflow.add_conditional_edges(
        "validate_request",
        route_after_validation,
        {
            "parallel_research": "parallel_research",
            END: END,
        }
    )
    
    # Research phase: parallel -> validate
    workflow.add_edge("parallel_research", "validate_research")
    workflow.add_edge("validate_research", "create_brief")
    
    # Content pipeline: brief -> draft -> evaluate
    workflow.add_edge("create_brief", "generate_draft")
    workflow.add_edge("generate_draft", "evaluate_content")
    
    # Evaluation loop: pass -> polish, fail -> refine -> re-evaluate
    workflow.add_conditional_edges(
        "evaluate_content",
        route_after_evaluation,
        {
            "polish_final": "polish_final",
            "refine_content": "refine_content",
        }
    )
    
    # Refine loops back to evaluate (max 3 iterations enforced by router)
    workflow.add_edge("refine_content", "evaluate_content")
    
    # Final: Polish -> Adapt -> Task creation -> END
    workflow.add_edge("polish_final", "adapt_for_platforms")
    workflow.add_edge("adapt_for_platforms", "create_task")
    workflow.add_edge("create_task", END)
    
    # ==========================================================================
    # COMPILE
    # ==========================================================================
    
    if checkpointer:
        return workflow.compile(checkpointer=checkpointer)
    else:
        return workflow.compile()


# =============================================================================
# AGENT-COMPATIBLE WRAPPER
# =============================================================================

def create_content_workflow_agent(
    checkpointer: Optional[BaseCheckpointSaver] = None
):
    """
    Create the content workflow as an agent-compatible graph.
    
    This wrapper allows the workflow to be used as an agent
    in the Soshie supervisor's agent list.
    
    Returns:
        A compiled graph with name attribute for supervisor compatibility.
    """
    workflow = create_content_workflow(checkpointer)
    
    # Add name for supervisor routing
    workflow.name = "content_workflow"
    
    return workflow


# =============================================================================
# CONVENIENCE FUNCTION
# =============================================================================

async def run_content_workflow(
    request: str,
    platform: str = "linkedin",
    content_type: str = "post",
    user_id: str = "",
    agent_slug: str = "soshie",
    checkpointer: Optional[BaseCheckpointSaver] = None,
) -> dict:
    """
    Run the content creation workflow.
    
    Convenience function that creates and executes the workflow.
    
    Args:
        request: What to create (topic/description)
        platform: Target platform (linkedin, twitter, instagram, etc.)
        content_type: Type of content (post, thread, etc.)
        user_id: User ID for task creation
        agent_slug: Creating agent's slug
        checkpointer: Optional checkpointer for persistence
        
    Returns:
        Final workflow state with results
    """
    workflow = create_content_workflow(checkpointer)
    
    # Initial state with multi-platform support
    # For backward compatibility, single platform call sets platforms = [platform]
    initial_state: ContentWorkflowState = {
        "request": request,
        "content_type": content_type,
        "user_id": user_id,
        "agent_slug": agent_slug,
        # Multi-platform fields
        "platforms": [platform],
        "master_platform": platform,
        # Connection check fields
        "connections_checked": False,
        "connected_platforms": [],
        "disconnected_platforms": [],
        "awaiting_user_choice": False,
        # Legacy single-platform field (kept for compatibility)
        "platform": platform,
        # Research results
        "hashtag_research": None,
        "timing_research": None,
        "content_ideas": None,
        "competitor_insights": None,
        # Pipeline stages
        "content_brief": None,
        "draft_content": None,
        "evaluation": None,
        "iteration_count": 0,
        # Multi-platform output
        "master_content": None,
        "adapted_content": None,
        "content_group_id": None,
        "task_ids": [],
        "failed_platforms": [],
        # Legacy single-platform fields
        "final_content": None,
        "task_id": None,
        # Messages, UI actions, and error
        "messages": [],
        "ui_actions": [],
        "error": None,
    }
    
    # Configure thread ID for checkpointing
    config = {"configurable": {"thread_id": f"content_{user_id}_{platform}"}}
    
    # Run workflow
    result = await workflow.ainvoke(initial_state, config)
    
    return result
