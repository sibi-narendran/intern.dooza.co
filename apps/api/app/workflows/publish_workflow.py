"""
Publish Workflow

LangGraph-based workflow for publishing content to social media platforms.
Checkpointed at each step for resumability - if it fails mid-publish,
it can resume exactly where it stopped.

Workflow Nodes:
1. verify_task - Check task exists and is in publishable state
2. prepare_media - Upload media to platforms that require two-step process
3. publish_platforms - Publish to each platform (checkpointed per-platform)
4. finalize - Update task with final status and results
"""

from __future__ import annotations

import logging
from typing import TypedDict, Optional, Annotated
from uuid import UUID

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.base import BaseCheckpointSaver

from app.services.composio_client import get_composio_client, PublishResult
from app.services.connection_service import get_connection_service
from app.core.database import get_supabase_client

logger = logging.getLogger(__name__)


# =============================================================================
# WORKFLOW STATE
# =============================================================================

class PublishState(TypedDict):
    """
    State for the publish workflow.
    
    This state is checkpointed at each step, enabling resumability.
    If the workflow fails mid-publish, it can resume with the same state.
    """
    # Task identification
    task_id: str
    user_id: str
    
    # What to publish
    platforms: list[str]
    connection_ids: dict[str, str]  # platform -> connection_id
    content: dict  # Task content payload
    
    # Progress tracking (enables resumability)
    current_step: str
    platforms_completed: list[str]  # Platforms already published to
    media_ids: dict[str, str]  # platform -> uploaded media_id
    
    # Results
    results: dict[str, dict]  # platform -> PublishResult.to_dict()
    errors: dict[str, str]  # platform -> error message
    
    # Final status
    final_status: Optional[str]  # published, partially_published, failed


# =============================================================================
# WORKFLOW NODES
# =============================================================================

async def verify_task_node(state: PublishState) -> PublishState:
    """
    Verify task exists and is in a publishable state.
    
    Checks:
    - Task exists
    - Task status is "approved" or "scheduled"
    - User has connections for requested platforms
    
    Updates task status to "publishing".
    """
    logger.info(f"Verifying task {state['task_id']} for publishing")
    
    supabase = get_supabase_client()
    if not supabase:
        return {
            **state,
            "current_step": "error",
            "errors": {"_workflow": "Database not available"},
        }
    
    # Fetch task
    result = supabase.table("workspace_tasks")\
        .select("*")\
        .eq("id", state["task_id"])\
        .execute()
    
    if not result.data:
        return {
            **state,
            "current_step": "error",
            "errors": {"_workflow": f"Task {state['task_id']} not found"},
        }
    
    task = result.data[0]
    
    # Verify status
    if task["status"] not in ["approved", "scheduled"]:
        return {
            **state,
            "current_step": "error",
            "errors": {"_workflow": f"Task status is {task['status']}, expected approved or scheduled"},
        }
    
    # Update status to publishing
    supabase.table("workspace_tasks")\
        .update({"status": "publishing"})\
        .eq("id", state["task_id"])\
        .execute()
    
    # Get connection IDs if not provided
    connection_ids = state.get("connection_ids", {})
    if not connection_ids:
        connection_service = get_connection_service()
        connection_ids = await connection_service.verify_connections(
            state["user_id"],
            state["platforms"]
        )
    
    # Check for missing connections
    missing = [p for p, c in connection_ids.items() if c is None]
    if missing:
        return {
            **state,
            "current_step": "error",
            "errors": {"_workflow": f"Missing connections for: {', '.join(missing)}"},
        }
    
    logger.info(f"Task {state['task_id']} verified, proceeding to publish")
    
    return {
        **state,
        "current_step": "prepare_media",
        "connection_ids": connection_ids,
        "content": task["content_payload"],
        "user_id": task["user_id"],
    }


