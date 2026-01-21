"""
Tasks Router

REST API endpoints for workspace tasks.
Handles CRUD operations, status updates, and calendar queries.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import ValidationError as PydanticValidationError

from app.core.auth import get_current_user
from app.services.task_service import (
    TaskService,
    get_task_service,
    TaskNotFoundError,
    ConflictError,
    InvalidTransitionError,
    ValidationError as ContentValidationError,
)
from app.schemas.tasks import (
    TaskCreate,
    TaskUpdate,
    TaskStatusUpdate,
    TaskResponse,
    TaskListResponse,
    BulkStatusUpdate,
    BulkUpdateResponse,
    PendingCountResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tasks", tags=["tasks"])


# =============================================================================
# DEPENDENCIES
# =============================================================================

async def get_service() -> TaskService:
    """Dependency to get task service."""
    return get_task_service()


# =============================================================================
# CRUD ENDPOINTS
# =============================================================================

@router.post("", response_model=TaskResponse, status_code=201)
async def create_task(
    task: TaskCreate,
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(get_service),
):
    """
    Create a new workspace task.
    
    Typically called by agents via the create_task tool,
    but can also be called directly by the frontend.
    """
    try:
        result = await service.create_task(
            user_id=user_id,
            agent_slug=task.task_type.split("_")[0] if "_" in task.task_type else "manual",
            task_type=task.task_type,
            title=task.title,
            content=task.content,
            due_date=task.due_date,
        )
        return result
    except ContentValidationError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid content for task type '{e.task_type}': {e.errors}"
        )
    except Exception as e:
        logger.error(f"Failed to create task: {e}")
        raise HTTPException(status_code=500, detail="Failed to create task")


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    status: Optional[str] = Query(None, description="Comma-separated status filter"),
    agent_slug: Optional[str] = Query(None),
    task_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(get_service),
):
    """
    List tasks with optional filters.
    
    Supports filtering by status, agent, and task type.
    Paginated with default 50 items per page.
    """
    # Parse comma-separated status
    status_list = status.split(",") if status else None
    
    tasks, total = await service.list_tasks(
        user_id=user_id,
        status=status_list,
        agent_slug=agent_slug,
        task_type=task_type,
        page=page,
        page_size=page_size,
    )
    
    return TaskListResponse(
        tasks=tasks,
        total=total,
        page=page,
        page_size=page_size,
        has_more=(page * page_size) < total,
    )


@router.get("/calendar")
async def get_calendar_tasks(
    start_date: datetime = Query(..., description="Start of date range"),
    end_date: datetime = Query(..., description="End of date range"),
    status: Optional[str] = Query(None, description="Comma-separated status filter"),
    agent_slug: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(get_service),
):
    """
    Get tasks for calendar view.
    
    Returns tasks with due_date within the specified range.
    Optimized for calendar rendering with status colors.
    """
    status_list = status.split(",") if status else None
    
    tasks = await service.get_calendar_tasks(
        user_id=user_id,
        start_date=start_date,
        end_date=end_date,
        status=status_list,
        agent_slug=agent_slug,
    )
    
    # Add calendar colors based on status
    STATUS_COLORS = {
        "draft": "#6b7280",
        "pending_approval": "#f59e0b",
        "approved": "#10b981",
        "scheduled": "#3b82f6",
        "published": "#8b5cf6",
        "rejected": "#ef4444",
        "cancelled": "#9ca3af",
    }
    
    for task in tasks:
        task["calendar_color"] = STATUS_COLORS.get(task["status"], "#6b7280")
    
    return {"tasks": tasks, "count": len(tasks)}


@router.get("/pending/count", response_model=PendingCountResponse)
async def get_pending_count(
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(get_service),
):
    """
    Get count of pending approval tasks.
    
    Used for dashboard badge display.
    """
    count = await service.get_pending_count(user_id)
    return PendingCountResponse(count=count)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID,
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(get_service),
):
    """
    Get a single task by ID.
    """
    try:
        return await service.get_task(task_id, user_id)
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    update: TaskUpdate,
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(get_service),
):
    """
    Update task content.
    
    Requires version for optimistic locking.
    Returns 409 Conflict if version mismatch.
    """
    try:
        return await service.update_task(
            task_id=task_id,
            user_id=user_id,
            content=update.content,
            version=update.version,
            title=update.title,
        )
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")
    except ConflictError as e:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Task was modified by another user. Please refresh and try again.",
                "current_version": e.current_version,
                "your_version": e.your_version,
            }
        )
    except ContentValidationError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid content for task type '{e.task_type}': {e.errors}"
        )


@router.delete("/{task_id}", response_model=TaskResponse)
async def delete_task(
    task_id: UUID,
    version: int = Query(..., description="Current version for optimistic locking"),
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(get_service),
):
    """
    Delete (cancel) a task.
    
    Performs soft delete by setting status to 'cancelled'.
    """
    try:
        return await service.cancel_task(task_id, user_id, version)
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")
    except ConflictError as e:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Task was modified. Please refresh and try again.",
                "current_version": e.current_version,
                "your_version": e.your_version,
            }
        )
    except InvalidTransitionError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "message": f"Cannot cancel task in '{e.current_status}' status",
                "current_status": e.current_status,
                "allowed_transitions": e.allowed,
            }
        )


# =============================================================================
# STATUS WORKFLOW ENDPOINTS
# =============================================================================

@router.patch("/{task_id}/status", response_model=TaskResponse)
async def update_task_status(
    task_id: UUID,
    update: TaskStatusUpdate,
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(get_service),
):
    """
    Update task status (approve, reject, schedule, etc.)
    
    Enforces state machine transitions:
    - draft → pending_approval, cancelled
    - pending_approval → approved, rejected, cancelled
    - approved → scheduled, published
    - rejected → draft (for revision)
    - scheduled → published, cancelled
    
    Feedback is required when rejecting.
    """
    try:
        return await service.update_status(
            task_id=task_id,
            user_id=user_id,
            new_status=update.status,
            version=update.version,
            feedback=update.feedback,
            scheduled_at=update.scheduled_at,
        )
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")
    except ConflictError as e:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Task was modified. Please refresh and try again.",
                "current_version": e.current_version,
                "your_version": e.your_version,
            }
        )
    except InvalidTransitionError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "message": f"Cannot transition from '{e.current_status}' to '{e.requested_status}'",
                "current_status": e.current_status,
                "requested_status": e.requested_status,
                "allowed_transitions": e.allowed,
            }
        )
    except ValueError as e:
        # Feedback required for rejection
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/bulk/status", response_model=BulkUpdateResponse)
async def bulk_update_status(
    update: BulkStatusUpdate,
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(get_service),
):
    """
    Update status for multiple tasks at once.
    
    Useful for bulk approval from calendar/dashboard.
    Invalid transitions are skipped and returned in 'failed' list.
    """
    updated, failed = await service.bulk_update_status(
        user_id=user_id,
        task_ids=update.task_ids,
        new_status=update.status,
    )
    
    return BulkUpdateResponse(updated=updated, failed=failed)


# =============================================================================
# PUBLISH ENDPOINTS
# =============================================================================

from pydantic import BaseModel, Field
from typing import List


class PublishRequest(BaseModel):
    """Request schema for immediate publish."""
    platforms: List[str] = Field(..., min_length=1, description="Platforms to publish to")


class ScheduleRequest(BaseModel):
    """Request schema for scheduled publish."""
    platforms: List[str] = Field(..., min_length=1, description="Platforms to publish to")
    scheduled_for: datetime = Field(..., description="When to publish (UTC)")


class PublishResponse(BaseModel):
    """Response schema for publish operations."""
    success: bool
    status: str
    results: dict = Field(default_factory=dict)
    errors: dict = Field(default_factory=dict)
    platforms_completed: List[str] = Field(default_factory=list)
    error: Optional[str] = None


class ScheduleResponse(BaseModel):
    """Response schema for schedule operations."""
    scheduled: bool
    scheduled_for: datetime
    job_id: str
    platforms: List[str]


@router.post("/{task_id}/publish", response_model=PublishResponse)
async def publish_now(
    task_id: UUID,
    request: PublishRequest,
    user_id: str = Depends(get_current_user),
):
    """
    Immediately publish a task to selected platforms.
    
    This is a synchronous operation - the user waits for the result.
    Typical response time is 15-30 seconds depending on platforms.
    
    The task must be in 'approved' or 'scheduled' status.
    """
    from app.services.publish_service import get_publish_service
    
    publish_service = get_publish_service()
    result = await publish_service.execute(
        task_id=task_id,
        platforms=request.platforms,
        user_id=user_id,
    )
    
    return PublishResponse(
        success=result.get("success", False),
        status=result.get("status", "unknown"),
        results=result.get("results", {}),
        errors=result.get("errors", {}),
        platforms_completed=result.get("platforms_completed", []),
        error=result.get("error"),
    )


@router.post("/{task_id}/schedule", response_model=ScheduleResponse)
async def schedule_publish(
    task_id: UUID,
    request: ScheduleRequest,
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(get_service),
):
    """
    Schedule a task for future publishing.
    
    Returns immediately - the publish will happen at the scheduled time.
    The scheduler worker must be running to execute scheduled jobs.
    
    The task status will be updated to 'scheduled'.
    """
    from app.scheduler.jobs import schedule_publish as schedule_job
    
    # Update task with target platforms and scheduled time
    try:
        # First update task status to scheduled
        await service.update_status(
            task_id=task_id,
            user_id=user_id,
            new_status="scheduled",
            version=1,  # Will be fetched from task
            scheduled_at=request.scheduled_for,
        )
    except InvalidTransitionError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "message": f"Cannot schedule task in '{e.current_status}' status",
                "current_status": e.current_status,
                "allowed_transitions": e.allowed,
            }
        )
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Update target platforms in database
    from app.core.database import get_supabase_client
    supabase = get_supabase_client()
    if supabase:
        supabase.table("workspace_tasks")\
            .update({
                "target_platforms": request.platforms,
                "scheduled_for": request.scheduled_for.isoformat(),
            })\
            .eq("id", str(task_id))\
            .execute()
    
    # Add to scheduler
    job_id = schedule_job(task_id, request.scheduled_for, request.platforms)
    
    logger.info(f"Scheduled task {task_id} for {request.scheduled_for}")
    
    return ScheduleResponse(
        scheduled=True,
        scheduled_for=request.scheduled_for,
        job_id=job_id,
        platforms=request.platforms,
    )


@router.delete("/{task_id}/schedule")
async def cancel_scheduled_publish(
    task_id: UUID,
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(get_service),
):
    """
    Cancel a scheduled publish.
    
    Removes the job from the scheduler and resets task status to 'approved'.
    """
    from app.scheduler.jobs import cancel_scheduled
    
    # Cancel the scheduled job
    cancelled = cancel_scheduled(task_id)
    
    if not cancelled:
        logger.warning(f"No scheduled job found for task {task_id}")
    
    # Update task status back to approved
    from app.core.database import get_supabase_client
    supabase = get_supabase_client()
    if supabase:
        supabase.table("workspace_tasks")\
            .update({
                "status": "approved",
                "scheduled_for": None,
            })\
            .eq("id", str(task_id))\
            .execute()
    
    logger.info(f"Cancelled scheduled publish for task {task_id}")
    
    return {"cancelled": True, "task_id": str(task_id)}


@router.post("/{task_id}/retry", response_model=PublishResponse)
async def retry_publish(
    task_id: UUID,
    user_id: str = Depends(get_current_user),
):
    """
    Retry a failed or partially published task.
    
    Uses LangGraph checkpointing to resume from where it left off.
    Only attempts to publish to platforms that haven't succeeded yet.
    
    The task must be in 'failed' or 'partially_published' status.
    """
    from app.services.publish_service import get_publish_service
    
    publish_service = get_publish_service()
    result = await publish_service.retry(task_id)
    
    if "error" in result and "cannot retry" in result.get("error", "").lower():
        raise HTTPException(
            status_code=400,
            detail=result["error"]
        )
    
    return PublishResponse(
        success=result.get("success", False),
        status=result.get("status", "unknown"),
        results=result.get("results", {}),
        errors=result.get("errors", {}),
        platforms_completed=result.get("platforms_completed", []),
        error=result.get("error"),
    )


@router.get("/{task_id}/schedule")
async def get_scheduled_info(
    task_id: UUID,
    user_id: str = Depends(get_current_user),
):
    """
    Get scheduling information for a task.
    
    Returns job details if the task is scheduled.
    """
    from app.scheduler.jobs import get_job_for_task
    
    job_info = get_job_for_task(task_id)
    
    if not job_info:
        return {"scheduled": False, "task_id": str(task_id)}
    
    return {
        "scheduled": True,
        "task_id": str(task_id),
        "job_id": job_info["job_id"],
        "next_run_time": job_info["next_run_time"],
    }
