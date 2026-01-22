"""
Soshie - Social Media Lead Orchestrator Agent

Uses LangGraph's StateGraph for explicit state management and routing.
This is the standard LangGraph pattern that enables:
- One-time connection checking (not repeated per turn)
- Structured UI actions for frontend
- Clear specialist routing

Specialists:
- social_research: Quick research (hashtags, timing, ideas)
- social_publisher: Publishing to social platforms
- social_design: Visual content (coming soon)

Workflows:
- content_workflow: Full content creation pipeline
"""

from __future__ import annotations

import logging
from typing import Literal, Any, Optional

from langchain_core.messages import BaseMessage, AIMessage, HumanMessage, SystemMessage
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.prebuilt import create_react_agent

from app.agents.base import get_llm
from app.agents.soshie_state import (
    SoshieState,
    create_initial_state,
    create_connection_prompt_action,
)
from app.services.connection_service import get_connection_service, SOCIAL_PLATFORMS
from app.tools.task import get_agent_context

logger = logging.getLogger(__name__)


# =============================================================================
# SYSTEM PROMPT (Simplified - no duplicate connection instructions)
# =============================================================================

SOSHIE_SYSTEM_PROMPT = """You are Soshie, the Social Media Lead at Dooza.

## Your Role
You are the user-facing social media expert. Users talk to you for all social media needs.
You have a team of specialists at your disposal.

## Your Team

### 1. **content_workflow** - Full Content Creation Pipeline
   - Creates content with parallel research (hashtags, timing, ideas)
   - Evaluates and refines content quality
   - Creates workspace TASK for user approval
   - **USE FOR**: "Write a LinkedIn post", "Create content for Instagram"

### 2. **social_research** - Quick Research Specialist
   - For QUICK questions without content creation
   - **USE FOR**: "What hashtags for fitness?", "When should I post?"

### 3. **social_publisher** - Publishing Specialist
   - Publishes APPROVED tasks from workspace
   - **USE FOR**: "Publish my approved post", "Post to LinkedIn now"

### 4. **social_design** - Visual Content Specialist
   - Coming soon: image generation
   - **USE FOR**: "Create an image", "Design a thumbnail"

## Routing Rules

| User Request | Route To |
|--------------|----------|
| "Write/Create/Draft content" | content_workflow |
| "What hashtags?", "Best time to post?" | social_research |
| "Publish", "Post to [platform]" | social_publisher |
| "Create image", "Design" | social_design |

## Platform Knowledge
- LinkedIn: Professional, 150-300 words
- Instagram: Visual-first, strong hashtags
- Twitter/X: Concise, max 280 chars
- TikTok: Trendy, entertaining
- YouTube: Educational, high production
- Facebook: Community-focused

## Important
- Use content_workflow for ALL content creation
- NEVER publish without user approval
- Connection status is available in context - don't re-check
"""


# =============================================================================
# GRAPH NODES
# =============================================================================

async def check_connections_node(state: SoshieState) -> dict:
    """
    Check user's social platform connections ONCE per conversation.
    
    This node runs at the start and sets connection state that persists.
    Prevents the duplicate "you don't have connections" messages.
    
    Uses AgentContext for user_id (same pattern as tools in this codebase).
    """
    # Skip if already checked
    if state.get("connections_checked"):
        return {}
    
    # Get user_id from AgentContext (set by API before invocation)
    # This is the standard pattern in this codebase - tools also use it
    ctx = get_agent_context()
    user_id = ctx.user_id if ctx else state.get("user_id")
    
    if not user_id:
        logger.warning("No user_id in AgentContext or state, skipping connection check")
        return {"connections_checked": True}
    
    try:
        connection_service = get_connection_service()
        all_connections = await connection_service.get_user_connections(user_id)
        
        connected = [c.platform for c in all_connections if c.status == "active"]
        disconnected = [p for p in SOCIAL_PLATFORMS if p not in connected]
        
        logger.info(f"User {user_id} connections: {connected}")
        
        return {
            "connections": {
                "connected": connected,
                "disconnected": disconnected,
            },
            "connections_checked": True,
        }
    except Exception as e:
        logger.error(f"Failed to check connections: {e}")
        return {
            "connections": {"connected": [], "disconnected": SOCIAL_PLATFORMS},
            "connections_checked": True,
            "error": str(e),
        }


