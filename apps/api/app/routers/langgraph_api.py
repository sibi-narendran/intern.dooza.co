"""
LangGraph API Router

Standard LangGraph production pattern:
- Dynamic agent routing via /{agent_slug}/ path parameter
- Direct graph invocation with PostgreSQL checkpointer
- Native event streaming via astream_events()
- Full visibility into supervisor, delegation, and specialist activity

This is the recommended self-hosted pattern:
- Uses standard LangGraph APIs internally
- Custom FastAPI wrapper for HTTP handling
- No deprecated LangServe dependency
- Registry-based agent discovery (no hardcoded agent names)

Endpoints:
- POST /langserve/{agent_slug}/invoke - Synchronous invoke
- POST /langserve/{agent_slug}/stream_events - Native LangGraph event streaming
- GET /langserve/{agent_slug}/history - Get conversation history from checkpointer
- GET /langserve/{agent_slug}/threads - List user's conversation threads
- GET /langserve/{agent_slug}/input_schema - Input schema for documentation
- GET /langserve/agents - List available agents
"""

import json
import logging
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, Request, HTTPException, Header, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.agents.registry import get_agent_registry
from app.core.database import get_checkpointer, get_supabase_client
from app.core.auth import get_current_user
from app.tools.registry import get_tool_registry
from app.tools.task import set_agent_context, clear_agent_context

logger = logging.getLogger(__name__)


# =============================================================================
# MESSAGE TRANSFORMATION (LangGraph -> Frontend Format)
# =============================================================================

def _transform_langgraph_messages(messages: List[Any]) -> List[Dict[str, Any]]:
    """
    Transform LangGraph messages (HumanMessage, AIMessage, ToolMessage) to frontend format.
    
    This preserves full tool results including image_url, status, etc.
    Messages are returned in natural order (as they occurred in conversation).
    
    Args:
        messages: List of LangGraph message objects
        
    Returns:
        List of dicts in frontend-friendly format
    """
    result = []
    
    for msg in messages:
        msg_type = msg.__class__.__name__
        
        if msg_type == "HumanMessage":
            result.append({
                "id": getattr(msg, "id", None) or str(id(msg)),
                "role": "user",
                "content": _extract_content(msg.content),
                "type": "human",
            })
        
        elif msg_type == "AIMessage":
            # AIMessage may have tool_calls
            tool_calls = []
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    tool_calls.append({
                        "id": tc.get("id", ""),
                        "name": tc.get("name", ""),
                        "args": tc.get("args", {}),
                    })
            
            result.append({
                "id": getattr(msg, "id", None) or str(id(msg)),
                "role": "assistant",
                "content": _extract_content(msg.content),
                "type": "ai",
                "tool_calls": tool_calls if tool_calls else None,
            })
        
        elif msg_type == "ToolMessage":
            # ToolMessage contains the full result from tool execution
            # This is where image_url, status, etc. are stored
            content = msg.content
            
            # Try to parse JSON content
            parsed_content = content
            if isinstance(content, str):
                try:
                    parsed_content = json.loads(content)
                except (json.JSONDecodeError, ValueError):
                    pass
            
            result.append({
                "id": getattr(msg, "id", None) or str(id(msg)),
                "role": "tool",
                "content": parsed_content,
                "type": "tool",
                "tool_call_id": getattr(msg, "tool_call_id", None),
                "name": getattr(msg, "name", None),
            })
    
    return result


def _extract_content(content: Any) -> str:
    """Extract string content from various message content formats."""
    if isinstance(content, str):
        return content
    
    if isinstance(content, list):
        # Handle list content format (used by some providers)
        text_parts = []
        for part in content:
            if isinstance(part, str):
                text_parts.append(part)
            elif isinstance(part, dict) and "text" in part:
                text_parts.append(str(part["text"]) if part["text"] else "")
            elif hasattr(part, "text"):
                text_parts.append(str(part.text) if part.text else "")
        return "".join(text_parts)
    
    return str(content) if content else ""


