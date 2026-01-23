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
- GET /langserve/{agent_slug}/input_schema - Input schema for documentation
- GET /langserve/agents - List available agents
"""

import json
import logging
from typing import Any, Dict, Optional
from fastapi import FastAPI, Request, HTTPException, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.agents.registry import get_agent_registry
from app.core.database import get_checkpointer
from app.core.auth import get_current_user
from app.tools.registry import get_tool_registry
from app.tools.task import set_agent_context, clear_agent_context

logger = logging.getLogger(__name__)


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
            # #region agent log
            import json as _json
            _msg_count = len(input_data.get("messages", []))
            _last_msg = input_data.get("messages", [{}])[-1] if input_data.get("messages") else {}
            with open("/Users/sibinarendran/codes/workforce.dooza-ai/.cursor/debug.log", "a") as _f:
                _f.write(_json.dumps({"location":"langgraph_api.py:event_generator","message":"Starting stream","data":{"agent":agent_slug,"msg_count":_msg_count,"last_msg_type":_last_msg.get("type","unknown"),"last_msg_content":str(_last_msg.get("content",""))[:200],"thread_id":configurable.get("thread_id")},"timestamp":__import__("time").time()*1000,"sessionId":"debug-session","hypothesisId":"A,B"})+"\n")
            # #endregion
            
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
                        
                        # #region agent log
                        import json as _json
                        with open("/Users/sibinarendran/codes/workforce.dooza-ai/.cursor/debug.log", "a") as _f:
                            _f.write(_json.dumps({"location":"langgraph_api.py:tool_event","message":f"Tool event: {event_type}","data":{"tool_name":tool_name,"event_type":event_type,"tool_data_keys":list(tool_data.keys()) if isinstance(tool_data, dict) else str(type(tool_data))},"timestamp":__import__("time").time()*1000,"sessionId":"debug-session","hypothesisId":"A,D"})+"\n")
                        # #endregion
                        
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
                # #region agent log
                import json as _json
                import traceback as _tb
                with open("/Users/sibinarendran/codes/workforce.dooza-ai/.cursor/debug.log", "a") as _f:
                    _f.write(_json.dumps({"location":"langgraph_api.py:stream_error","message":"Stream exception caught","data":{"error_type":type(e).__name__,"error_msg":str(e),"traceback":_tb.format_exc()[:1000]},"timestamp":__import__("time").time()*1000,"sessionId":"debug-session","hypothesisId":"A,B,C,D,E"})+"\n")
                # #endregion
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
    
    logger.info("LangGraph API routes added at /langserve/{agent_slug}/*")
    logger.info(f"Available agents: {registry.list_supervisors()}")
    logger.info("Standard LangGraph pattern - native event streaming enabled")
