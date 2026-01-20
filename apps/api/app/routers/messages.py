"""
Messages Router - Chat message persistence and conversation management.

This router handles:
- Saving chat messages (user and assistant)
- Loading conversation history
- Listing user's conversations (threads)
- Deleting conversations
- Batch operations for retry queue flush

Industry-standard hybrid approach:
- LangGraph checkpointer handles LLM memory (unchanged)
- This router handles UI display persistence
"""

import logging
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.core.database import get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================================
# Request/Response Models
# ============================================================================

class ToolCallSummary(BaseModel):
    """Compressed tool call data for storage efficiency."""
    name: str
    args: Optional[dict] = None  # Only essential args (e.g., url)
    status: str = "complete"  # complete | error
    summary: Optional[dict] = None  # Compressed result (e.g., {score: 85, issueCount: 3})


class SaveMessageRequest(BaseModel):
    """Request to save a single message."""
    thread_id: str = Field(..., min_length=1, max_length=100)
    agent_slug: str = Field(..., min_length=1, max_length=50)
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., max_length=100000)  # 100KB max
    tool_calls_summary: Optional[List[ToolCallSummary]] = None


class BatchSaveRequest(BaseModel):
    """Request to save multiple messages (for retry queue flush)."""
    messages: List[SaveMessageRequest] = Field(..., min_items=1, max_items=50)


class MessageResponse(BaseModel):
    """Response for a single message."""
    id: str
    thread_id: str
    role: str
    content: str
    tool_calls_summary: Optional[List[dict]] = None
    created_at: str


class ThreadSummary(BaseModel):
    """Summary of a conversation thread for list view."""
    thread_id: str
    agent_slug: str
    title: str  # First user message, truncated
    last_message_preview: str
    message_count: int
    created_at: str
    updated_at: str


class PaginatedMessages(BaseModel):
    """Paginated response for messages."""
    messages: List[MessageResponse]
    total: int
    has_more: bool
    next_cursor: Optional[str] = None


class PaginatedThreads(BaseModel):
    """Paginated response for threads."""
    threads: List[ThreadSummary]
    total: int
    has_more: bool


# ============================================================================
# Helper Functions
# ============================================================================

def _transform_message(row: dict) -> MessageResponse:
    """Transform database row to MessageResponse."""
    return MessageResponse(
        id=str(row["id"]),
        thread_id=row["thread_id"],
        role=row["role"],
        content=row["content"],
        tool_calls_summary=row.get("tool_calls"),
        created_at=row["created_at"],
    )


def _generate_title(content: str, max_length: int = 100) -> str:
    """Generate thread title from first message content."""
    # Remove markdown, clean up
    title = content.replace("#", "").replace("*", "").strip()
    # Truncate
    if len(title) > max_length:
        title = title[:max_length - 3] + "..."
    return title


# ============================================================================
# Thread Endpoints
# ============================================================================

