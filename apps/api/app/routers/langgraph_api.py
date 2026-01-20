"""
LangGraph API Router

Standard LangGraph production pattern:
- Direct graph invocation with PostgreSQL checkpointer
- Native event streaming via astream_events()
- Full visibility into supervisor, delegation, and specialist activity

This is the recommended self-hosted pattern:
- Uses standard LangGraph APIs internally
- Custom FastAPI wrapper for HTTP handling
- No deprecated LangServe dependency

Endpoints:
- POST /langserve/seomi/invoke - Synchronous invoke
- POST /langserve/seomi/stream_events - Native LangGraph event streaming (full visibility)
"""

import json
import logging
from typing import Any, Dict, Optional
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.agents.seomi import create_seomi_supervisor
from app.core.database import get_checkpointer

logger = logging.getLogger(__name__)


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class Message(BaseModel):
    type: str  # "human" or "ai"
    content: str


class InvokeRequest(BaseModel):
    input: Dict[str, Any]  # {"messages": [...]}
    config: Optional[Dict[str, Any]] = None  # {"configurable": {"thread_id": "..."}}


class InvokeResponse(BaseModel):
    output: Dict[str, Any]


# =============================================================================
# GRAPH INSTANCE (Singleton)
# =============================================================================

_seomi_graph = None


def _get_seomi_graph():
    """Get or create the SEOmi supervisor graph."""
    global _seomi_graph
    
    if _seomi_graph is None:
        checkpointer = get_checkpointer()
        _seomi_graph = create_seomi_supervisor(checkpointer=checkpointer)
        
        if checkpointer:
            logger.info("SEOmi graph created WITH checkpointer (memory enabled)")
        else:
            logger.warning("SEOmi graph created WITHOUT checkpointer (no memory)")
    
    return _seomi_graph


# =============================================================================
# API ENDPOINTS
# =============================================================================