def _get_tool_ui_schema(tool_name: str) -> Optional[Dict[str, Any]]:
    """
    Look up UI schema for a tool by name.
    
    Maps LangGraph tool names to registry slugs.
    Convention: tool names use underscores, slugs use dots after category.
    Examples:
        'seo_analyze_url' -> 'seo.analyze_url'
        'content_write_blog' -> 'content.write_blog'
        'social_post_tweet' -> 'social.post_tweet'
    
    Args:
        tool_name: The tool name from LangGraph event
        
    Returns:
        UI schema dict or None if not found
    """
    registry = get_tool_registry()
    
    # Try to convert tool_name to slug format
    # Pattern: {category}_{rest} -> {category}.{rest}
    # e.g., 'seo_analyze_url' -> 'seo.analyze_url'
    if '_' in tool_name:
        parts = tool_name.split('_', 1)
        if len(parts) == 2:
            slug = f"{parts[0]}.{parts[1]}"
            tool = registry.get_tool(slug)
            if tool:
                try:
                    return tool.get_ui_schema()
                except Exception as e:
                    logger.warning(f"Error getting UI schema for {tool_name}: {e}")
                    return None
    
    # Fallback: try direct lookup
    tool = registry.get_tool(tool_name)
    if tool:
        try:
            return tool.get_ui_schema()
        except Exception as e:
            logger.warning(f"Error getting UI schema for {tool_name}: {e}")
            return None
    
    return None


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
# GRAPH INSTANCE FACTORY (Registry-based)
# =============================================================================

def _get_agent_graph(agent_slug: str):
    """
    Get a compiled agent graph by slug.
    
    Uses AgentRegistry for lazy loading and caching.
    Each agent is compiled once with the checkpointer and reused.
    
    Args:
        agent_slug: Agent identifier (e.g., 'soshie', 'penn')
        
    Returns:
        Compiled LangGraph workflow
        
    Raises:
        HTTPException: If agent not found or not a supervisor
    """
    registry = get_agent_registry()
    
    if not registry.is_valid_agent(agent_slug):
        available = registry.list_supervisors()
        raise HTTPException(
            status_code=404,
            detail=f"Agent '{agent_slug}' not found. Available: {available}"
        )
    
    if not registry.is_supervisor(agent_slug):
        raise HTTPException(
            status_code=400,
            detail=f"Agent '{agent_slug}' does not support chat (not a supervisor)"
        )
    
    checkpointer = get_checkpointer()
    graph = registry.get_agent(agent_slug, checkpointer=checkpointer)
    
    return graph


# =============================================================================
# API ENDPOINTS
# =============================================================================

