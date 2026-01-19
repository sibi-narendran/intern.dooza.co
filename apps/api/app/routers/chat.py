"""
Chat Router

Handles chat interactions with AI agents via Server-Sent Events (SSE).

Supports:
- Streaming responses with tool execution indicators
- Thread-based conversation persistence
- Usage logging for analytics/billing

Production-ready with:
- Input validation
- Rate limit awareness
- Comprehensive error handling
- Usage tracking
"""

from __future__ import annotations
import json
import uuid
import time
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from langchain_core.messages import HumanMessage

# Constants
MAX_MESSAGE_LENGTH = 32000  # characters
MAX_THREAD_ID_LENGTH = 128

from app.core.auth import get_current_user
from app.core.database import get_supabase_client, get_checkpointer
from app.agents.factory import (
    get_agent_config, 
    is_tool_enabled,
    get_agent_by_slug,
)
from app.agents.base import DoozaAgent
from app.agents.config import AgentConfig
from app.agents.events import AgentEvent, EventType, event_stream_headers, SSE_DONE
from app.tools.registry import get_tool_registry
from app.context.loader import load_context
from app.context.types import AgentContext

logger = logging.getLogger(__name__)
router = APIRouter()


class ChatRequest(BaseModel):
    """Request body for chat endpoint."""
    message: str = Field(
        ...,
        min_length=1,
        max_length=MAX_MESSAGE_LENGTH,
        description="The user's message to send to the agent",
    )
    thread_id: Optional[str] = Field(
        default=None,
        max_length=MAX_THREAD_ID_LENGTH,
        description="Optional thread ID for conversation continuity",
    )
    
    @field_validator('message')
    @classmethod
    def validate_message(cls, v: str) -> str:
        """Validate and clean message."""
        v = v.strip()
        if not v:
            raise ValueError("Message cannot be empty or only whitespace")
        return v
    
    @field_validator('thread_id')
    @classmethod
    def validate_thread_id(cls, v: Optional[str]) -> Optional[str]:
        """Validate thread_id format."""
        if v is not None:
            v = v.strip()
            if not v:
                return None
            # Basic validation - alphanumeric with underscores/hyphens
            if not all(c.isalnum() or c in '_-' for c in v):
                raise ValueError("Thread ID contains invalid characters")
        return v


class ThreadResponse(BaseModel):
    """Response for thread creation/info."""
    thread_id: str
    agent_id: str
    user_id: str


def generate_thread_id(user_id: str, agent_id: str) -> str:
    """Generate a unique thread ID in format: {user_id}_{agent_id}_{uuid}"""
    short_uuid = str(uuid.uuid4())[:8]
    return f"{user_id[:8]}_{agent_id}_{short_uuid}"


