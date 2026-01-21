"""
Task Service

Business logic for workspace tasks including:
- CRUD operations
- State machine validation
- Optimistic locking
- Calendar queries

This service layer sits between the API routes and database,
enforcing business rules and validation.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from app.core.database import get_supabase_client
from app.schemas.task_content import validate_task_content
from app.schemas.tasks import (
    VALID_TRANSITIONS,
    validate_status_transition,
    TaskStatus,
)

logger = logging.getLogger(__name__)


# =============================================================================
# CUSTOM EXCEPTIONS
# =============================================================================

class TaskNotFoundError(Exception):
    """Raised when a task is not found."""
    def __init__(self, task_id: UUID):
        self.task_id = task_id
        super().__init__(f"Task not found: {task_id}")


class ConflictError(Exception):
    """Raised when optimistic locking fails (version mismatch)."""
    def __init__(self, current_version: int, your_version: int):
        self.current_version = current_version
        self.your_version = your_version
        super().__init__(
            f"Task was modified by another user. "
            f"Current version: {current_version}, your version: {your_version}"
        )


class InvalidTransitionError(Exception):
    """Raised when an invalid status transition is attempted."""
    def __init__(self, current_status: str, requested_status: str):
        self.current_status = current_status
        self.requested_status = requested_status
        self.allowed = VALID_TRANSITIONS.get(current_status, [])
        super().__init__(
            f"Cannot transition from '{current_status}' to '{requested_status}'. "
            f"Allowed transitions: {self.allowed}"
        )


class ValidationError(Exception):
    """Raised when content validation fails."""
    def __init__(self, task_type: str, errors: Any):
        self.task_type = task_type
        self.errors = errors
        super().__init__(f"Invalid content for task type '{task_type}': {errors}")


# =============================================================================
# TASK SERVICE
# =============================================================================

class TaskService:
    """
    Service for managing workspace tasks.
    
    Handles all business logic including:
    - Content validation against task_type schemas
    - State machine enforcement
    - Optimistic locking for concurrent edit protection
    """
    
    def __init__(self):
        self.client = get_supabase_client()
        if not self.client:
            raise RuntimeError("Supabase client not available")
    
    # =========================================================================
    # CREATE
    # =========================================================================
    
    async def create_task(
        self,
        *,
        user_id: str,
        agent_slug: str,
        task_type: str,
        title: str,
        content: dict,
        org_id: Optional[str] = None,
        due_date: Optional[datetime] = None,
        thread_id: Optional[str] = None,
        status: str = "pending_approval",
    ) -> dict:
        """
        Create a new workspace task.
        
        Args:
            user_id: Owner's user ID
            agent_slug: Creating agent's slug
            task_type: Type of task (blog_post, tweet, etc.)
            title: Display title
            content: Content payload (will be validated)
            org_id: Optional organization ID
            due_date: Optional due date
            thread_id: Optional source conversation thread
            status: Initial status (default: pending_approval)
            
        Returns:
            Created task dict
            
        Raises:
            ValidationError: If content doesn't match task_type schema
        """
        # Validate content against schema
        try:
            validated_content = validate_task_content(task_type, content)
        except Exception as e:
            raise ValidationError(task_type, str(e))
        
        # Build insert data
        insert_data = {
            "user_id": user_id,
            "agent_slug": agent_slug,
            "task_type": task_type,
            "title": title,
            "content_payload": validated_content,
            "status": status,
            "version": 1,
            "feedback_history": [],
        }
        
        if org_id:
            insert_data["org_id"] = org_id
        if due_date:
            insert_data["due_date"] = due_date.isoformat()
        if thread_id:
            insert_data["thread_id"] = thread_id
        
        # Insert into database
        result = self.client.table("workspace_tasks").insert(insert_data).execute()
        
        if not result.data:
            raise RuntimeError("Failed to create task")
        
        task = result.data[0]
        logger.info(f"Created task {task['id']} ({task_type}) for user {user_id}")
        
        return task
    
    # =========================================================================
    # READ
    # =========================================================================
    
    async def get_task(self, task_id: UUID, user_id: str) -> dict:
        """
        Get a single task by ID.
        
        Args:
            task_id: Task UUID
            user_id: Requesting user's ID (for authorization)
            
        Returns:
            Task dict
            
        Raises:
            TaskNotFoundError: If task doesn't exist or user doesn't have access
        """
        result = self.client.table("workspace_tasks")\
            .select("*")\
            .eq("id", str(task_id))\
            .eq("user_id", user_id)\
            .execute()
        
        if not result.data:
            raise TaskNotFoundError(task_id)
        
        return result.data[0]
    
    async def list_tasks(
        self,
        user_id: str,
        *,
        status: Optional[list[str]] = None,
        agent_slug: Optional[str] = None,
        task_type: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[dict], int]:
        """
        List tasks with optional filters.
        
        Args:
            user_id: Requesting user's ID
            status: Filter by status(es)
            agent_slug: Filter by agent
            task_type: Filter by task type
            page: Page number (1-indexed)
            page_size: Items per page
            
        Returns:
            Tuple of (tasks list, total count)
        """
        # Build query
        query = self.client.table("workspace_tasks")\
            .select("*", count="exact")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)
        
        # Apply filters
        if status:
            query = query.in_("status", status)
        if agent_slug:
            query = query.eq("agent_slug", agent_slug)
        if task_type:
            query = query.eq("task_type", task_type)
        
        # Pagination
        offset = (page - 1) * page_size
        query = query.range(offset, offset + page_size - 1)
        
        result = query.execute()
        
        total = result.count if result.count is not None else len(result.data)
        return result.data, total
    
    async def get_calendar_tasks(
        self,
        user_id: str,
        start_date: datetime,
        end_date: datetime,
        *,
        status: Optional[list[str]] = None,
        agent_slug: Optional[str] = None,
    ) -> list[dict]:
        """
        Get tasks for calendar view within a date range.
        
        Args:
            user_id: Requesting user's ID
            start_date: Start of date range
            end_date: End of date range
            status: Filter by status(es)
            agent_slug: Filter by agent
            
        Returns:
            List of tasks with due_date in range
        """
        query = self.client.table("workspace_tasks")\
            .select("*")\
            .eq("user_id", user_id)\
            .not_.is_("due_date", "null")\
            .gte("due_date", start_date.isoformat())\
            .lte("due_date", end_date.isoformat())\
            .order("due_date", desc=False)
        
        if status:
            query = query.in_("status", status)
        if agent_slug:
            query = query.eq("agent_slug", agent_slug)
        
        result = query.execute()
        return result.data
    
    async def get_pending_count(self, user_id: str) -> int:
        """
        Get count of pending approval tasks for dashboard badge.
        
        Args:
            user_id: Requesting user's ID
            
        Returns:
            Count of pending tasks
        """
        result = self.client.table("workspace_tasks")\
            .select("id", count="exact")\
            .eq("user_id", user_id)\
            .eq("status", "pending_approval")\
            .execute()
        
        return result.count if result.count is not None else 0
    
    # =========================================================================
    # UPDATE
    # =========================================================================
    
    async def update_task(
        self,
        task_id: UUID,
        user_id: str,
        content: dict,
        version: int,
        *,
        title: Optional[str] = None,
    ) -> dict:
        """
        Update task content with optimistic locking.
        
        Args:
            task_id: Task UUID
            user_id: Requesting user's ID
            content: New content payload
            version: Current version (for optimistic locking)
            title: Optional new title
            
        Returns:
            Updated task dict
            
        Raises:
            TaskNotFoundError: If task doesn't exist
            ConflictError: If version mismatch (concurrent edit)
            ValidationError: If content validation fails
        """
        # First, get the task to validate content against its type
        task = await self.get_task(task_id, user_id)
        
        # Validate content
        try:
            validated_content = validate_task_content(task["task_type"], content)
        except Exception as e:
            raise ValidationError(task["task_type"], str(e))
        
        # Build update data
        update_data = {
            "content_payload": validated_content,
            "version": task["version"] + 1,
        }
        if title:
            update_data["title"] = title
        
        # Update with version check (optimistic locking)
        result = self.client.table("workspace_tasks")\
            .update(update_data)\
            .eq("id", str(task_id))\
            .eq("user_id", user_id)\
            .eq("version", version)\
            .execute()
        
        if not result.data:
            # Version mismatch - fetch current to report actual version
            current = await self.get_task(task_id, user_id)
            raise ConflictError(current["version"], version)
        
        logger.info(f"Updated task {task_id} to version {update_data['version']}")
        return result.data[0]
    
    async def update_status(
        self,
        task_id: UUID,
        user_id: str,
        new_status: str,
        version: int,
        *,
        feedback: Optional[str] = None,
        scheduled_at: Optional[datetime] = None,
    ) -> dict:
        """
        Update task status with state machine validation.
        
        Args:
            task_id: Task UUID
            user_id: Requesting user's ID
            new_status: Target status
            version: Current version (for optimistic locking)
            feedback: Feedback message (required when rejecting)
            scheduled_at: Scheduled publish time (for 'scheduled' status)
            
        Returns:
            Updated task dict
            
        Raises:
            TaskNotFoundError: If task doesn't exist
            ConflictError: If version mismatch
            InvalidTransitionError: If status transition not allowed
        """
        # Get current task
        task = await self.get_task(task_id, user_id)
        current_status = task["status"]
        
        # Validate state transition
        if not validate_status_transition(current_status, new_status):
            raise InvalidTransitionError(current_status, new_status)
        
        # Build update data
        update_data = {
            "status": new_status,
            "version": task["version"] + 1,
        }
        
        # Handle rejection feedback
        if new_status == "rejected":
            if not feedback:
                raise ValueError("Feedback is required when rejecting a task")
            
            # Append to feedback history
            feedback_entry = {
                "feedback": feedback,
                "rejected_at": datetime.utcnow().isoformat(),
            }
            feedback_history = task.get("feedback_history", []) or []
            feedback_history.append(feedback_entry)
            update_data["feedback_history"] = feedback_history
        
        # Handle scheduling
        if new_status == "scheduled" and scheduled_at:
            update_data["scheduled_at"] = scheduled_at.isoformat()
        
        # Handle publishing
        if new_status == "published":
            update_data["published_at"] = datetime.utcnow().isoformat()
        
        # Update with version check
        result = self.client.table("workspace_tasks")\
            .update(update_data)\
            .eq("id", str(task_id))\
            .eq("user_id", user_id)\
            .eq("version", version)\
            .execute()
        
        if not result.data:
            # Version mismatch
            current = await self.get_task(task_id, user_id)
            raise ConflictError(current["version"], version)
        
        logger.info(f"Task {task_id} status changed: {current_status} -> {new_status}")
        return result.data[0]
    
    async def bulk_update_status(
        self,
        user_id: str,
        task_ids: list[UUID],
        new_status: str,
    ) -> tuple[int, list[dict]]:
        """
        Update status for multiple tasks.
        
        Note: Skips version check for bulk operations.
        Invalid transitions are logged and skipped.
        
        Args:
            user_id: Requesting user's ID
            task_ids: List of task IDs to update
            new_status: Target status for all
            
        Returns:
            Tuple of (updated count, list of failures with reasons)
        """
        updated = 0
        failed = []
        
        for task_id in task_ids:
            try:
                task = await self.get_task(task_id, user_id)
                
                if not validate_status_transition(task["status"], new_status):
                    failed.append({
                        "task_id": str(task_id),
                        "reason": f"Cannot transition from {task['status']} to {new_status}"
                    })
                    continue
                
                # Update without version check for bulk
                self.client.table("workspace_tasks")\
                    .update({
                        "status": new_status,
                        "version": task["version"] + 1,
                    })\
                    .eq("id", str(task_id))\
                    .eq("user_id", user_id)\
                    .execute()
                
                updated += 1
                
            except TaskNotFoundError:
                failed.append({
                    "task_id": str(task_id),
                    "reason": "Task not found"
                })
            except Exception as e:
                failed.append({
                    "task_id": str(task_id),
                    "reason": str(e)
                })
        
        logger.info(f"Bulk status update: {updated} updated, {len(failed)} failed")
        return updated, failed
    
    # =========================================================================
    # DELETE (Soft delete via status)
    # =========================================================================
    
    async def cancel_task(self, task_id: UUID, user_id: str, version: int) -> dict:
        """
        Cancel a task (soft delete).
        
        Args:
            task_id: Task UUID
            user_id: Requesting user's ID
            version: Current version
            
        Returns:
            Updated task dict
        """
        return await self.update_status(
            task_id, 
            user_id, 
            TaskStatus.CANCELLED.value, 
            version
        )


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_task_service: Optional[TaskService] = None


def get_task_service() -> TaskService:
    """Get or create the task service singleton."""
    global _task_service
    if _task_service is None:
        _task_service = TaskService()
    return _task_service