def setup_langgraph_routes(app: FastAPI):
    """
    Add LangGraph API routes to the FastAPI app.
    
    Standard LangGraph pattern:
    - Dynamic agent routing via /{agent_slug}/ path
    - Direct graph invocation with configurable thread_id
    - PostgreSQL checkpointer for conversation memory
    - Native event streaming for full visibility
    
    Adding new agents requires only:
    1. Creating the agent file (e.g., agents/penn.py)
    2. Registering in AGENT_REGISTRATIONS (agents/registry.py)
    No route changes needed.
    """
    
    # Log available agents at startup
    registry = get_agent_registry()
    available = registry.list_supervisors()
    logger.info(f"LangGraph routes ready for agents: {available}")
    
    @app.get("/langserve/agents")
    async def list_available_agents():
        """List all agents available for chat."""
        registry = get_agent_registry()
        agents = []
        for slug in registry.list_supervisors():
            reg = registry.get_registration(slug)
            agents.append({
                "slug": slug,
                "type": reg.agent_type if reg else "unknown",
                "description": reg.description if reg else "",
            })
        return {"agents": agents}
    
    @app.post("/langserve/{agent_slug}/invoke")
    async def invoke_agent(
        agent_slug: str, 
        request: InvokeRequest,
        authorization: str = Header(...),
    ) -> InvokeResponse:
        """
        Invoke an agent synchronously.
        
        Path parameters:
            agent_slug: Agent identifier (e.g., 'soshie', 'penn')
        
        Request body:
        {
            "input": {"messages": [{"type": "human", "content": "..."}]},
            "config": {"configurable": {"thread_id": "unique-thread-id"}}
        }
        """
        # Authenticate user
        user_id = await get_current_user(authorization)
        
        # Get the agent graph (validates and caches)
        graph = _get_agent_graph(agent_slug)
        
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
        
        # Set agent context for tools and nodes
        set_agent_context(
            agent_slug=agent_slug,
            user_id=user_id,
            thread_id=configurable.get("thread_id"),
        )
        
        try:
            # Standard LangGraph invocation
            result = await graph.ainvoke(
                request.input,
                config={"configurable": configurable}
            )
            return InvokeResponse(output=result)
        finally:
            # Always cleanup context
            clear_agent_context()
    
    
    @app.post("/langserve/{agent_slug}/stream_events")
    async def stream_events(agent_slug: str, request: Request):
        """
        Stream agent response via SSE with native LangGraph events.
        
        Path parameters:
            agent_slug: Agent identifier (e.g., 'soshie', 'penn')
        
        This provides full visibility into:
        - on_chat_model_stream: Token streaming from ALL agents (supervisor + specialists)
        - on_tool_start: Tool execution starting (including transfer_to_* for delegation)
        - on_tool_end: Tool execution complete with results
        - Full metadata including langgraph_node for agent identification
        
        Frontend parses native events directly - no transformation needed.
        """
        # Authenticate user from Authorization header
        auth_header = request.headers.get("Authorization", "")
        if not auth_header:
            raise HTTPException(status_code=401, detail="Authorization header required")
        user_id = await get_current_user(auth_header)
        
        # Get the agent graph (validates and caches)
        graph = _get_agent_graph(agent_slug)
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
            # Set agent context INSIDE the generator so cleanup is guaranteed
            # If we set it outside and StreamingResponse fails to initialize,
            # the context would persist and contaminate subsequent requests
            set_agent_context(
                agent_slug=agent_slug,
                user_id=user_id,
                thread_id=configurable.get("thread_id"),
            )
            
            # Track final state for structured_response event
            final_state = {}
            
            # Track ALL streamed content to detect streaming vs non-streaming models
            # This is the proper way to avoid duplicate content emission
            accumulated_streamed_content = []
            
            try:
                async for event in graph.astream_events(
                    input_data,
                    config={"configurable": configurable},
                    version="v2"
                ):
                    # Capture chain end events to get final state
                    if event.get("event") == "on_chain_end" and event.get("name") == "LangGraph":
                        output = event.get("data", {}).get("output", {})
                        if isinstance(output, dict):
                            final_state = output
                    event_type = event.get("event", "")
                    metadata = event.get("metadata", {})
                    
                    # For chat model stream events, extract the actual content
                    # With create_react_agent, streaming is from the main agent node
                    if event_type == "on_chat_model_stream":
                        chunk = event.get("data", {}).get("chunk")
                        content = getattr(chunk, "content", "") if chunk else ""
                        
                        # Handle list content format (used by some providers like Gemini)
                        if isinstance(content, list):
                            text_parts = []
                            for part in content:
                                if isinstance(part, str):
                                    text_parts.append(part)
                                elif isinstance(part, dict) and "text" in part:
                                    # Ensure string type for join()
                                    text_parts.append(str(part["text"]) if part["text"] is not None else "")
                                elif hasattr(part, "text"):
                                    # Ensure string type for join()
                                    text_parts.append(str(part.text) if part.text is not None else "")
                            content = "".join(text_parts)
                        
                        # Track streamed content to avoid duplicate emission at end
                        if content:
                            accumulated_streamed_content.append(content)
                        
                        node_name = metadata.get("langgraph_node", "")
                        
                        # Build clean event with extracted content
                        clean_event = {
                            "event": event_type,
                            "content": content,
                            "metadata": {
                                "langgraph_node": node_name,
                                "langgraph_step": metadata.get("langgraph_step", 0),
                            },
                            "name": event.get("name", ""),
                        }
                        yield f"data: {json.dumps(clean_event)}\n\n"
                    
                    # Handle on_chat_model_end for non-streaming models ONLY
                    # When streaming=True (default), content comes via on_chat_model_stream
                    # When streaming=False, LangGraph emits complete response in on_chat_model_end
                    # We ONLY emit content here if NO streaming has occurred (non-streaming model)
                    elif event_type == "on_chat_model_end":
                        # Skip if streaming already happened - content was already sent
                        if accumulated_streamed_content:
                            continue
                        
                        output = event.get("data", {}).get("output")
                        content = ""
                        
                        if output:
                            # Extract content from AIMessage object
                            content = getattr(output, "content", "")
                            # Handle list content format (used by some providers like Gemini)
                            if isinstance(content, list):
                                text_parts = []
                                for part in content:
                                    if isinstance(part, str):
                                        text_parts.append(part)
                                    elif isinstance(part, dict) and "text" in part:
                                        # Ensure string type for join()
                                        text_parts.append(str(part["text"]) if part["text"] is not None else "")
                                    elif hasattr(part, "text"):
                                        # Ensure string type for join()
                                        text_parts.append(str(part.text) if part.text is not None else "")
                                content = "".join(text_parts)
                        
                        if content:
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
                                    tool_output = json.loads(tool_output)
                                except (json.JSONDecodeError, ValueError):
                                    pass  # Keep as string if not valid JSON
                            # Truncate large string outputs
                            if isinstance(tool_output, str) and len(tool_output) > 5000:
                                tool_output = tool_output[:5000] + "..."
                            
                            # Get UI schema for this tool (Server-Driven UI)
                            ui_schema = _get_tool_ui_schema(tool_name)
                            
                            clean_event = {
                                "event": event_type,
                                "name": tool_name,
                                "output": tool_output,
                                "metadata": {
                                    "langgraph_node": metadata.get("langgraph_node", ""),
                                },
                            }
                            
                            # Include UI schema if available
                            if ui_schema:
                                clean_event["ui_schema"] = ui_schema
                                
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
                
                # Final state emission is ONLY needed for non-streaming models
                # If streaming occurred, content was already sent via on_chat_model_stream
                # This block is kept as a fallback for edge cases (non-streaming models)
                if final_state and not accumulated_streamed_content:
                    messages = final_state.get("messages", [])
                    if messages:
                        # Get the last message (the response)
                        last_msg = messages[-1] if messages else None
                        if last_msg and hasattr(last_msg, 'content'):
                            content = last_msg.content
                            # Check if it's an AIMessage with actual content
                            if content and hasattr(last_msg, '__class__') and last_msg.__class__.__name__ == 'AIMessage':
                                response_event = {
                                    "event": "on_chat_model_end",
                                    "content": content,
                                    "metadata": {
                                        "langgraph_node": "agent",  # Agent node in create_react_agent
                                        "is_final_response": True,
                                    },
                                    "name": f"{agent_slug}_response",
                                }
                                yield f"data: {json.dumps(response_event)}\n\n"
                elif accumulated_streamed_content:
                    logger.debug(f"Skipping final state emission - content was streamed ({len(accumulated_streamed_content)} chunks)")
                
                # Emit structured_response event at end of stream
                # Note: With create_react_agent, tool results are in ToolMessage objects
                # within state["messages"], not in separate state fields.
                # Frontend should use on_tool_end events for tool-specific data.
                # This event is kept for backwards compatibility and potential future use.
                structured_response = {
                    "event": "structured_response",
                    "ui_actions": [],
                    "error": final_state.get("error") if final_state else None,
                }
                yield f"data: {json.dumps(structured_response)}\n\n"
                
                yield "data: [DONE]\n\n"
                
            except Exception as e:
                logger.error(f"Stream error: {e}", exc_info=True)
                yield f"data: {json.dumps({'event': 'error', 'data': {'message': str(e)}})}\n\n"
            finally:
                # Always cleanup agent context after streaming completes
                clear_agent_context()
        
        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # Disable nginx buffering
            }
        )
    
    
    @app.get("/langserve/{agent_slug}/input_schema")
    async def input_schema(agent_slug: str):
        """Return input schema for documentation."""
        # Validate agent exists
        registry = get_agent_registry()
        if not registry.is_valid_agent(agent_slug):
            raise HTTPException(status_code=404, detail=f"Agent '{agent_slug}' not found")
        
        return {
            "title": f"{agent_slug.capitalize()} Input Schema",
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
    
    
    @app.get("/langserve/{agent_slug}/history")
    async def get_conversation_history(
        agent_slug: str,
        thread_id: str = Query(..., description="Thread ID to load history for"),
        authorization: str = Header(...),
    ):
        """
        Get conversation history from LangGraph checkpointer.
        
        This is the standard LangGraph way to retrieve conversation state.
        Returns full message history including complete tool results with image_url, etc.
        
        Path parameters:
            agent_slug: Agent identifier (e.g., 'soshie')
            
        Query parameters:
            thread_id: The conversation thread ID
            
        Returns:
            messages: List of messages in frontend-friendly format
            thread_id: The thread ID
        """
        # Authenticate user
        user_id = await get_current_user(authorization)
        
        # Get the agent graph
        graph = _get_agent_graph(agent_slug)
        
        # Get state from checkpointer
        config = {"configurable": {"thread_id": thread_id, "checkpoint_ns": ""}}
        
        try:
            state = await graph.aget_state(config)
            
            if not state or not state.values:
                return {"messages": [], "thread_id": thread_id}
            
            # Get messages from state
            messages = state.values.get("messages", [])
            
            # Transform to frontend format
            transformed = _transform_langgraph_messages(messages)
            
            return {
                "messages": transformed,
                "thread_id": thread_id,
            }
            
        except Exception as e:
            logger.error(f"Failed to get conversation history: {e}", exc_info=True)
            # Return empty on error (thread might not exist yet)
            return {"messages": [], "thread_id": thread_id}
    
    
    @app.get("/langserve/{agent_slug}/threads")
    async def list_user_threads(
        agent_slug: str,
        limit: int = Query(20, ge=1, le=100),
        offset: int = Query(0, ge=0),
        authorization: str = Header(...),
    ):
        """
        List user's conversation threads for an agent.
        
        Uses a lightweight user_threads tracking table to map user -> thread ownership.
        Then fetches preview info from LangGraph checkpointer.
        
        Path parameters:
            agent_slug: Agent identifier (e.g., 'soshie')
            
        Query parameters:
            limit: Max threads to return (default 20)
            offset: Pagination offset
            
        Returns:
            threads: List of thread summaries
            total: Total count
            has_more: Whether there are more threads
        """
        # Authenticate user
        user_id = await get_current_user(authorization)
        
        # Query user_threads table for this user + agent
        supabase = get_supabase_client()
        if not supabase:
            raise HTTPException(
                status_code=503,
                detail="Database not available"
            )
        
        try:
            # Query threads owned by this user for this agent
            result = supabase.table("user_threads").select(
                "thread_id, agent_slug, title, created_at, updated_at",
                count="exact"
            ).eq("user_id", user_id).eq("agent_slug", agent_slug).order(
                "updated_at", desc=True
            ).range(offset, offset + limit - 1).execute()
            
            threads = []
            for row in (result.data or []):
                threads.append({
                    "thread_id": row["thread_id"],
                    "agent_slug": row["agent_slug"],
                    "title": row.get("title", "New conversation"),
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                })
            
            total = result.count or len(threads)
            has_more = offset + len(threads) < total
            
            return {
                "threads": threads,
                "total": total,
                "has_more": has_more,
            }
            
        except Exception as e:
            logger.error(f"Failed to list threads: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail="Failed to list conversations"
            )
    
    
    @app.post("/langserve/{agent_slug}/threads")
    async def register_thread(
        agent_slug: str,
        request: Request,
    ):
        """
        Register a new thread for user tracking.
        
        Called by frontend when starting a new conversation.
        This creates the user -> thread ownership mapping.
        
        Request body:
            thread_id: The thread ID
            title: Optional title (defaults to first message)
        """
        # Authenticate user from Authorization header (same pattern as stream_events)
        auth_header = request.headers.get("Authorization", "")
        if not auth_header:
            raise HTTPException(status_code=401, detail="Authorization header required")
        user_id = await get_current_user(auth_header)
        
        body = await request.json()
        thread_id = body.get("thread_id")
        title = body.get("title", "New conversation")
        
        if not thread_id:
            raise HTTPException(status_code=400, detail="thread_id is required")
        
        supabase = get_supabase_client()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database not available")
        
        try:
            # Upsert thread record
            result = supabase.table("user_threads").upsert({
                "thread_id": thread_id,
                "user_id": user_id,
                "agent_slug": agent_slug,
                "title": title[:200] if title else "New conversation",
            }, on_conflict="thread_id").execute()
            
            return {"success": True, "thread_id": thread_id}
            
        except Exception as e:
            logger.error(f"Failed to register thread: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to register thread")
    
    
    @app.patch("/langserve/{agent_slug}/threads/{thread_id}")
    async def update_thread(
        agent_slug: str,
        thread_id: str,
        request: Request,
    ):
        """Update thread metadata (title, etc.)."""
        # Authenticate user from Authorization header
        auth_header = request.headers.get("Authorization", "")
        if not auth_header:
            raise HTTPException(status_code=401, detail="Authorization header required")
        user_id = await get_current_user(auth_header)
        body = await request.json()
        
        supabase = get_supabase_client()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database not available")
        
        try:
            updates = {}
            if "title" in body:
                updates["title"] = body["title"][:200]
            
            if updates:
                supabase.table("user_threads").update(updates).eq(
                    "thread_id", thread_id
                ).eq("user_id", user_id).execute()
            
            return {"success": True}
            
        except Exception as e:
            logger.error(f"Failed to update thread: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to update thread")
    
    
    @app.delete("/langserve/{agent_slug}/threads/{thread_id}")
    async def delete_thread(
        agent_slug: str,
        thread_id: str,
        request: Request,
    ):
        """Delete a thread (removes user tracking, checkpointer data remains)."""
        # Authenticate user from Authorization header
        auth_header = request.headers.get("Authorization", "")
        if not auth_header:
            raise HTTPException(status_code=401, detail="Authorization header required")
        user_id = await get_current_user(auth_header)
        
        supabase = get_supabase_client()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database not available")
        
        try:
            supabase.table("user_threads").delete().eq(
                "thread_id", thread_id
            ).eq("user_id", user_id).execute()
            
            return {"success": True}
            
        except Exception as e:
            logger.error(f"Failed to delete thread: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to delete thread")
    
    
    logger.info("LangGraph API routes added at /langserve/{agent_slug}/*")
    logger.info(f"Available agents: {registry.list_supervisors()}")
    logger.info("Standard LangGraph pattern - native event streaming enabled")
