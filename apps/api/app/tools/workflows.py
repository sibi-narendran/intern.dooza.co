"""
Workflow Tools for LangGraph Agents

This module exposes workflows as tools that can be called by LLM agents.
Following the standard LangGraph tool-calling pattern:
- Tools are defined with @tool decorator
- Agents call tools via structured JSON tool calls
- Tools return structured results for the agent to interpret

Usage:
    from app.tools.workflows import create_social_content
    
    agent = create_react_agent(model, tools=[create_social_content], ...)
"""

from __future__ import annotations

import logging

from langchain_core.tools import tool

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
# TOOL EXPORTS
# =============================================================================

# All tools available for agents
WORKFLOW_TOOLS = [
    create_social_content,
]