async def route_node(state: SoshieState) -> dict:
    """
    Main routing node - LLM decides which specialist to use.
    
    Connection state is injected into context so LLM doesn't need to call tools.
    """
    from app.agents.base import get_llm  # Lazy import to avoid circular
    
    messages = state.get("messages", [])
    connections = state.get("connections") or {}
    
    # Build context with connection state
    connection_context = ""
    if connections:
        connected = connections.get("connected", [])
        disconnected = connections.get("disconnected", [])
        if connected:
            connection_context = f"\n\nUser has connected: {', '.join(connected)}."
        else:
            connection_context = f"\n\nUser has NO social platforms connected yet. Available to connect: {', '.join(disconnected)}."
    
    # Build routing prompt
    routing_prompt = f"""{SOSHIE_SYSTEM_PROMPT}

## Current Connection Status
{connection_context}

Based on the user's message, decide how to respond:
1. If user wants to CREATE content → route to content_workflow
2. If user wants QUICK research → route to social_research  
3. If user wants to PUBLISH → route to social_publisher
4. If user wants an IMAGE → route to social_design
5. Otherwise → respond directly as Soshie

Respond with ONLY the routing decision as one of:
- ROUTE:content_workflow
- ROUTE:social_research
- ROUTE:social_publisher
- ROUTE:social_design
- RESPOND:[your response]
"""
    
    llm = get_llm(streaming=False)
    
    # Get just the last user message for routing
    last_message = None
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage):
            last_message = msg.content
            break
    
    if not last_message:
        return {"current_specialist": None}
    
    try:
        response = await llm.ainvoke([
            SystemMessage(content=routing_prompt),
            HumanMessage(content=last_message),
        ])
        
        decision = response.content.strip()
        logger.info(f"Routing decision: {decision}")
        
        # Parse routing decision with validation
        if decision.startswith("ROUTE:"):
            specialist = decision.replace("ROUTE:", "").strip()
            # Validate specialist is one of the known specialists
            valid_specialists = {"content_workflow", "social_research", "social_publisher", "social_design"}
            if specialist in valid_specialists:
                return {"current_specialist": specialist}
            else:
                # Unknown specialist - log warning and respond directly
                logger.warning(f"Unknown specialist '{specialist}' in routing decision, responding directly")
                return {
                    "current_specialist": None,
                    "messages": [AIMessage(content=f"I'll help you with that directly. {decision}")],
                }
        elif decision.startswith("RESPOND:"):
            # Direct response from Soshie
            response_text = decision.replace("RESPOND:", "").strip()
            return {
                "current_specialist": None,
                "messages": [AIMessage(content=response_text)],
            }
        else:
            # Fallback: treat as direct response
            # This handles cases where LLM doesn't follow format exactly
            logger.debug(f"Routing decision doesn't match expected format, treating as direct response")
            return {
                "current_specialist": None,
                "messages": [AIMessage(content=decision)],
            }
            
    except Exception as e:
        logger.error(f"Routing failed: {e}")
        return {
            "current_specialist": None,
            "error": str(e),
        }


async def content_workflow_node(state: SoshieState) -> dict:
    """
    Invoke the content creation workflow.
    """
    from app.workflows.content_workflow import create_content_workflow
    
    messages = state.get("messages", [])
    
    # Get user context from AgentContext (consistent with rest of codebase)
    ctx = get_agent_context()
    user_id = ctx.user_id if ctx else state.get("user_id", "")
    agent_slug = ctx.agent_slug if ctx else state.get("agent_slug", "soshie")
    
    # Get last user message
    last_message = ""
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage):
            last_message = msg.content
            break
    
    try:
        workflow = create_content_workflow()
        
        # Invoke workflow with extracted request
        result = await workflow.ainvoke({
            "request": last_message,
            "platform": "linkedin",  # Default, workflow will detect
            "content_type": "post",
            "user_id": user_id,
            "agent_slug": agent_slug,
            "messages": [],
            "iteration_count": 0,
        })
        
        # Extract result and create UI action if task was created
        ui_actions = list(state.get("ui_actions", []))
        workflow_result = {}
        
        if result.get("task_id"):
            workflow_result = {
                "task_id": result["task_id"],
                "final_content": result.get("final_content"),
            }
            ui_actions.append({
                "type": "task_created",
                "task_id": result["task_id"],
                "title": result.get("final_content", {}).get("title", "New Content"),
                "platform": result.get("platform", "linkedin"),
            })
        
        # Build response message
        final_content = result.get("final_content", {})
        response_parts = ["Here's your content! ✨\n"]
        
        if final_content.get("content"):
            response_parts.append(f"**Content:**\n{final_content['content']}\n")
        
        if final_content.get("hashtags"):
            response_parts.append(f"**Hashtags:** {' '.join(final_content['hashtags'])}\n")
        
        if result.get("task_id"):
            response_parts.append("\n📋 I've saved this to your Workspace for review.")
            response_parts.append("Once approved, I can publish it for you!")
        
        return {
            "messages": [AIMessage(content="\n".join(response_parts))],
            "workflow_result": workflow_result,
            "ui_actions": ui_actions,
            "current_specialist": None,
        }
        
    except Exception as e:
        logger.error(f"Content workflow failed: {e}")
        return {
            "messages": [AIMessage(content=f"Sorry, I encountered an error creating content: {str(e)}")],
            "current_specialist": None,
            "error": str(e),
        }


