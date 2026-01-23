"""
Workflow Tools for LangGraph Agents

This module exposes workflows and subagents as tools that can be called by LLM agents.
Following the standard LangGraph tool-calling pattern:
- Tools are defined with @tool decorator
- Agents call tools via structured JSON tool calls
- Tools return structured results for the agent to interpret

Tools:
- research_for_content: Invokes Research subagent for content strategy
- create_social_content: Creates content via content_workflow
- generate_image: Invokes Image Generation subagent for visual content

Usage:
    from app.tools.workflows import WORKFLOW_TOOLS
    
    agent = create_agent(model, tools=WORKFLOW_TOOLS, ...)
"""

from __future__ import annotations

import json
import logging
import re

from langchain_core.tools import tool
from langchain_core.messages import HumanMessage

from app.tools.task import get_agent_context

logger = logging.getLogger(__name__)


# =============================================================================
# SUPPORTED PLATFORMS
# =============================================================================

SUPPORTED_PLATFORMS = ["linkedin", "instagram", "twitter", "facebook", "tiktok"]


# =============================================================================
# CONTENT CREATION TOOL
# =============================================================================

@tool
async def create_social_content(
    request: str,
    platforms: list[str],
    content_type: str = "post"
) -> dict:
    """
    Create social media content for one or more platforms.
    
    Use this tool when the user wants to CREATE, WRITE, or DRAFT content.
    
    IMPORTANT: Always ask the user which platforms they want BEFORE calling this tool
    if they haven't specified. Supported platforms: linkedin, instagram, twitter, 
    facebook, tiktok.
    
    Args:
        request: What the user wants to create (e.g., "Write about AI trends", 
                 "Create a post about our new product launch")
        platforms: Target platforms as a list (e.g., ["linkedin", "instagram"]).
                   Must be from: linkedin, instagram, twitter, facebook, tiktok
        content_type: Type of content - "post" (default) or "thread"
    
    Returns:
        dict with:
        - workflow_status: "success", "cannot_proceed", "not_connected", or "error"
        - task_ids: List of created task IDs (if successful)
        - content: The created content (if successful)
        - error_detail: Description of what went wrong (if failed)
        - disconnected_platforms: Platforms that need to be connected (if any)
    
    Examples:
        - User: "Write a LinkedIn post about AI" 
          -> create_social_content("Write about AI", ["linkedin"])
        
        - User: "Create content for all my platforms about our sale"
          -> create_social_content("Write about our sale", ["linkedin", "instagram", "twitter", "facebook", "tiktok"])
    """
    # Lazy import to avoid circular dependency
    from app.workflows.content_workflow import create_content_workflow
    
    # Get user context from AgentContext
    ctx = get_agent_context()
    if not ctx:
        logger.error("No AgentContext set - cannot determine user_id")
        return {
            "workflow_status": "error",
            "error_type": "no_context",
            "error_detail": "Internal error: no user context available",
            "task_ids": [],
        }
    
    user_id = ctx.user_id
    agent_slug = ctx.agent_slug or "soshie"
    
    # Validate platforms
    normalized_platforms = []
    unsupported = []
    
    for p in platforms:
        p_lower = p.lower().strip()
        # Handle common aliases
        aliases = {
            "x": "twitter",
            "fb": "facebook", 
            "insta": "instagram",
            "ig": "instagram",
            "li": "linkedin",
        }
        p_normalized = aliases.get(p_lower, p_lower)
        
        if p_normalized in SUPPORTED_PLATFORMS:
            if p_normalized not in normalized_platforms:
                normalized_platforms.append(p_normalized)
        else:
            unsupported.append(p)
    
    if not normalized_platforms:
        return {
            "workflow_status": "cannot_proceed",
            "error_type": "no_valid_platforms",
            "error_detail": f"No supported platforms found. Supported: {', '.join(SUPPORTED_PLATFORMS)}. Unsupported requested: {', '.join(unsupported) if unsupported else 'none'}",
            "unsupported_platforms": unsupported,
            "task_ids": [],
        }
    
    # Master platform is the first one
    master_platform = normalized_platforms[0]
    
    logger.info(f"Creating content for platforms: {normalized_platforms}, master: {master_platform}")
    
    # Create and invoke the workflow
    try:
        workflow = create_content_workflow()
        
        result = await workflow.ainvoke({
            "request": request,
            "platforms": normalized_platforms,
            "master_platform": master_platform,
            "platform": master_platform,  # Legacy field
            "content_type": content_type,
            "user_id": user_id,
            "agent_slug": agent_slug,
            "messages": [],
            "iteration_count": 0,
            "task_ids": [],
            "failed_platforms": [],
            "ui_actions": [],
        })
        
        # Extract relevant fields for the agent
        workflow_status = result.get("workflow_status", "success")
        
        response = {
            "workflow_status": workflow_status,
            "task_ids": result.get("task_ids") or [],
            "content_group_id": result.get("content_group_id"),
        }
        
        if workflow_status == "success":
            # Include content for the agent to summarize
            master_content = result.get("master_content") or result.get("final_content") or {}
            adapted_content = result.get("adapted_content") or {}
            
            response["platforms"] = normalized_platforms
            response["master_platform"] = master_platform
            response["content"] = {
                "master": {
                    "platform": master_platform,
                    "text": master_content.get("text", ""),
                    "hashtags": master_content.get("hashtags", []),
                },
                "adapted": adapted_content,
            }
            
            # How many tasks created
            response["tasks_created"] = len(response["task_ids"])
            
        elif workflow_status == "not_connected":
            response["disconnected_platforms"] = result.get("disconnected_platforms") or []
            response["error_detail"] = result.get("error_detail") or "Some platforms need to be connected"
            
        elif workflow_status in ["cannot_proceed", "error"]:
            response["error_type"] = result.get("error_type")
            response["error_detail"] = result.get("error_detail")
            response["capabilities"] = result.get("capabilities")
        
        if unsupported:
            response["unsupported_platforms"] = unsupported
            response["note"] = f"Skipped unsupported platforms: {', '.join(unsupported)}"
        
        logger.info(f"Workflow completed with status: {workflow_status}")
        return response
        
    except Exception as e:
        logger.error(f"Content workflow failed: {e}")
        return {
            "workflow_status": "error",
            "error_type": "workflow_exception",
            "error_detail": str(e),
            "task_ids": [],
        }


