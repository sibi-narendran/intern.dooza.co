"""
Task API Request/Response Schemas

Pydantic models for task CRUD operations and workflow endpoints.
Includes optimistic locking via version field.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional, Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# =============================================================================
# TASK STATUS ENUM & STATE MACHINE
# =============================================================================

class TaskStatus(str, Enum):
    """Valid task lifecycle states."""
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    SCHEDULED = "scheduled"
    PUBLISHING = "publishing"  # Publish in progress
    PUBLISHED = "published"
    PARTIALLY_PUBLISHED = "partially_published"  # Some platforms succeeded
    FAILED = "failed"  # All platforms failed
    REJECTED = "rejected"
    CANCELLED = "cancelled"


# State machine: which transitions are allowed from each state
VALID_TRANSITIONS: dict[str, list[str]] = {
    'draft': ['pending_approval', 'cancelled'],
    'pending_approval': ['approved', 'rejected', 'cancelled'],
    'approved': ['scheduled', 'publishing', 'cancelled'],  # Can publish directly or schedule
    'rejected': ['draft'],  # Agent revises and resubmits
    'scheduled': ['publishing', 'cancelled'],  # Scheduler triggers publishing
    'publishing': ['published', 'partially_published', 'failed'],  # Publishing outcomes
    'partially_published': ['publishing'],  # Can retry failed platforms
    'failed': ['publishing', 'cancelled'],  # Can retry or cancel
    'published': [],  # Terminal state
    'cancelled': [],  # Terminal state
}


def validate_status_transition(current: str, target: str) -> bool:
    """
    Check if a status transition is valid.
    
    Args:
        current: Current task status
        target: Desired new status
        
    Returns:
        True if transition is allowed, False otherwise
    """
    allowed = VALID_TRANSITIONS.get(current, [])
    return target in allowed


# =============================================================================
# REQUEST SCHEMAS
# =============================================================================

class TaskCreate(BaseModel):
    """Request schema for creating a new task."""
    task_type: str = Field(
        ..., 
        min_length=1,
        description="Type of task (e.g., 'blog_post', 'tweet')"
    )
    title: str = Field(
        ..., 
        min_length=1, 
        max_length=500,
        description="Task title for display"
    )
    content: dict = Field(
        ...,
        description="Task content payload (validated against task_type schema)"
    )
    due_date: Optional[datetime] = Field(
        None,
        description="When the task is due"
    )
    
    @field_validator('task_type')
    @classmethod
    def lowercase_task_type(cls, v: str) -> str:
        """Normalize task type to lowercase."""
        return v.lower().strip()


class TaskUpdate(BaseModel):
    """
    Request schema for updating task content.
    
    Requires version for optimistic locking.
    """
    content: dict = Field(
        ...,
        description="Updated content payload"
    )
    version: int = Field(
        ...,
        ge=1,
        description="Current version (for optimistic locking)"
    )
    title: Optional[str] = Field(
        None,
        max_length=500,
        description="Optional title update"
    )


class TaskStatusUpdate(BaseModel):
    """
    Request schema for updating task status.
    
    Requires version for optimistic locking.
    Feedback is required when rejecting.
    """
    status: str = Field(
        ...,
        description="New status"
    )
    version: int = Field(
        ...,
        ge=1,
        description="Current version (for optimistic locking)"
    )
    feedback: Optional[str] = Field(
        None,
        description="Feedback message (required when rejecting)"
    )
    scheduled_at: Optional[datetime] = Field(
        None,
        description="When to publish (for 'scheduled' status)"
    )
    
    @field_validator('status')
    @classmethod
    def validate_status_value(cls, v: str) -> str:
        """Ensure status is a valid enum value."""
        valid = {s.value for s in TaskStatus}
        if v.lower() not in valid:
            raise ValueError(f"Status must be one of: {', '.join(valid)}")
        return v.lower()


class BulkStatusUpdate(BaseModel):
    """Request schema for bulk status updates."""
    task_ids: list[UUID] = Field(
        ..., 
        min_length=1,
        description="List of task IDs to update"
    )
    status: str = Field(
        ...,
        description="New status for all tasks"
    )
    
    @field_validator('status')
    @classmethod
    def validate_status_value(cls, v: str) -> str:
        """Ensure status is a valid enum value."""
        valid = {s.value for s in TaskStatus}
        if v.lower() not in valid:
            raise ValueError(f"Status must be one of: {', '.join(valid)}")
        return v.lower()


class CalendarQuery(BaseModel):
    """Query parameters for calendar endpoint."""
    start_date: datetime = Field(..., description="Start of date range")
    end_date: datetime = Field(..., description="End of date range")
    status: Optional[list[str]] = Field(
        None, 
        description="Filter by status(es)"
    )
    agent_slug: Optional[str] = Field(
        None,
        description="Filter by agent"
    )


# =============================================================================
# RESPONSE SCHEMAS
# =============================================================================

class FeedbackEntry(BaseModel):
    """Single feedback entry in history."""
    feedback: str
    rejected_at: datetime
    rejected_by: Optional[str] = None


class TaskResponse(BaseModel):
    """Response schema for a single task."""
    id: UUID
    org_id: Optional[UUID] = None
    user_id: UUID
    agent_slug: str
    task_type: str
    title: str
    status: str
    content_payload: dict
    due_date: Optional[datetime] = None
    scheduled_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    feedback_history: list[dict] = Field(default_factory=list)
    version: int
    parent_task_id: Optional[UUID] = None
    thread_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    # Publish pipeline fields
    target_platforms: list[str] = Field(default_factory=list)
    connection_ids: dict = Field(default_factory=dict)
    publish_results: dict = Field(default_factory=dict)
    scheduled_for: Optional[datetime] = None
    retry_count: int = 0
    
    # Computed fields for UI
    calendar_color: Optional[str] = None
    
    model_config = {
        "from_attributes": True
    }


class TaskListResponse(BaseModel):
    """Response schema for task list endpoints."""
    tasks: list[TaskResponse]
    total: int
    page: int = 1
    page_size: int = 50
    has_more: bool = False


class PendingCountResponse(BaseModel):
    """Response for pending approval count."""
    count: int


class BulkUpdateResponse(BaseModel):
    """Response for bulk status update."""
    updated: int
    failed: list[dict] = Field(
        default_factory=list,
        description="List of failed updates with reasons"
    )


# =============================================================================
# ERROR SCHEMAS
# =============================================================================

class ConflictError(BaseModel):
    """Error response for optimistic locking conflicts."""
    detail: str = "Task was modified by another user. Please refresh and try again."
    current_version: int
    your_version: int


class InvalidTransitionError(BaseModel):
    """Error response for invalid status transitions."""
    detail: str
    current_status: str
    requested_status: str
    allowed_transitions: list[str]