async def social_research_node(state: SoshieState) -> dict:
    """
    Invoke the social research specialist.
    """
    from app.agents.social_research import create_social_research_agent
    
    messages = state.get("messages", [])
    input_count = len(messages)
    
    try:
        agent = create_social_research_agent()
        result = await agent.ainvoke({"messages": messages})
        
        # Extract ONLY NEW messages (avoid duplicating input messages)
        # add_messages reducer handles deduplication, but this is cleaner
        result_messages = result.get("messages", [])
        new_messages = result_messages[input_count:] if len(result_messages) > input_count else result_messages
        
        return {
            "messages": new_messages,
            "current_specialist": None,
        }
        
    except Exception as e:
        logger.error(f"Social research failed: {e}")
        return {
            "messages": [AIMessage(content=f"Sorry, I encountered an error with research: {str(e)}")],
            "current_specialist": None,
            "error": str(e),
        }


async def social_publisher_node(state: SoshieState) -> dict:
    """
    Invoke the social publisher specialist.
    
    Injects connection state so publisher doesn't need to re-check.
    """
    from app.agents.social_publisher import create_social_publisher_agent
    
    messages = state.get("messages", [])
    # Use `or {}` to handle both missing key AND explicit None value
    # state.get("connections", {}) only applies default if key is missing,
    # not if key exists with value None
    connections = state.get("connections") or {}
    ui_actions = list(state.get("ui_actions") or [])
    
    # Check if user has any connections
    connected = connections.get("connected", [])
    disconnected = connections.get("disconnected", [])
    
    if not connected:
        # No connections - create UI action and respond
        ui_actions.append(create_connection_prompt_action(
            platforms=disconnected,
            message="Connect your accounts to start publishing"
        ))
        
        return {
            "messages": [AIMessage(content="To publish content, you'll need to connect at least one social media account. Click the connect button below to get started!")],
            "ui_actions": ui_actions,
            "current_specialist": None,
        }
    
    try:
        # Add connection context to messages for the publisher
        connection_context = SystemMessage(
            content=f"User has these platforms connected: {', '.join(connected)}. "
                    f"Not connected: {', '.join(disconnected)}. "
                    "Do NOT tell user to check connections - this is already known."
        )
        
        augmented_messages = [connection_context] + list(messages)
        input_count = len(augmented_messages)
        
        agent = create_social_publisher_agent()
        result = await agent.ainvoke({"messages": augmented_messages})
        
        # Extract ONLY NEW messages (avoid duplicating input messages)
        result_messages = result.get("messages", [])
        new_messages = result_messages[input_count:] if len(result_messages) > input_count else result_messages
        
        return {
            "messages": new_messages,
            "ui_actions": ui_actions,
            "current_specialist": None,
        }
        
    except Exception as e:
        logger.error(f"Social publisher failed: {e}")
        return {
            "messages": [AIMessage(content=f"Sorry, I encountered an error publishing: {str(e)}")],
            "ui_actions": ui_actions,
            "current_specialist": None,
            "error": str(e),
        }