# =============================================================================
# RESEARCH SUBAGENT TOOL
# =============================================================================

@tool
async def research_for_content(
    platforms: list[str],
    topic_hint: str = ""
) -> dict:
    """
    Research content strategy by invoking the Research subagent.
    
    Use this BEFORE create_social_content when:
    - User asks "what should I post?"
    - User wants content but doesn't specify a topic
    - You need to understand the brand's voice and strategy
    
    The Research subagent will autonomously:
    1. Load brand context from the knowledge base
    2. Search for relevant trends on the target platforms
    3. Analyze competitor strategies (if useful)
    4. Synthesize findings into content recommendations
    
    Args:
        platforms: Target platforms (e.g., ["linkedin", "instagram"])
        topic_hint: Optional topic direction from user (e.g., "something about AI")
    
    Returns:
        dict with:
        - brand_name: The brand being researched
        - brand_voice: Brand's tone (professional, casual, etc.)
        - content_ideas: List of specific content ideas with hooks and key points
        - recommended_idea: Index of the best idea
        - content_brief: Detailed instructions for content creation
        - image_suggestion: Visual direction if applicable
        - reasoning: Why this strategy was recommended
    
    After receiving this result, you can:
    - Present the ideas to the user for selection
    - Use the content_brief with create_social_content to create content
    
    Examples:
        - User: "What should I post this week?"
          -> research_for_content(platforms=["linkedin"], topic_hint="")
        
        - User: "I want to post something about AI"
          -> research_for_content(platforms=["linkedin"], topic_hint="AI")
    """
    # Lazy import to avoid circular dependency
    from app.agents.research import create_research_agent
    from app.schemas.research import ContentResearchResult, create_empty_research_result
    
    logger.info(f"Starting research for platforms: {platforms}, hint: {topic_hint or 'none'}")
    
    # Normalize platforms
    normalized = []
    for p in platforms:
        p_lower = p.lower().strip()
        aliases = {"x": "twitter", "fb": "facebook", "insta": "instagram", "ig": "instagram", "li": "linkedin"}
        normalized.append(aliases.get(p_lower, p_lower))
    
    if not normalized:
        normalized = ["linkedin"]  # Default to LinkedIn
    
    # Create the research request message
    request_content = f"""Research content strategy for the following:

Platforms: {', '.join(normalized)}
Topic hint: {topic_hint if topic_hint else 'No specific topic - suggest based on brand context and current trends'}

Please:
1. First call get_brand_context to understand the brand
2. Then search_trends for relevant topics on {normalized[0]}
3. Optionally check competitor insights if helpful
4. Synthesize your findings into specific, actionable content recommendations

Provide 2-3 content ideas with hooks and key points, recommend the best one, and explain your reasoning.
"""
    
    try:
        # Create and invoke the research subagent
        research_agent = create_research_agent()
        
        result = await research_agent.ainvoke({
            "messages": [HumanMessage(content=request_content)]
        })
        
        # Extract the final message from the research agent
        messages = result.get("messages", [])
        if not messages:
            logger.warning("Research agent returned no messages")
            return create_empty_research_result(error_message="Research returned no results").model_dump()
        
        # Get the last AI message (the final response)
        final_message = None
        for msg in reversed(messages):
            if hasattr(msg, "content") and msg.content:
                # Skip tool messages
                if hasattr(msg, "type") and msg.type == "tool":
                    continue
                final_message = msg
                break
        
        if not final_message:
            logger.warning("No final message found in research result")
            return create_empty_research_result(error_message="Research completed but no summary").model_dump()
        
        content = final_message.content
        
        # Try to parse structured JSON from the response
        # The LLM might return JSON or natural language
        try:
            # Look for JSON in the response
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                parsed = json.loads(json_match.group())
                # Validate with Pydantic
                validated = ContentResearchResult(**parsed)
                logger.info(f"Research completed with structured result for {validated.brand_name}")
                return validated.model_dump()
        except (json.JSONDecodeError, Exception) as e:
            logger.debug(f"Could not parse structured JSON: {e}")
        
        # If no structured JSON, return the raw content as reasoning
        # This allows the research to still be useful even without perfect structure
        return {
            "brand_name": "Your Brand",
            "brand_voice": "professional",
            "content_ideas": [{
                "topic": "Based on research",
                "hook": "See reasoning for details",
                "key_points": ["Check the full reasoning below"],
                "cta": "What do you think?",
            }],
            "recommended_idea": 0,
            "content_brief": "See the detailed reasoning from research",
            "reasoning": content,  # Include the full LLM response
            "raw_research": True,  # Flag that this is unstructured
        }
        
    except Exception as e:
        logger.error(f"Research subagent failed: {e}", exc_info=True)
        return {
            "error": "research_failed",
            "error_detail": str(e),
            "brand_name": "Unknown",
            "content_ideas": [],
            "reasoning": f"Research could not be completed: {str(e)}",
        }