async def prepare_media_node(state: PublishState) -> PublishState:
    """
    Upload media to platforms that require two-step process.
    
    Instagram and TikTok require media to be uploaded first,
    then the post is created with the media_id.
    
    This step is checkpointed - if it fails mid-upload,
    already uploaded media_ids are preserved.
    """
    if state.get("current_step") == "error":
        return state
    
    logger.info(f"Preparing media for task {state['task_id']}")
    
    media_ids = state.get("media_ids", {})
    content = state.get("content", {})
    composio_client = get_composio_client()
    
    # Instagram requires media upload first
    if "instagram" in state["platforms"] and "instagram" not in media_ids:
        media_urls = content.get("media_urls", [])
        if media_urls:
            connection_id = state["connection_ids"].get("instagram")
            if connection_id:
                uploaded_ids = []
                for url in media_urls:
                    result = await composio_client.upload_instagram_media(
                        user_id=state["user_id"],
                        connection_id=connection_id,
                        media_url=url,
                    )
                    if result.success and result.media_id:
                        uploaded_ids.append(result.media_id)
                    else:
                        logger.error(f"Instagram media upload failed: {result.error}")
                
                if uploaded_ids:
                    media_ids["instagram"] = uploaded_ids
    
    # TikTok video upload is handled in publish step
    # YouTube video upload is handled in publish step
    
    logger.info(f"Media preparation complete for task {state['task_id']}")
    
    return {
        **state,
        "current_step": "publish_platforms",
        "media_ids": media_ids,
    }


async def publish_platforms_node(state: PublishState) -> PublishState:
    """
    Publish to each platform.
    
    This is the main publishing step. It iterates through platforms
    and publishes to each one. Progress is tracked so that if the
    workflow fails mid-publish, it can resume from where it left off.
    """
    if state.get("current_step") == "error":
        return state
    
    logger.info(f"Publishing task {state['task_id']} to platforms: {state['platforms']}")
    
    composio_client = get_composio_client()
    results = state.get("results", {})
    errors = state.get("errors", {})
    platforms_completed = state.get("platforms_completed", [])
    content = state.get("content", {})
    media_ids = state.get("media_ids", {})
    
    for platform in state["platforms"]:
        # Skip already completed platforms (resumability)
        if platform in platforms_completed:
            logger.info(f"Skipping {platform} - already published")
            continue
        
        connection_id = state["connection_ids"].get(platform)
        if not connection_id:
            errors[platform] = f"No connection for {platform}"
            continue
        
        logger.info(f"Publishing to {platform}...")
        
        # Build platform-specific content
        platform_content = _build_platform_content(platform, content)
        
        # Get pre-uploaded media IDs if available
        platform_media_ids = media_ids.get(platform)
        
        # Publish
        result = await composio_client.publish(
            platform=platform,
            user_id=state["user_id"],
            connection_id=connection_id,
            content=platform_content,
            media_ids={platform: platform_media_ids} if platform_media_ids else None,
        )
        
        if result.success:
            results[platform] = result.to_dict()
            platforms_completed.append(platform)
            logger.info(f"Published to {platform}: {result.post_url}")
        else:
            errors[platform] = result.error or "Unknown error"
            logger.error(f"Failed to publish to {platform}: {result.error}")
    
    return {
        **state,
        "current_step": "finalize",
        "results": results,
        "errors": errors,
        "platforms_completed": platforms_completed,
    }