def setup_langgraph_routes(app: FastAPI):
    """
    Add LangGraph API routes to the FastAPI app.
    
    Standard LangGraph pattern:
    - Direct graph invocation with configurable thread_id
    - PostgreSQL checkpointer for conversation memory
    - Native event streaming for full visibility
    """
    
    # Eagerly create graph at startup
    graph = _get_seomi_graph()
    
    @app.post("/langserve/seomi/invoke")
    async def invoke_seomi(request: InvokeRequest) -> InvokeResponse:
        """
        Invoke SEOmi synchronously.
        
        Request body:
        {
            "input": {"messages": [{"type": "human", "content": "..."}]},
            "config": {"configurable": {"thread_id": "unique-thread-id"}}
        }
        """
        # Extract config with thread_id
        config = request.config or {}
        configurable = config.get("configurable", {})
        
        # Validate thread_id is provided
        if "thread_id" not in configurable:
            raise HTTPException(
                status_code=400,
                detail="config.configurable.thread_id is required for memory persistence"
            )
        
        # Add default checkpoint_ns if not provided
        if "checkpoint_ns" not in configurable:
            configurable["checkpoint_ns"] = ""
        
        # Standard LangGraph invocation
        result = await graph.ainvoke(
            request.input,
            config={"configurable": configurable}
        )
        
        return InvokeResponse(output=result)
    
    
    @app.post("/langserve/seomi/stream_events")
    async def stream_events_seomi(request: Request):
        """
        Stream SEOmi response via SSE with native LangGraph events.
        
        This provides full visibility into:
        - on_chat_model_stream: Token streaming from ALL agents (supervisor + specialists)
        - on_tool_start: Tool execution starting (including transfer_to_* for delegation)
        - on_tool_end: Tool execution complete with results
        - Full metadata including langgraph_node for agent identification
        
        Frontend parses native events directly - no transformation needed.
        """
        # Parse request body
        body = await request.json()
        input_data = body.get("input", {})
        config = body.get("config", {})
        configurable = config.get("configurable", {})
        
        # Validate thread_id
        if "thread_id" not in configurable:
            raise HTTPException(
                status_code=400,
                detail="config.configurable.thread_id is required"
            )
        
        if "checkpoint_ns" not in configurable:
            configurable["checkpoint_ns"] = ""
        
        async def event_generator():
            """Generate SSE events with native LangGraph format."""
            try:
                async for event in graph.astream_events(
                    input_data,
                    config={"configurable": configurable},
                    version="v2"
                ):
                    event_type = event.get("event", "")
                    metadata = event.get("metadata", {})
                    
                    # For chat model stream events, extract the actual content
                    if event_type == "on_chat_model_stream":
                        chunk = event.get("data", {}).get("chunk")
                        content = getattr(chunk, "content", "") if chunk else ""
                        
                        # Build clean event with extracted content
                        clean_event = {
                            "event": event_type,
                            "content": content,
                            "metadata": {
                                "langgraph_node": metadata.get("langgraph_node", ""),
                                "langgraph_step": metadata.get("langgraph_step", 0),
                            },
                            "name": event.get("name", ""),
                        }
                        yield f"data: {json.dumps(clean_event)}\n\n"
                    
                    # For tool events, include tool name and data
                    elif event_type in ("on_tool_start", "on_tool_end"):
                        tool_name = event.get("name", "")
                        tool_data = event.get("data", {})
                        
                        # Extract input/output for tools
                        if event_type == "on_tool_start":
                            tool_input = tool_data.get("input", {})
                            clean_event = {
                                "event": event_type,
                                "name": tool_name,
                                "input": tool_input if isinstance(tool_input, dict) else str(tool_input),
                                "metadata": {
                                    "langgraph_node": metadata.get("langgraph_node", ""),
                                },
                            }
                        else:  # on_tool_end
                            tool_output = tool_data.get("output", "")
                            # Extract content if it's a message object (ToolMessage)
                            if hasattr(tool_output, 'content'):
                                tool_output = tool_output.content
                            # Try to parse JSON content for cleaner output
                            if isinstance(tool_output, str):
                                try:
                                    import json as json_lib
                                    tool_output = json_lib.loads(tool_output)
                                except (json_lib.JSONDecodeError, ValueError):
                                    pass  # Keep as string if not valid JSON
                            # Truncate large string outputs
                            if isinstance(tool_output, str) and len(tool_output) > 5000:
                                tool_output = tool_output[:5000] + "..."
                            clean_event = {
                                "event": event_type,
                                "name": tool_name,
                                "output": tool_output,
                                "metadata": {
                                    "langgraph_node": metadata.get("langgraph_node", ""),
                                },
                            }
                        yield f"data: {json.dumps(clean_event, default=str)}\n\n"
                    
                    # Skip verbose chain events, but pass through other useful events
                    elif event_type in ("on_chain_start", "on_chain_end"):
                        # Only emit chain events for the main LangGraph
                        if event.get("name") == "LangGraph":
                            clean_event = {
                                "event": event_type,
                                "name": event.get("name", ""),
                            }
                            yield f"data: {json.dumps(clean_event)}\n\n"
                
                yield "data: [DONE]\n\n"
                
            except Exception as e:
                logger.error(f"Stream error: {e}", exc_info=True)
                yield f"data: {json.dumps({'event': 'error', 'data': {'message': str(e)}})}\n\n"
        
        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # Disable nginx buffering
            }
        )
    
    
    @app.get("/langserve/seomi/input_schema")
    async def input_schema():
        """Return input schema for documentation."""
        return {
            "title": "SEOmi Input Schema",
            "description": "Standard LangGraph input format",
            "type": "object",
            "properties": {
                "input": {
                    "type": "object",
                    "properties": {
                        "messages": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "type": {"type": "string", "enum": ["human", "ai"]},
                                    "content": {"type": "string"}
                                }
                            }
                        }
                    }
                },
                "config": {
                    "type": "object",
                    "properties": {
                        "configurable": {
                            "type": "object",
                            "properties": {
                                "thread_id": {
                                    "type": "string", 
                                    "description": "Unique ID for conversation memory"
                                }
                            },
                            "required": ["thread_id"]
                        }
                    }
                }
            },
            "required": ["input", "config"]
        }
    
    logger.info("LangGraph API routes added at /langserve/seomi/*")
    logger.info("Standard LangGraph pattern - native event streaming enabled")