async def social_design_node(state: SoshieState) -> dict:
    """
    Invoke the social design specialist.
    """
    from app.agents.social_design import create_social_design_agent
    
    messages = state.get("messages", [])
    input_count = len(messages)
    
    try:
        agent = create_social_design_agent()
        result = await agent.ainvoke({"messages": messages})
        
        # Extract ONLY NEW messages (avoid duplicating input messages)
        result_messages = result.get("messages", [])
        new_messages = result_messages[input_count:] if len(result_messages) > input_count else result_messages
        
        return {
            "messages": new_messages,
            "current_specialist": None,
        }
        
    except Exception as e:
        logger.error(f"Social design failed: {e}")
        return {
            "messages": [AIMessage(content=f"Sorry, I encountered an error with design: {str(e)}")],
            "current_specialist": None,
            "error": str(e),
        }


# =============================================================================
# ROUTING LOGIC
# =============================================================================

def route_to_specialist(state: SoshieState) -> str:
    """
    Conditional edge: route to the appropriate specialist based on state.
    """
    specialist = state.get("current_specialist")
    
    if specialist == "content_workflow":
        return "content_workflow"
    elif specialist == "social_research":
        return "social_research"
    elif specialist == "social_publisher":
        return "social_publisher"
    elif specialist == "social_design":
        return "social_design"
    else:
        # No specialist needed, end the graph
        return END


# =============================================================================
# GRAPH FACTORY
# =============================================================================

def create_soshie_graph(
    checkpointer: Optional[BaseCheckpointSaver] = None,
) -> Any:
    """
    Create the Soshie StateGraph with explicit state management.
    
    This is the standard LangGraph pattern that:
    - Checks connections once at conversation start
    - Routes to specialists based on user intent
    - Accumulates UI actions for frontend
    - Is 100% compatible with LangGraph Server
    
    Args:
        checkpointer: Optional checkpointer for persistence
        
    Returns:
        Compiled StateGraph
    """
    # Create the graph
    workflow = StateGraph(SoshieState)
    
    # Add nodes
    workflow.add_node("check_connections", check_connections_node)
    workflow.add_node("route", route_node)
    workflow.add_node("content_workflow", content_workflow_node)
    workflow.add_node("social_research", social_research_node)
    workflow.add_node("social_publisher", social_publisher_node)
    workflow.add_node("social_design", social_design_node)
    
    # Set entry point using modern LangGraph API
    workflow.add_edge(START, "check_connections")
    
    # Add edges
    workflow.add_edge("check_connections", "route")
    
    # Conditional routing from route node
    workflow.add_conditional_edges(
        "route",
        route_to_specialist,
        {
            "content_workflow": "content_workflow",
            "social_research": "social_research",
            "social_publisher": "social_publisher",
            "social_design": "social_design",
            END: END,
        }
    )
    
    # All specialists return to END
    workflow.add_edge("content_workflow", END)
    workflow.add_edge("social_research", END)
    workflow.add_edge("social_publisher", END)
    workflow.add_edge("social_design", END)
    
    # Compile with optional checkpointer
    if checkpointer:
        return workflow.compile(checkpointer=checkpointer)
    else:
        return workflow.compile()


# =============================================================================
# CONVENIENCE EXPORTS (Backward compatible)
# =============================================================================

def create_soshie_supervisor(
    model: Any | None = None,
    checkpointer: BaseCheckpointSaver | None = None,
) -> Any:
    """
    Create the Soshie agent.
    
    Note: This now uses StateGraph instead of create_supervisor.
    The model parameter is ignored (LLM is created internally).
    
    Args:
        model: Ignored (kept for API compatibility)
        checkpointer: Optional checkpointer for persistence
        
    Returns:
        Compiled StateGraph
    """
    return create_soshie_graph(checkpointer=checkpointer)


def get_soshie_app(checkpointer: BaseCheckpointSaver | None = None):
    """
    Get a compiled Soshie app ready for invocation.
    
    Args:
        checkpointer: Optional checkpointer for persistence
        
    Returns:
        Compiled StateGraph
    """
    return create_soshie_graph(checkpointer=checkpointer)


# Config for metadata
SOSHIE_CONFIG = {
    "slug": "soshie",
    "name": "Soshie",
    "title": "Social Media Manager",
    "description": "Your AI social media lead - creates content, manages presence, and builds engagement.",
    "domain": "social",
    "avatar_gradient": "from-pink-500 to-rose-600",
    "avatar_icon": "Share2",
}