# =============================================================================
# IMAGE GENERATION SUBAGENT TOOL
# =============================================================================

@tool
async def generate_image(
    description: str,
    platform: str = "instagram",
    style: str = "photo_realistic",
    include_brand_colors: bool = True
) -> dict:
    """
    Generate an image by invoking the Image Generation subagent.
    
    Use this when the user wants visual content for their posts.
    
    **Note:** Image generation is currently under development. The subagent will
    create an optimized prompt and return it, but actual image generation is not
    yet available. The prompt is ready for when the API is integrated.
    
    The Image Generation subagent will autonomously:
    1. Load brand visuals (colors, logo) if brand consistency is needed
    2. Create an optimized prompt for the target platform
    3. Generate the image (stub - returns prompt for now)
    
    Args:
        description: What the image should show (e.g., "person working with AI assistants")
        platform: Target platform (instagram, linkedin, twitter, facebook, tiktok)
        style: Visual style - one of:
               photo_realistic, illustration, infographic, quote_card,
               product_shot, lifestyle, abstract, minimal, cartoon, artistic
        include_brand_colors: Whether to incorporate brand colors into the image
    
    Returns:
        dict with:
        - status: "stub" (will be "success" when API is ready)
        - image_url: None (will be actual URL when API is ready)
        - prompt_used: The optimized prompt for image generation
        - style: Style applied
        - aspect_ratio: Recommended aspect ratio for platform
        - dimensions: Recommended dimensions
        - message: Human-readable status
    
    Examples:
        - User: "Create an image for my LinkedIn post about AI"
          -> generate_image("AI productivity in modern office", platform="linkedin")
        
        - User: "Make an Instagram graphic with a quote"
          -> generate_image("motivational quote about success", platform="instagram", style="quote_card")
    """
    # Lazy import to avoid circular dependency
    from app.agents.image_gen import create_image_gen_agent
    
    logger.info(f"Starting image generation for {platform}, style: {style}")
    
    # Normalize platform
    platform_lower = platform.lower().strip()
    aliases = {"x": "twitter", "fb": "facebook", "insta": "instagram", "ig": "instagram", "li": "linkedin"}
    platform_normalized = aliases.get(platform_lower, platform_lower)
    
    # Create the request message for the subagent
    request_content = f"""Generate an image for a {platform_normalized} post.

Description: {description}
Style: {style}
Platform: {platform_normalized}
Include brand colors: {include_brand_colors}

Please:
1. {"First call get_brand_visuals to load brand colors" if include_brand_colors else "Skip brand visuals for this request"}
2. Call generate_image_prompt to create an optimized prompt
3. Call create_image with the optimized prompt

Return the result from create_image.
"""
    
    try:
        # Create and invoke the image generation subagent
        image_agent = create_image_gen_agent()
        
        result = await image_agent.ainvoke({
            "messages": [HumanMessage(content=request_content)]
        })
        
        # Extract the final message from the subagent
        messages = result.get("messages", [])
        if not messages:
            logger.warning("Image generation agent returned no messages")
            return {
                "status": "error",
                "error": "no_response",
                "message": "Image generation returned no response",
            }
        
        # Get the last AI message (the final response)
        final_message = None
        for msg in reversed(messages):
            if hasattr(msg, "content") and msg.content:
                # Skip tool messages
                if hasattr(msg, "type") and msg.type == "tool":
                    continue
                final_message = msg
                break
        
        if not final_message:
            logger.warning("No final message found in image generation result")
            return {
                "status": "error",
                "error": "no_final_message",
                "message": "Image generation completed but no result found",
            }
        
        content = final_message.content
        
        # Try to parse structured JSON from the response
        try:
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                parsed = json.loads(json_match.group())
                logger.info(f"Image generation completed with status: {parsed.get('status', 'unknown')}")
                return parsed
        except (json.JSONDecodeError, Exception) as e:
            logger.debug(f"Could not parse structured JSON from image gen: {e}")
        
        # If no structured JSON, return the content as the result
        return {
            "status": "stub",
            "image_url": None,
            "prompt_used": description,
            "style": style,
            "platform": platform_normalized,
            "message": content,
            "ready_for_api": True,
        }
        
    except Exception as e:
        logger.error(f"Image generation subagent failed: {e}", exc_info=True)
        return {
            "status": "error",
            "error": "subagent_failed",
            "error_detail": str(e),
            "message": f"Image generation failed: {str(e)}",
        }


# =============================================================================
# TOOL EXPORTS
# =============================================================================

# All tools available for Soshie
WORKFLOW_TOOLS = [
    research_for_content,   # Research subagent wrapper
    create_social_content,  # Content creation workflow
    generate_image,         # Image generation subagent wrapper
]