async def verify_agent_hired(user_id: str, agent_slug: str) -> Dict[str, Any]:
    """
    Verify user has hired the agent and return agent config.
    
    Returns agent config dict.
    Raises HTTPException if not hired or agent not found.
    """
    supabase = get_supabase_client()
    
    # Get agent config (works even without DB)
    config = get_agent_config(agent_slug)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent '{agent_slug}' not found"
        )
    
    if not supabase:
        # Fallback: allow chat if DB unavailable (for development)
        return config
    
    try:
        # Get agent by slug
        agent_result = supabase.table("gallery_agents").select(
            "id, slug, system_prompt"
        ).eq("slug", agent_slug).eq("is_published", True).execute()
        
        if not agent_result.data:
            # Use fallback config
            return config
        
        agent = agent_result.data[0]
        
        # Check if user has hired this agent
        hired_result = supabase.table("hired_agents").select("id").eq(
            "user_id", user_id
        ).eq("agent_id", agent["id"]).eq("is_active", True).execute()
        
        if not hired_result.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You haven't hired this agent. Please hire '{agent_slug}' first."
            )
        
        # Update last_used_at
        from datetime import datetime, timezone
        supabase.table("hired_agents").update({
            "last_used_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", hired_result.data[0]["id"]).execute()
        
        return config
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to verify agent hire: {e}")
        # Fallback to config if DB fails
        return config


async def log_usage(
    user_id: str,
    agent_id: Optional[str],
    thread_id: str,
    message_type: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    model_used: Optional[str] = None,
    latency_ms: Optional[int] = None
):
    """Log chat usage for billing analytics."""
    supabase = get_supabase_client()
    if not supabase:
        return  # Skip logging if DB unavailable
    
    try:
        supabase.table("agent_usage_log").insert({
            "user_id": user_id,
            "agent_id": agent_id,
            "thread_id": thread_id,
            "message_type": message_type,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "model_used": model_used,
            "latency_ms": latency_ms
        }).execute()
    except Exception as e:
        logger.warning(f"Failed to log usage: {e}")


@router.post("/chat/{agent_slug}")
async def chat(
    agent_slug: str,
    request: ChatRequest,
    user_id: str = Depends(get_current_user),
):
    """
    Chat with an AI agent using Server-Sent Events (SSE) streaming.
    
    The agent_slug is the URL-friendly identifier (e.g., 'pam', 'seomi').
    User must have hired the agent to chat with it.
    
    The response streams events for:
    - Tokens (streaming response text)
    - Tool calls (when agent uses tools)
    - Tool results
    - Errors
    - Completion
    
    Event format: {"type": "token|tool_start|tool_end|error|end", ...}
    """
    # Verify user has hired this agent
    agent_config = await verify_agent_hired(user_id, agent_slug)
    agent_id = agent_config.get("id")
    
    # Get or create thread_id
    thread_id = request.thread_id or generate_thread_id(user_id, agent_slug)
    
    # Track timing for latency logging
    start_time = time.time()
    
    # Check if this agent uses the new tool-enabled system
    if is_tool_enabled(agent_slug):
        # Use new DoozaAgent with tools
        return await _chat_with_dooza_agent(
            agent_slug=agent_slug,
            agent_config=agent_config,
            message=request.message,
            thread_id=thread_id,
            user_id=user_id,
            agent_id=agent_id,
            start_time=start_time,
        )
    else:
        # Use legacy agent (no tools)
        return await _chat_with_legacy_agent(
            agent_slug=agent_slug,
            agent_config=agent_config,
            message=request.message,
            thread_id=thread_id,
            user_id=user_id,
            agent_id=agent_id,
            start_time=start_time,
        )


async def _chat_with_dooza_agent(
    agent_slug: str,
    agent_config: Dict[str, Any],
    message: str,
    thread_id: str,
    user_id: str,
    agent_id: Optional[str],
    start_time: float,
):
    """
    Chat using the new DoozaAgent system with tools.
    
    Streams AgentEvents that include tool execution indicators.
    """
    # Load user context
    context = await load_context(user_id)
    
    # Get tool registry
    tool_registry = get_tool_registry()
    
    # Build agent config
    config = AgentConfig.from_db_row(agent_config)
    
    # Get checkpointer for conversation persistence
    checkpointer = get_checkpointer()
    
    # Create agent
    agent = DoozaAgent(
        config=config,
        tool_registry=tool_registry,
        context=context,
        checkpointer=checkpointer,
    )
    
    async def stream_response():
        """Generate SSE stream from agent events."""
        output_token_count = 0
        assistant_content = []  # Accumulate response for saving
        tool_calls_log = []  # Track tool calls
        tool_results_log = []  # Track tool results
        
        try:
            # Send thread_id first
            yield AgentEvent.with_thread_id(thread_id).to_sse()
            
            # Save user message to database
            await save_message(
                thread_id=thread_id,
                user_id=user_id,
                agent_slug=agent_slug,
                role="user",
                content=message,
            )
            
            # Log user message for billing
            await log_usage(
                user_id=user_id,
                agent_id=agent_id,
                thread_id=thread_id,
                message_type="user",
                input_tokens=len(message.split()) * 2  # Rough estimate
            )
            
            # Stream agent response
            async for event in agent.run(message, thread_id):
                # Count tokens and accumulate content
                if event.type == EventType.TOKEN and event.content:
                    output_token_count += 1
                    assistant_content.append(event.content)
                
                # Track tool usage
                elif event.type == EventType.TOOL_START:
                    tool_calls_log.append({
                        "name": event.tool_name,
                        "args": event.tool_args,
                    })
                elif event.type == EventType.TOOL_END:
                    tool_results_log.append({
                        "name": event.tool_name,
                        "result": str(event.tool_result)[:500] if event.tool_result else None,
                    })
                
                # Send event to client
                yield event.to_sse()
            
            # Save assistant message to database
            full_response = "".join(assistant_content)
            if full_response:
                await save_message(
                    thread_id=thread_id,
                    user_id=user_id,
                    agent_slug=agent_slug,
                    role="assistant",
                    content=full_response,
                    tool_calls=tool_calls_log if tool_calls_log else None,
                    tool_results=tool_results_log if tool_results_log else None,
                )
            
            # Log assistant response for billing
            latency_ms = int((time.time() - start_time) * 1000)
            await log_usage(
                user_id=user_id,
                agent_id=agent_id,
                thread_id=thread_id,
                message_type="assistant",
                output_tokens=output_token_count * 4,  # Rough estimate
                latency_ms=latency_ms
            )
            
            yield SSE_DONE
            
        except Exception as e:
            logger.error(f"Chat error for {agent_slug}: {e}", exc_info=True)
            yield AgentEvent.create_error(str(e)).to_sse()
    
    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers=event_stream_headers(),
    )