@router.get("/threads", response_model=PaginatedThreads)
async def list_threads(
    agent_slug: Optional[str] = Query(None, description="Filter by agent"),
    limit: int = Query(20, ge=1, le=100, description="Max threads to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    user_id: str = Depends(get_current_user),
):
    """
    List user's conversation threads.
    
    Returns threads sorted by most recently updated.
    Optionally filter by agent_slug.
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    try:
        # Build query for threads with aggregated data
        # We'll query messages and aggregate by thread_id
        query = supabase.table("messages").select(
            "thread_id, agent_slug, role, content, created_at",
            count="exact"
        ).eq("user_id", user_id)
        
        if agent_slug:
            query = query.eq("agent_slug", agent_slug)
        
        # Get all messages to aggregate (we'll optimize this later with a view)
        result = query.order("created_at", desc=True).execute()
        
        if not result.data:
            return PaginatedThreads(threads=[], total=0, has_more=False)
        
        # Aggregate by thread_id
        threads_map: dict = {}
        for msg in result.data:
            tid = msg["thread_id"]
            if tid not in threads_map:
                threads_map[tid] = {
                    "thread_id": tid,
                    "agent_slug": msg["agent_slug"],
                    "title": "",
                    "last_message_preview": msg["content"][:200] if msg["content"] else "",
                    "message_count": 0,
                    "created_at": msg["created_at"],
                    "updated_at": msg["created_at"],
                    "first_user_content": None,
                }
            
            threads_map[tid]["message_count"] += 1
            
            # Track first user message for title (only user messages)
            if msg.get("role") == "user" and not threads_map[tid]["first_user_content"]:
                threads_map[tid]["first_user_content"] = msg["content"]
        
        # Convert to list and set titles
        threads_list = []
        for tid, data in threads_map.items():
            title = _generate_title(data["first_user_content"] or "New conversation")
            threads_list.append(ThreadSummary(
                thread_id=data["thread_id"],
                agent_slug=data["agent_slug"],
                title=title,
                last_message_preview=data["last_message_preview"][:200],
                message_count=data["message_count"],
                created_at=data["created_at"],
                updated_at=data["updated_at"],
            ))
        
        # Sort by updated_at descending
        threads_list.sort(key=lambda x: x.updated_at, reverse=True)
        
        # Paginate
        total = len(threads_list)
        threads_list = threads_list[offset:offset + limit]
        has_more = offset + len(threads_list) < total
        
        return PaginatedThreads(
            threads=threads_list,
            total=total,
            has_more=has_more,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list threads: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list conversations"
        )


@router.get("/threads/{thread_id}/messages", response_model=PaginatedMessages)
async def get_thread_messages(
    thread_id: str,
    limit: int = Query(100, ge=1, le=500, description="Max messages to return"),
    cursor: Optional[str] = Query(None, description="Cursor for pagination (message ID)"),
    user_id: str = Depends(get_current_user),
):
    """
    Get all messages for a thread.
    
    Returns messages in chronological order (oldest first).
    Supports cursor-based pagination for long conversations.
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    try:
        # Build query
        query = supabase.table("messages").select(
            "id, thread_id, role, content, tool_calls, created_at",
            count="exact"
        ).eq("user_id", user_id).eq("thread_id", thread_id)
        
        # Apply cursor if provided
        if cursor:
            # Get the created_at of the cursor message
            cursor_msg = supabase.table("messages").select("created_at").eq("id", cursor).single().execute()
            if cursor_msg.data:
                query = query.gt("created_at", cursor_msg.data["created_at"])
        
        # Order by created_at ascending (oldest first for chat display)
        result = query.order("created_at", desc=False).limit(limit + 1).execute()
        
        messages = result.data or []
        has_more = len(messages) > limit
        
        if has_more:
            messages = messages[:limit]
        
        next_cursor = messages[-1]["id"] if has_more and messages else None
        
        return PaginatedMessages(
            messages=[_transform_message(m) for m in messages],
            total=result.count or len(messages),
            has_more=has_more,
            next_cursor=next_cursor,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get thread messages: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load messages"
        )


@router.delete("/threads/{thread_id}")
async def delete_thread(
    thread_id: str,
    user_id: str = Depends(get_current_user),
):
    """
    Delete a conversation and all its messages.
    
    This is a hard delete - messages cannot be recovered.
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    try:
        # Verify thread belongs to user and exists
        check = supabase.table("messages").select("id", count="exact").eq(
            "user_id", user_id
        ).eq("thread_id", thread_id).limit(1).execute()
        
        if not check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )
        
        # Delete all messages in thread
        supabase.table("messages").delete().eq(
            "user_id", user_id
        ).eq("thread_id", thread_id).execute()
        
        logger.info(f"Deleted thread {thread_id} for user {user_id}")
        
        return {"success": True, "message": "Conversation deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete thread {thread_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete conversation"
        )


# ============================================================================
# Message Endpoints
# ============================================================================

@router.post("/messages", response_model=MessageResponse)
async def save_message(
    request: SaveMessageRequest,
    user_id: str = Depends(get_current_user),
):
    """
    Save a single chat message.
    
    Used by frontend to persist messages after streaming completes.
    Tool calls should be compressed before sending.
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    try:
        # Prepare data
        data = {
            "thread_id": request.thread_id,
            "user_id": user_id,
            "agent_slug": request.agent_slug,
            "role": request.role,
            "content": request.content,
        }
        
        # Add tool calls if present
        if request.tool_calls_summary:
            data["tool_calls"] = [tc.model_dump() for tc in request.tool_calls_summary]
        
        # Insert
        result = supabase.table("messages").insert(data).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save message"
            )
        
        return _transform_message(result.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save message: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save message"
        )


@router.post("/messages/batch", response_model=List[MessageResponse])
async def save_messages_batch(
    request: BatchSaveRequest,
    user_id: str = Depends(get_current_user),
):
    """
    Save multiple messages in a single request.
    
    Used by frontend to flush retry queue efficiently.
    Messages are inserted in order - earlier messages first.
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    try:
        # Prepare batch data
        batch_data = []
        for msg in request.messages:
            data = {
                "thread_id": msg.thread_id,
                "user_id": user_id,
                "agent_slug": msg.agent_slug,
                "role": msg.role,
                "content": msg.content,
            }
            if msg.tool_calls_summary:
                data["tool_calls"] = [tc.model_dump() for tc in msg.tool_calls_summary]
            batch_data.append(data)
        
        # Batch insert
        result = supabase.table("messages").insert(batch_data).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save messages"
            )
        
        logger.info(f"Batch saved {len(result.data)} messages for user {user_id}")
        
        return [_transform_message(m) for m in result.data]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to batch save messages: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save messages"
        )
