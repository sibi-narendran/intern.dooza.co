import json
import uuid
import time
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_core.messages import HumanMessage

from app.core.auth import get_current_user
from app.core.database import get_supabase_client
from app.agents.factory import get_agent_by_slug, get_agent_config

logger = logging.getLogger(__name__)
router = APIRouter()


class ChatRequest(BaseModel):
    """Request body for chat endpoint."""
    message: str
    thread_id: Optional[str] = None


class ThreadResponse(BaseModel):
    """Response for thread creation/info."""
    thread_id: str
    agent_id: str
    user_id: str


def generate_thread_id(user_id: str, agent_id: str) -> str:
    """Generate a unique thread ID in format: {user_id}_{agent_id}_{uuid}"""
    short_uuid = str(uuid.uuid4())[:8]
    return f"{user_id[:8]}_{agent_id}_{short_uuid}"


async def verify_agent_hired(user_id: str, agent_slug: str) -> dict:
    """
    Verify user has hired the agent and return agent config.
    
    Returns agent config dict with id, slug, system_prompt.
    Raises HTTPException if not hired or agent not found.
    """
    supabase = get_supabase_client()
    if not supabase:
        # Fallback: allow chat if DB unavailable (for development)
        config = get_agent_config(agent_slug)
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Agent '{agent_slug}' not found"
            )
        return config
    
    try:
        # Get agent by slug
        agent_result = supabase.table("gallery_agents").select(
            "id, slug, system_prompt"
        ).eq("slug", agent_slug).eq("is_published", True).execute()
        
        if not agent_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Agent '{agent_slug}' not found"
            )
        
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
        
        return agent
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to verify agent hire: {e}")
        # Fallback to code-defined agent if DB fails
        config = get_agent_config(agent_slug)
        if config:
            return config
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify agent access"
        )


async def log_usage(
    user_id: str,
    agent_id: str,
    thread_id: str,
    message_type: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    model_used: str = None,
    latency_ms: int = None
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
    
    The response streams back token by token for real-time display.
    Conversation state is automatically saved to the database.
    Usage is logged for billing analytics.
    """
    # Verify user has hired this agent
    agent_config = await verify_agent_hired(user_id, agent_slug)
    agent_id = agent_config.get("id")
    
    # Get or create thread_id
    thread_id = request.thread_id or generate_thread_id(user_id, agent_slug)
    
    # Get the agent graph
    agent = get_agent_by_slug(agent_slug, agent_config.get("system_prompt"))
    
    # LangGraph config with thread_id for checkpointing
    config = {
        "configurable": {
            "thread_id": thread_id,
            "user_id": user_id,
        }
    }
    
    # Track timing for latency logging
    start_time = time.time()
    
    async def stream_response():
        """Generate SSE stream from agent response."""
        output_token_count = 0
        
        try:
            # Send thread_id first so frontend can track it
            yield f"data: {json.dumps({'type': 'thread_id', 'thread_id': thread_id})}\n\n"
            
            # Log user message
            await log_usage(
                user_id=user_id,
                agent_id=agent_id,
                thread_id=thread_id,
                message_type="user",
                input_tokens=len(request.message.split()) * 2  # Rough estimate
            )
            
            # Stream the agent response
            async for event in agent.astream_events(
                {"messages": [HumanMessage(content=request.message)]},
                config=config,
                version="v2",
            ):
                kind = event["event"]
                
                # Stream chat model tokens
                if kind == "on_chat_model_stream":
                    content = event["data"]["chunk"].content
                    if content:
                        output_token_count += 1  # Rough token count
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
                output_tokens=output_token_count * 4,  # Rough estimate
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
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@router.get("/threads")
async def list_threads(
    agent_id: Optional[str] = None,
    user_id: str = Depends(get_current_user),
):
    """
    List conversation threads for the current user.
    
    Optionally filter by agent_id.
    
    Note: This is a placeholder. Full implementation would query
    the threads table in Supabase.
    """
    # TODO: Query threads table from Supabase
    # For now, return empty list
    return {"threads": [], "user_id": user_id, "agent_filter": agent_id}


@router.get("/threads/{thread_id}/messages")
async def get_thread_messages(
    thread_id: str,
    user_id: str = Depends(get_current_user),
):
    """
    Get all messages in a conversation thread.
    
    Note: This is a placeholder. Full implementation would load
    from LangGraph checkpointer.
    """
    # TODO: Load messages from checkpointer
    # For now, return empty list
    return {"thread_id": thread_id, "messages": []}