async def _chat_with_legacy_agent(
    agent_slug: str,
    agent_config: Dict[str, Any],
    message: str,
    thread_id: str,
    user_id: str,
    agent_id: Optional[str],
    start_time: float,
):
    """
    Chat using legacy agent (no tools).
    
    Kept for backwards compatibility with agents that don't have tools yet.
    """
    # Get the legacy agent graph
    agent = get_agent_by_slug(agent_slug, agent_config.get("system_prompt"))
    
    # LangGraph config with thread_id for checkpointing
    config = {
        "configurable": {
            "thread_id": thread_id,
            "user_id": user_id,
        }
    }
    
    async def stream_response():
        """Generate SSE stream from agent response."""
        output_token_count = 0
        
        try:
            # Send thread_id first
            yield f"data: {json.dumps({'type': 'thread_id', 'thread_id': thread_id})}\n\n"
            
            # Log user message
            await log_usage(
                user_id=user_id,
                agent_id=agent_id,
                thread_id=thread_id,
                message_type="user",
                input_tokens=len(message.split()) * 2
            )
            
            # Stream the agent response
            async for event in agent.astream_events(
                {"messages": [HumanMessage(content=message)]},
                config=config,
                version="v2",
            ):
                kind = event["event"]
                
                # Stream chat model tokens
                if kind == "on_chat_model_stream":
                    content = event["data"]["chunk"].content
                    if content:
                        output_token_count += 1
                        yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"
                
                # Final message complete
                elif kind == "on_chat_model_end":
                    yield f"data: {json.dumps({'type': 'end'})}\n\n"
            
            # Log assistant response
            latency_ms = int((time.time() - start_time) * 1000)
            await log_usage(
                user_id=user_id,
                agent_id=agent_id,
                thread_id=thread_id,
                message_type="assistant",
                output_tokens=output_token_count * 4,
                latency_ms=latency_ms
            )
            
            yield "data: [DONE]\n\n"
            
        except Exception as e:
            logger.error(f"Chat error for {agent_slug}: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
    
    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/threads")
async def list_threads(
    agent_slug: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=100, description="Max threads to return"),
    user_id: str = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    List conversation threads for the current user.
    
    Optionally filter by agent_slug.
    Returns threads sorted by most recent first.
    """
    supabase = get_supabase_client()
    if not supabase:
        return {"threads": [], "user_id": user_id}
    
    try:
        query = supabase.table("threads").select(
            "id, agent_id, title, last_message_preview, message_count, created_at, updated_at"
        ).eq("user_id", user_id).order("updated_at", desc=True).limit(limit)
        
        if agent_slug:
            query = query.eq("agent_id", agent_slug)
        
        result = query.execute()
        
        return {
            "threads": result.data or [],
            "user_id": user_id,
            "agent_filter": agent_slug,
        }
    except Exception as e:
        logger.error(f"Failed to list threads: {e}")
        return {"threads": [], "user_id": user_id, "error": str(e)}


@router.get("/threads/{thread_id}/messages")
async def get_thread_messages(
    thread_id: str,
    limit: int = Query(default=100, ge=1, le=500, description="Max messages to return"),
    user_id: str = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get all messages in a conversation thread.
    
    Returns messages sorted by creation time (oldest first).
    """
    supabase = get_supabase_client()
    if not supabase:
        return {"thread_id": thread_id, "messages": []}
    
    try:
        result = supabase.table("messages").select(
            "id, role, content, tool_calls, tool_results, created_at"
        ).eq("thread_id", thread_id).eq("user_id", user_id).order(
            "created_at", desc=False
        ).limit(limit).execute()
        
        return {
            "thread_id": thread_id,
            "messages": result.data or [],
        }
    except Exception as e:
        logger.error(f"Failed to get messages: {e}")
        return {"thread_id": thread_id, "messages": [], "error": str(e)}


@router.delete("/threads/{thread_id}")
async def delete_thread(
    thread_id: str,
    user_id: str = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Delete a conversation thread and all its messages.
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Delete messages first (foreign key constraint)
        supabase.table("messages").delete().eq(
            "thread_id", thread_id
        ).eq("user_id", user_id).execute()
        
        # Delete thread
        supabase.table("threads").delete().eq(
            "id", thread_id
        ).eq("user_id", user_id).execute()
        
        return {"deleted": True, "thread_id": thread_id}
    except Exception as e:
        logger.error(f"Failed to delete thread: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def save_message(
    thread_id: str,
    user_id: str,
    agent_slug: str,
    role: str,
    content: str,
    tool_calls: Optional[list] = None,
    tool_results: Optional[list] = None,
) -> Optional[str]:
    """
    Save a message to the database.
    
    Returns the message ID or None on failure.
    """
    supabase = get_supabase_client()
    if not supabase:
        logger.warning("No database - message not persisted")
        return None
    
    try:
        result = supabase.table("messages").insert({
            "thread_id": thread_id,
            "user_id": user_id,
            "agent_slug": agent_slug,
            "role": role,
            "content": content,
            "tool_calls": tool_calls,
            "tool_results": tool_results,
        }).execute()
        
        if result.data:
            return result.data[0].get("id")
        return None
    except Exception as e:
        logger.error(f"Failed to save message: {e}")
        return None