async def finalize_node(state: PublishState) -> PublishState:
    """
    Update task with final status and results.
    
    Determines final status based on results:
    - All platforms succeeded -> "published"
    - Some platforms succeeded -> "partially_published"
    - All platforms failed -> "failed"
    """
    if state.get("current_step") == "error":
        # Still need to update task status on error
        supabase = get_supabase_client()
        if supabase:
            supabase.table("workspace_tasks")\
                .update({
                    "status": "failed",
                    "publish_results": {"errors": state.get("errors", {})},
                })\
                .eq("id", state["task_id"])\
                .execute()
        
        return {
            **state,
            "final_status": "failed",
        }
    
    logger.info(f"Finalizing publish for task {state['task_id']}")
    
    results = state.get("results", {})
    errors = state.get("errors", {})
    platforms = state.get("platforms", [])
    
    # Determine final status
    success_count = len(results)
    total_count = len(platforms)
    
    if success_count == total_count:
        final_status = "published"
    elif success_count > 0:
        final_status = "partially_published"
    else:
        final_status = "failed"
    
    # Update task in database
    supabase = get_supabase_client()
    if supabase:
        update_data = {
            "status": final_status,
            "publish_results": {
                "results": results,
                "errors": errors,
                "platforms_completed": state.get("platforms_completed", []),
            },
        }
        
        if final_status == "published":
            from datetime import datetime
            update_data["published_at"] = datetime.utcnow().isoformat()
        
        supabase.table("workspace_tasks")\
            .update(update_data)\
            .eq("id", state["task_id"])\
            .execute()
    
    logger.info(f"Task {state['task_id']} finalized with status: {final_status}")
    
    return {
        **state,
        "current_step": "complete",
        "final_status": final_status,
    }


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _build_platform_content(platform: str, content: dict) -> dict:
    """
    Build platform-specific content from the task content payload.
    
    Maps generic content fields to platform-specific fields.
    """
    platform = platform.lower()
    
    if platform == "instagram":
        return {
            "caption": content.get("caption", content.get("text", "")),
            "media_urls": content.get("media_urls", []),
        }
    
    elif platform == "facebook":
        return {
            "text": content.get("text", content.get("caption", "")),
            "media_urls": content.get("media_urls", []),
            "link_url": content.get("link_url"),
        }
    
    elif platform == "linkedin":
        return {
            "text": content.get("text", content.get("caption", "")),
            "media_url": content.get("media_urls", [None])[0] if content.get("media_urls") else content.get("media_url"),
            "article_url": content.get("article_url", content.get("link_url")),
        }
    
    elif platform == "tiktok":
        return {
            "video_url": content.get("video_url", ""),
            "caption": content.get("caption", content.get("text", "")),
        }
    
    elif platform == "youtube":
        return {
            "video_url": content.get("video_url", ""),
            "title": content.get("title", ""),
            "description": content.get("description", content.get("text", "")),
            "tags": content.get("tags", []),
            "visibility": content.get("visibility", "private"),
        }
    
    return content


# =============================================================================
# WORKFLOW FACTORY
# =============================================================================

def create_publish_workflow(
    checkpointer: Optional[BaseCheckpointSaver] = None
) -> StateGraph:
    """
    Create the LangGraph publish workflow.
    
    The workflow is:
    verify_task -> prepare_media -> publish_platforms -> finalize -> END
    
    Each step is checkpointed, enabling resumability if the workflow
    fails mid-execution.
    
    Args:
        checkpointer: Optional checkpointer for persistence.
                     If provided, workflow state is saved after each step.
    
    Returns:
        Compiled LangGraph workflow ready for execution.
    """
    workflow = StateGraph(PublishState)
    
    # Add nodes
    workflow.add_node("verify_task", verify_task_node)
    workflow.add_node("prepare_media", prepare_media_node)
    workflow.add_node("publish_platforms", publish_platforms_node)
    workflow.add_node("finalize", finalize_node)
    
    # Add edges
    workflow.add_edge("verify_task", "prepare_media")
    workflow.add_edge("prepare_media", "publish_platforms")
    workflow.add_edge("publish_platforms", "finalize")
    workflow.add_edge("finalize", END)
    
    # Set entry point
    workflow.set_entry_point("verify_task")
    
    # Compile with optional checkpointer
    if checkpointer:
        return workflow.compile(checkpointer=checkpointer)
    else:
        return workflow.compile()


# =============================================================================
# CONVENIENCE FUNCTION
# =============================================================================

async def run_publish_workflow(
    task_id: str,
    user_id: str,
    platforms: list[str],
    connection_ids: Optional[dict[str, str]] = None,
    checkpointer: Optional[BaseCheckpointSaver] = None,
) -> dict:
    """
    Run the publish workflow for a task.
    
    Convenience function that creates the workflow and executes it.
    
    Args:
        task_id: Task UUID as string
        user_id: User UUID as string
        platforms: List of platforms to publish to
        connection_ids: Optional pre-fetched connection IDs
        checkpointer: Optional checkpointer for persistence
    
    Returns:
        Final workflow state with results
    """
    workflow = create_publish_workflow(checkpointer=checkpointer)
    
    # Initial state
    initial_state: PublishState = {
        "task_id": task_id,
        "user_id": user_id,
        "platforms": platforms,
        "connection_ids": connection_ids or {},
        "content": {},
        "current_step": "verify_task",
        "platforms_completed": [],
        "media_ids": {},
        "results": {},
        "errors": {},
        "final_status": None,
    }
    
    # Configure thread ID for checkpointing
    config = {"configurable": {"thread_id": f"publish_{task_id}"}}
    
    # Run workflow
    result = await workflow.ainvoke(initial_state, config)
    
    return result
