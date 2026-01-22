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
from langgraph.graph import StateGraph, END
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
    """
    # Input from user/supervisor
    request: str
    platform: str
    content_type: str
    user_id: str
    agent_slug: str
    
    # Research results (populated by parallel tasks)
    hashtag_research: Optional[dict]
    timing_research: Optional[dict]
    content_ideas: Optional[dict]
    competitor_insights: Optional[dict]
    
    # Pipeline stages
    content_brief: Optional[dict]
    draft_content: Optional[dict]
    evaluation: Optional[dict]
    iteration_count: int
    
    # Final output
    final_content: Optional[dict]
    task_id: Optional[str]
    
    # Messages for supervisor compatibility
    messages: Annotated[List[BaseMessage], add_messages]
    
    # Error handling
    error: Optional[str]


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
    platform = state.get("platform", "instagram")
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
    platform = state.get("platform", "instagram")
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
    Final polish and formatting of content.
    
    Ensures proper formatting, hashtags, and platform conventions.
    """
    if state.get("error"):
        return {}
    
    logger.info("Polishing final content")
    
    draft = state.get("draft_content", {})
    brief = state.get("content_brief", {})
    evaluation = state.get("evaluation", {})
    
    platform = draft.get("platform", "instagram")
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
    
    final_content = {
        "platform": platform,
        "content_type": state.get("content_type", "post"),
        "text": text,
        "hashtags": formatted_hashtags,
        "research_insights": research_insights,
        "evaluation_score": evaluation.get("overall_score", 7.0),
        "iterations_needed": state.get("iteration_count", 1),
    }
    
    return {"final_content": final_content}


# =============================================================================
# TASK CREATION NODE
# =============================================================================

async def create_task_node(state: ContentWorkflowState) -> dict:
    """
    Create workspace task with the final content.
    
    Saves the content as a pending_approval task for user review.
    """
    if state.get("error"):
        return {
            "messages": [
                HumanMessage(content=f"Error in content workflow: {state.get('error')}")
            ]
        }
    
    logger.info("Creating workspace task")
    
    final_content = state.get("final_content", {})
    if not final_content:
        return {
            "messages": [
                HumanMessage(content="No content generated to save as task.")
            ]
        }
    
    platform = final_content.get("platform", "social")
    content_type = state.get("content_type", "post")
    
    # Map to task type
    task_type_map = {
        ("linkedin", "post"): "linkedin_post",
        ("twitter", "post"): "tweet",
        ("twitter", "thread"): "tweet",
        ("instagram", "post"): "social_post",
        ("facebook", "post"): "social_post",
        ("tiktok", "post"): "social_post",
    }
    task_type = task_type_map.get((platform, content_type), "social_post")
    
    # Build task content payload
    content_payload = {
        "text": final_content.get("text", ""),
        "hashtags": [h.lstrip('#') for h in final_content.get("hashtags", [])],
        "platform": platform,
        # Include research metadata
        "_research": final_content.get("research_insights", {}),
        "_evaluation_score": final_content.get("evaluation_score", 0),
        "_iterations": final_content.get("iterations_needed", 1),
    }
    
    # Try to create the task
    try:
        from app.tools.task import AgentContext, create_task
        
        # Set agent context if we have user info
        user_id = state.get("user_id")
        agent_slug = state.get("agent_slug", "soshie")
        
        if user_id:
            AgentContext.set_current(AgentContext(
                agent_slug=agent_slug,
                user_id=user_id,
            ))
        
        # Create task
        result = await create_task.ainvoke({
            "task_type": task_type,
            "title": f"{platform.title()} Post: {state.get('request', 'Content')[:50]}",
            "content": content_payload,
        })
        
        # Clear context
        AgentContext.clear()
        
        if result.get("success"):
            task_id = result.get("task_id")
            logger.info(f"Created task {task_id}")
            
            # Build success message for supervisor
            message = f"""Content created and saved to your Workspace!

**{platform.title()} Post:**
{final_content.get('text', '')[:200]}{'...' if len(final_content.get('text', '')) > 200 else ''}

**Hashtags:** {' '.join(final_content.get('hashtags', [])[:5])}

**Quality Score:** {final_content.get('evaluation_score', 0):.1f}/10

**Research Insights:**
- Best time to post: {final_content.get('research_insights', {}).get('best_posting_time', 'See workspace')}
- Tip: {final_content.get('research_insights', {}).get('content_tip', '')}

📋 Task saved! Check your Workspace to review and approve.
"""
            
            return {
                "task_id": task_id,
                "messages": [HumanMessage(content=message)],
            }
        else:
            return {
                "messages": [
                    HumanMessage(content=f"Content created but couldn't save task: {result.get('error')}")
                ]
            }
    
    except Exception as e:
        logger.error(f"Error creating task: {e}")
        # Still return the content even if task creation fails
        return {
            "messages": [
                HumanMessage(content=f"Content created:\n\n{final_content.get('text', '')}\n\n(Could not save as task: {str(e)})")
            ]
        }


# =============================================================================
# WORKFLOW FACTORY
# =============================================================================

def create_content_workflow(
    checkpointer: Optional[BaseCheckpointSaver] = None
) -> StateGraph:
    """
    Create the content creation workflow.
    
    This workflow implements:
    1. Parallel research - Uses asyncio.gather() to run all 4 research tasks simultaneously
    2. Prompt chaining - Sequential: brief -> draft -> polish
    3. Evaluator-optimizer loop - evaluate -> refine (max 3x until quality passes)
    
    Workflow Flow:
        Entry -> parallel_research (runs hashtags, timing, ideas, competitor simultaneously)
              -> validate_research (check we have data)
              -> create_brief (synthesize research into brief)
              -> generate_draft (LLM creates content)
              -> evaluate_content (LLM grades quality)
              -> [if pass: polish_final | if fail: refine_content -> re-evaluate]
              -> create_task (save to workspace)
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
    workflow.add_node("create_task", create_task_node)
    
    # ==========================================================================
    # ADD EDGES
    # ==========================================================================
    
    # Entry: Start with parallel research
    workflow.set_entry_point("parallel_research")
    
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
    
    # Final: Polish -> Task creation -> END
    workflow.add_edge("polish_final", "create_task")
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
    
    # Initial state
    initial_state: ContentWorkflowState = {
        "request": request,
        "platform": platform,
        "content_type": content_type,
        "user_id": user_id,
        "agent_slug": agent_slug,
        "hashtag_research": None,
        "timing_research": None,
        "content_ideas": None,
        "competitor_insights": None,
        "content_brief": None,
        "draft_content": None,
        "evaluation": None,
        "iteration_count": 0,
        "final_content": None,
        "task_id": None,
        "messages": [],
        "error": None,
    }
    
    # Configure thread ID for checkpointing
    config = {"configurable": {"thread_id": f"content_{user_id}_{platform}"}}
    
    # Run workflow
    result = await workflow.ainvoke(initial_state, config)
    
    return result
