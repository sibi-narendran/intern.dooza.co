"""
Publish Service

Core publishing orchestrator - the "Zero Regret" entry point.

This is the STABLE interface that both:
- API endpoints call directly (immediate publish)
- Scheduler calls (scheduled publish)
- Future Temporal workflow calls

The scheduler only calls PublishService.execute(). 
Later, Temporal calls the same function.
Zero changes needed when swapping scheduler for Temporal.

Design Principle:
    The scheduler/cron job should be as thin as possible.
    All logic lives here in the service layer.
    This makes it trivial to migrate to Temporal or any other
    orchestration system later.
"""

from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID
from datetime import datetime

from app.services.connection_service import get_connection_service, ConnectionService
from app.services.composio_client import get_composio_client
from app.workflows.publish_workflow import run_publish_workflow, create_publish_workflow
from app.core.database import get_supabase_client

logger = logging.getLogger(__name__)


# =============================================================================
# PUBLISH SERVICE
# =============================================================================

class PublishService:
    """
    Core publishing orchestrator.
    
    This is the STABLE interface that both:
    - API endpoints call directly (immediate publish)
    - Scheduler calls (scheduled publish)
    - Future Temporal workflow calls
    
    Zero changes needed when swapping scheduler.
    
    Usage:
        service = PublishService()
        result = await service.execute(task_id, platforms=["instagram", "linkedin"])
    """
    
    def __init__(self):
        self.connection_service = get_connection_service()
        self.composio_client = get_composio_client()
        self._checkpointer = None
    
    def _get_checkpointer(self):
        """
        Get or create PostgreSQL checkpointer for LangGraph.
        
        The checkpointer enables resumable workflows - if a publish
        fails mid-way, it can resume from the last checkpoint.
        """
        if self._checkpointer is not None:
            return self._checkpointer
        
        try:
            from langgraph.checkpoint.postgres import PostgresSaver
            from app.config import get_settings
            
            settings = get_settings()
            if settings.database_url:
                # Convert async URL to sync for checkpointer
                sync_url = settings.database_url.replace(
                    "postgresql+asyncpg://", "postgresql://"
                ).replace(
                    "postgres://", "postgresql://"
                )
                self._checkpointer = PostgresSaver.from_conn_string(sync_url)
                logger.info("PostgreSQL checkpointer initialized")
                return self._checkpointer
        except ImportError:
            logger.warning("langgraph checkpoint not available, using in-memory")
        except Exception as e:
            logger.warning(f"Could not init PostgreSQL checkpointer: {e}")
        
        # Fall back to memory checkpointer
        try:
            from langgraph.checkpoint.memory import MemorySaver
            self._checkpointer = MemorySaver()
            return self._checkpointer
        except ImportError:
            return None
    
    async def execute(
        self, 
        task_id: UUID, 
        platforms: Optional[list[str]] = None,
        user_id: Optional[str] = None,
    ) -> dict:
        """
        Main entry point for publishing.
        
        Scheduler calls this. Temporal will call this.
        
        1. Fetch task and existing checkpoint (if resuming)
        2. Run or resume LangGraph workflow
        3. Return results
        
        Args:
            task_id: Task UUID to publish
            platforms: Optional list of platforms (uses task's target_platforms if not provided)
            user_id: Optional user ID (fetched from task if not provided)
        
        Returns:
            Dict with success status, final_status, and results
        """
        logger.info(f"PublishService.execute called for task {task_id}")
        
        # Fetch task to get platforms and user_id if not provided
        task = await self._get_task(task_id)
        if not task:
            return {
                "success": False,
                "status": "error",
                "error": f"Task {task_id} not found",
            }
        
        # Use provided values or fall back to task values
        platforms = platforms or task.get("target_platforms", [])
        user_id = user_id or task.get("user_id")
        
        if not platforms:
            return {
                "success": False,
                "status": "error",
                "error": "No platforms specified for publishing",
            }
        
        if not user_id:
            return {
                "success": False,
                "status": "error",
                "error": "No user_id available for publishing",
            }
        
        # Get connection IDs for the user
        connection_ids = await self.connection_service.verify_connections(
            str(user_id), 
            platforms
        )
        
        # Check for missing connections
        missing = [p for p, c in connection_ids.items() if c is None]
        if missing:
            return {
                "success": False,
                "status": "error",
                "error": f"Missing connections for: {', '.join(missing)}",
                "missing_connections": missing,
            }
        
        # Run the LangGraph workflow
        try:
            result = await run_publish_workflow(
                task_id=str(task_id),
                user_id=str(user_id),
                platforms=platforms,
                connection_ids=connection_ids,
                checkpointer=self._get_checkpointer(),
            )
            
            final_status = result.get("final_status", "unknown")
            
            return {
                "success": final_status == "published",
                "status": final_status,
                "results": result.get("results", {}),
                "errors": result.get("errors", {}),
                "platforms_completed": result.get("platforms_completed", []),
            }
            
        except Exception as e:
            logger.exception(f"Publish workflow failed for task {task_id}")
            
            # Update task status to failed
            await self._update_task_status(task_id, "failed", {
                "errors": {"_workflow": str(e)}
            })
            
            return {
                "success": False,
                "status": "failed",
                "error": str(e),
            }
    
    async def retry(self, task_id: UUID) -> dict:
        """
        Retry a failed or partially published task.
        
        Uses LangGraph checkpointing to resume from where it left off.
        Only retries platforms that haven't been published yet.
        
        Args:
            task_id: Task UUID to retry
        
        Returns:
            Same as execute()
        """
        logger.info(f"Retrying publish for task {task_id}")
        
        task = await self._get_task(task_id)
        if not task:
            return {
                "success": False,
                "status": "error",
                "error": f"Task {task_id} not found",
            }
        
        # Verify task is in a retryable state
        status = task.get("status")
        if status not in ["failed", "partially_published"]:
            return {
                "success": False,
                "status": "error",
                "error": f"Task status is {status}, cannot retry",
            }
        
        # Get platforms that haven't been published
        publish_results = task.get("publish_results", {})
        platforms_completed = publish_results.get("platforms_completed", [])
        target_platforms = task.get("target_platforms", [])
        
        platforms_to_retry = [
            p for p in target_platforms 
            if p not in platforms_completed
        ]
        
        if not platforms_to_retry:
            return {
                "success": True,
                "status": "published",
                "message": "All platforms already published",
            }
        
        # Increment retry count
        await self._increment_retry_count(task_id)
        
        # Execute publish for remaining platforms
        return await self.execute(
            task_id=task_id,
            platforms=platforms_to_retry,
            user_id=task.get("user_id"),
        )
    
    async def _get_task(self, task_id: UUID) -> Optional[dict]:
        """Fetch task from database."""
        supabase = get_supabase_client()
        if not supabase:
            return None
        
        result = supabase.table("workspace_tasks")\
            .select("*")\
            .eq("id", str(task_id))\
            .execute()
        
        return result.data[0] if result.data else None
    
    async def _update_task_status(
        self, 
        task_id: UUID, 
        status: str, 
        publish_results: Optional[dict] = None
    ) -> None:
        """Update task status in database."""
        supabase = get_supabase_client()
        if not supabase:
            return
        
        update_data = {"status": status}
        if publish_results:
            update_data["publish_results"] = publish_results
        
        supabase.table("workspace_tasks")\
            .update(update_data)\
            .eq("id", str(task_id))\
            .execute()
    
    async def _increment_retry_count(self, task_id: UUID) -> None:
        """Increment the retry count for a task."""
        supabase = get_supabase_client()
        if not supabase:
            return
        
        # Fetch current count and increment
        task = await self._get_task(task_id)
        if task:
            current_count = task.get("retry_count", 0)
            supabase.table("workspace_tasks")\
                .update({"retry_count": current_count + 1})\
                .eq("id", str(task_id))\
                .execute()


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_publish_service: Optional[PublishService] = None


def get_publish_service() -> PublishService:
    """Get or create the publish service singleton."""
    global _publish_service
    if _publish_service is None:
        _publish_service = PublishService()
    return _publish_service
