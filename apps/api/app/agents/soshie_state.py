"""
Soshie Conversation State

Typed state for the Soshie StateGraph. This state persists across
the conversation and enables:
- Connection checking once per conversation (not repeated)
- Structured UI actions for frontend rendering
- Proper specialist routing

This follows standard LangGraph patterns and is 100% compatible
with LangGraph Server for future migration.
"""

from __future__ import annotations

from typing import TypedDict, Optional, Annotated, List, Sequence

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


# =============================================================================
# UI ACTION TYPES
# =============================================================================

class ConnectionPromptAction(TypedDict):
    """UI action to prompt user to connect a platform."""
    type: str  # "connection_prompt"
    platforms: List[str]
    message: str


class TaskCreatedAction(TypedDict):
    """UI action when a task is created in workspace."""
    type: str  # "task_created"
    task_id: str
    title: str
    platform: str


class PublishResultAction(TypedDict):
    """UI action for publish results."""
    type: str  # "publish_result"
    platform: str
    success: bool
    post_url: Optional[str]
    error: Optional[str]


# Union type for all UI actions
UIAction = ConnectionPromptAction | TaskCreatedAction | PublishResultAction


# =============================================================================
# CONNECTION STATE
# =============================================================================

class ConnectionState(TypedDict):
    """User's social platform connection status."""
    connected: List[str]      # ["linkedin", "instagram"]
    disconnected: List[str]   # ["tiktok", "youtube", "facebook"]


# =============================================================================
# SOSHIE CONVERSATION STATE
# =============================================================================

class SoshieState(TypedDict):
    """
    Main state for the Soshie conversation graph.
    
    This state flows through all nodes and enables:
    - One-time connection checking (connections_checked flag)
    - Structured UI actions for frontend (ui_actions list)
    - Proper message handling with add_messages reducer
    
    Compatible with LangGraph checkpointer for persistence.
    """
    # Core message flow - uses add_messages reducer for proper handling
    messages: Annotated[Sequence[BaseMessage], add_messages]
    
    # User context (set at conversation start)
    user_id: str
    agent_slug: str
    
    # Connection state - checked ONCE per conversation
    connections: Optional[ConnectionState]
    connections_checked: bool
    
    # Structured UI actions for frontend rendering
    # Frontend renders these directly instead of reconstructing from text
    ui_actions: List[dict]
    
    # Current specialist handling the request
    current_specialist: Optional[str]
    
    # Workflow result from specialists (content_workflow, etc.)
    workflow_result: Optional[dict]
    
    # Error handling
    error: Optional[str]


# =============================================================================
# STATE FACTORY
# =============================================================================

def create_initial_state(user_id: str, agent_slug: str = "soshie") -> dict:
    """
    Create initial state for a new Soshie conversation.
    
    Args:
        user_id: The user's ID
        agent_slug: Agent identifier (default: "soshie")
        
    Returns:
        Initial state dict ready for graph invocation
    """
    return {
        "messages": [],
        "user_id": user_id,
        "agent_slug": agent_slug,
        "connections": None,
        "connections_checked": False,
        "ui_actions": [],
        "current_specialist": None,
        "workflow_result": None,
        "error": None,
    }


# =============================================================================
# UI ACTION HELPERS
# =============================================================================

def create_connection_prompt_action(
    platforms: List[str],
    message: str = "Connect your accounts to start publishing"
) -> dict:
    """Create a connection prompt UI action."""
    return {
        "type": "connection_prompt",
        "platforms": platforms,
        "message": message,
    }


def create_task_created_action(
    task_id: str,
    title: str,
    platform: str
) -> dict:
    """Create a task created UI action."""
    return {
        "type": "task_created",
        "task_id": task_id,
        "title": title,
        "platform": platform,
    }


def create_publish_result_action(
    platform: str,
    success: bool,
    post_url: Optional[str] = None,
    error: Optional[str] = None
) -> dict:
    """Create a publish result UI action."""
    return {
        "type": "publish_result",
        "platform": platform,
        "success": success,
        "post_url": post_url,
        "error": error,
    }
