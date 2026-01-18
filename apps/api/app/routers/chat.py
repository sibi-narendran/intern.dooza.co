import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_core.messages import HumanMessage

from app.core.auth import get_current_user
from app.agents.factory import get_agent, is_valid_agent

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


@router.post("/chat/{agent_id}")
async def chat(
    agent_id: str,
    request: ChatRequest,
    user_id: str = Depends(get_current_user),
):
    """
    Chat with an AI agent using Server-Sent Events (SSE) streaming.
    
    The response streams back token by token for real-time display.
    Conversation state is automatically saved to the database.
    """
    # Validate agent
    if not is_valid_agent(agent_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid agent_id: {agent_id}",
        )
    
    # Get or create thread_id
    thread_id = request.thread_id or generate_thread_id(user_id, agent_id)
    
    # Get the agent
    agent = get_agent(agent_id)
    
    # LangGraph config with thread_id for checkpointing
    config = {
        "configurable": {
            "thread_id": thread_id,
            "user_id": user_id,
        }
    }
    
    async def stream_response():
        """Generate SSE stream from agent response."""
        try:
            # Send thread_id first so frontend can track it
            yield f"data: {json.dumps({'type': 'thread_id', 'thread_id': thread_id})}\n\n"
            
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
                        yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"
                
                # Final message complete
                elif kind == "on_chat_model_end":
                    yield f"data: {json.dumps({'type': 'end'})}\n\n"
            
            yield "data: [DONE]\n\n"
            
        except Exception as e:
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
