"""
Pydantic Schemas for Dooza API

This module contains all request/response schemas and content validation schemas.
"""

from app.schemas.task_content import (
    BlogPostContent,
    TweetContent,
    VideoScriptContent,
    SocialPostContent,
    CONTENT_SCHEMAS,
    validate_task_content,
    get_content_schema,
)

from app.schemas.tasks import (
    TaskCreate,
    TaskUpdate,
    TaskStatusUpdate,
    TaskResponse,
    TaskListResponse,
    CalendarQuery,
    BulkStatusUpdate,
    TaskStatus,
    VALID_TRANSITIONS,
    validate_status_transition,
)

from app.schemas.content_workflow import (
    HashtagResearch,
    TimingResearch,
    ContentIdeasResearch,
    ContentBrief,
    DraftContent,
    ContentFeedback,
    FinalContent,
    WorkflowMetadata,
)

__all__ = [
    # Content schemas
    "BlogPostContent",
    "TweetContent", 
    "VideoScriptContent",
    "SocialPostContent",
    "CONTENT_SCHEMAS",
    "validate_task_content",
    "get_content_schema",
    # Task schemas
    "TaskCreate",
    "TaskUpdate",
    "TaskStatusUpdate",
    "TaskResponse",
    "TaskListResponse",
    "CalendarQuery",
    "BulkStatusUpdate",
    "TaskStatus",
    "VALID_TRANSITIONS",
    "validate_status_transition",
    # Content workflow schemas
    "HashtagResearch",
    "TimingResearch",
    "ContentIdeasResearch",
    "ContentBrief",
    "DraftContent",
    "ContentFeedback",
    "FinalContent",
    "WorkflowMetadata",
]
