"""
Scheduler Jobs

Thin job wrappers that call PublishService.execute().

These are intentionally minimal - all logic lives in the service layer.
This makes it trivial to migrate to Temporal or any other orchestration
system later.

Job Functions:
- execute_scheduled_publish: Called by scheduler when a publish job is due
- schedule_publish: Add a new publish job to the scheduler
- cancel_scheduled: Remove a scheduled job
- get_scheduled_jobs: List all scheduled jobs
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from app.scheduler.scheduler import get_scheduler

logger = logging.getLogger(__name__)


# =============================================================================
# JOB FUNCTIONS
# =============================================================================

async def execute_scheduled_publish(task_id: str) -> dict:
    """
    Job handler for scheduled publishes.
    
    This is a THIN WRAPPER - all logic is in PublishService.
    Called by APScheduler when a scheduled publish job is due.
    
    Args:
        task_id: Task UUID as string
    
    Returns:
        Result from PublishService.execute()
    """
    logger.info(f"⏰ Executing scheduled publish for task {task_id}")
    
    try:
        # Import here to avoid circular imports
        from app.services.publish_service import get_publish_service
        
        publish_service = get_publish_service()
        result = await publish_service.execute(UUID(task_id))
        
        if result.get("success"):
            logger.info(f"✅ Scheduled publish complete for task {task_id}")
        else:
            logger.warning(f"⚠️ Scheduled publish completed with issues for task {task_id}: {result.get('error')}")
        
        return result
        
    except Exception as e:
        logger.exception(f"❌ Scheduled publish failed for task {task_id}")
        return {
            "success": False,
            "error": str(e),
        }


# =============================================================================
# SCHEDULING FUNCTIONS
# =============================================================================

def schedule_publish(
    task_id: UUID,
    scheduled_time: datetime,
    platforms: Optional[list[str]] = None,
) -> str:
    """
    Add a publish job to the scheduler.
    
    Creates a one-time job that will execute at the scheduled time.
    The job calls execute_scheduled_publish which calls PublishService.execute().
    
    Args:
        task_id: Task UUID to publish
        scheduled_time: When to execute the publish
        platforms: Optional list of platforms (uses task's target_platforms if not provided)
    
    Returns:
        Job ID (used for cancellation)
    """
    scheduler = get_scheduler()
    job_id = f"publish_{task_id}"
    
    # Remove existing job if any (reschedule case)
    try:
        scheduler.remove_job(job_id)
        logger.info(f"Removed existing job {job_id} for rescheduling")
    except Exception:
        pass  # Job doesn't exist, that's fine
    
    # Add the job
    job = scheduler.add_job(
        execute_scheduled_publish,
        trigger='date',
        run_date=scheduled_time,
        args=[str(task_id)],
        id=job_id,
        replace_existing=True,
        name=f"Publish task {task_id}",
    )
    
    logger.info(f"📅 Scheduled publish for task {task_id} at {scheduled_time} (job_id: {job_id})")
    
    return job_id


def cancel_scheduled(task_id: UUID) -> bool:
    """
    Remove a scheduled publish job.
    
    Args:
        task_id: Task UUID whose job to cancel
    
    Returns:
        True if job was removed, False if job didn't exist
    """
    scheduler = get_scheduler()
    job_id = f"publish_{task_id}"
    
    try:
        scheduler.remove_job(job_id)
        logger.info(f"🚫 Cancelled scheduled publish for task {task_id}")
        return True
    except Exception as e:
        logger.warning(f"Could not cancel job {job_id}: {e}")
        return False


def reschedule_publish(
    task_id: UUID,
    new_time: datetime,
) -> str:
    """
    Reschedule an existing publish job.
    
    Convenience function that cancels the existing job
    and creates a new one.
    
    Args:
        task_id: Task UUID to reschedule
        new_time: New scheduled time
    
    Returns:
        New job ID
    """
    cancel_scheduled(task_id)
    return schedule_publish(task_id, new_time)


def get_scheduled_jobs() -> list[dict]:
    """
    List all scheduled publish jobs.
    
    Returns:
        List of job info dicts with id, task_id, next_run_time
    """
    scheduler = get_scheduler()
    jobs = scheduler.get_jobs()
    
    result = []
    for job in jobs:
        if job.id.startswith("publish_"):
            task_id = job.id.replace("publish_", "")
            result.append({
                "job_id": job.id,
                "task_id": task_id,
                "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
                "name": job.name,
            })
    
    return result


def get_job_for_task(task_id: UUID) -> Optional[dict]:
    """
    Get scheduled job info for a specific task.
    
    Args:
        task_id: Task UUID to look up
    
    Returns:
        Job info dict or None if not scheduled
    """
    scheduler = get_scheduler()
    job_id = f"publish_{task_id}"
    
    job = scheduler.get_job(job_id)
    if not job:
        return None
    
    return {
        "job_id": job.id,
        "task_id": str(task_id),
        "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
        "name": job.name,
    }
