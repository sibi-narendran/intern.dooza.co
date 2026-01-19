"""
Agent Events

Event types emitted during agent execution for SSE streaming.
These events allow the frontend to show real-time feedback about
what the agent is doing (thinking, using tools, delegating, etc.)
"""

from __future__ import annotations
import json
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, Optional
from enum import Enum

logger = logging.getLogger(__name__)


def _safe_serialize(obj: Any, depth: int = 0) -> Any:
    """
    Safely convert an object to a JSON-serializable form.
    
    Handles common non-serializable types like methods, classes, etc.
    
    Args:
        obj: Object to serialize
        depth: Current recursion depth (to prevent infinite loops)
    """
    # Prevent infinite recursion
    if depth > 10:
        return str(obj)[:200]
    
    if obj is None:
        return None
    
    # Already serializable primitives
    if isinstance(obj, (str, int, float, bool)):
        return obj
    
    # Bytes
    if isinstance(obj, bytes):
        return obj.decode('utf-8', errors='replace')
    
    # Lists - recursively serialize elements
    if isinstance(obj, (list, tuple)):
        return [_safe_serialize(item, depth + 1) for item in obj]
    
    # Sets
    if isinstance(obj, (set, frozenset)):
        return [_safe_serialize(item, depth + 1) for item in obj]
    
    # Dicts - recursively serialize values
    if isinstance(obj, dict):
        return {str(k): _safe_serialize(v, depth + 1) for k, v in obj.items()}
    
    # Check if it's a method or function first
    if callable(obj):
        return f"<callable:{type(obj).__name__}>"
    
    # Check for common LangChain/Pydantic objects
    if hasattr(obj, 'dict') and callable(getattr(obj, 'dict')):
        try:
            return _safe_serialize(obj.dict(), depth + 1)
        except Exception:
            pass
    
    if hasattr(obj, 'model_dump') and callable(getattr(obj, 'model_dump')):
        try:
            return _safe_serialize(obj.model_dump(), depth + 1)
        except Exception:
            pass
    
    # Try to convert to string as fallback
    try:
        # Try json dumps to see if it's serializable
        json.dumps(obj)
        return obj
    except (TypeError, ValueError):
        # Convert to string representation
        return f"<{type(obj).__name__}>: {str(obj)[:200]}"


class EventType(str, Enum):
    """Types of events emitted by agents."""
    
    # Streaming response tokens
    TOKEN = "token"
    
    # Tool execution
    TOOL_START = "tool_start"
    TOOL_END = "tool_end"
    
    # Agent delegation
    DELEGATE = "delegate"
    AGENT_SWITCH = "agent_switch"
    
    # Status updates
    THINKING = "thinking"
    STATUS = "status"
    
    # Completion
    END = "end"
    ERROR = "error"
    
    # Metadata
    THREAD_ID = "thread_id"
    METADATA = "metadata"


@dataclass
class AgentEvent:
    """
    Events emitted during agent execution.
    
    Used for SSE streaming to the frontend, allowing real-time
    display of:
    - Streaming text tokens
    - Tool usage indicators
    - Agent delegation status
    - Errors and completion
    
    Attributes:
        type: The event type (token, tool_start, etc.)
        content: Text content for token events
        tool_name: Name of tool for tool events
        tool_args: Arguments passed to tool
        tool_result: Result from tool execution
        to_agent: Target agent for delegation
        from_agent: Source agent for delegation
        error: Error message for error events
        metadata: Additional event-specific data
    """
    
    type: EventType
    
    # Token streaming
    content: Optional[str] = None
    
    # Tool execution
    tool_name: Optional[str] = None
    tool_args: Optional[Dict[str, Any]] = None
    tool_result: Any = None
    
    # Delegation
    to_agent: Optional[str] = None
    from_agent: Optional[str] = None
    task: Optional[str] = None
    
    # Status/metadata
    status: Optional[str] = None
    thread_id: Optional[str] = None
    
    # Error
    error: Optional[str] = None
    
    # Additional data
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary, excluding None values. Ensures JSON serializable."""
        # Always convert type to string to ensure serializability
        if isinstance(self.type, EventType):
            type_str = self.type.value
        elif hasattr(self.type, 'value'):
            type_str = self.type.value
        else:
            type_str = str(self.type)
        
        result: Dict[str, Any] = {"type": type_str}
        
        # Add non-None fields - use _safe_serialize for potentially complex objects
        if self.content is not None:
            result["content"] = str(self.content) if not isinstance(self.content, str) else self.content
        if self.tool_name is not None:
            result["tool"] = str(self.tool_name)
        if self.tool_args is not None:
            result["args"] = _safe_serialize(self.tool_args)
        if self.tool_result is not None:
            result["result"] = _safe_serialize(self.tool_result)
        if self.to_agent is not None:
            result["to_agent"] = str(self.to_agent)
        if self.from_agent is not None:
            result["from_agent"] = str(self.from_agent)
        if self.task is not None:
            result["task"] = str(self.task)
        if self.status is not None:
            result["status"] = str(self.status)
        if self.thread_id is not None:
            result["thread_id"] = str(self.thread_id)
        if self.error is not None:
            result["error"] = str(self.error)
        if self.metadata:
            result["metadata"] = _safe_serialize(self.metadata)
        
        return result
    
    def to_sse(self) -> str:
        """
        Convert to SSE format string.
        
        Returns:
            String in format: "data: {json}\n\n"
        """
        try:
            data = self.to_dict()
            return f"data: {json.dumps(data)}\n\n"
        except TypeError as e:
            # Log the problematic data for debugging
            logger.error(f"JSON serialization error: {e}")
            logger.error(f"Event type: {self.type}, tool_result type: {type(self.tool_result)}")
            # Return a safe fallback
            safe_data = {
                "type": self.type.value if isinstance(self.type, EventType) else str(self.type),
                "error": f"Serialization error: {str(e)}"
            }
            return f"data: {json.dumps(safe_data)}\n\n"
    
    @classmethod
    def token(cls, content: str) -> "AgentEvent":
        """Create a token event for streaming text."""
        return cls(type=EventType.TOKEN, content=content)
    
    @classmethod
    def tool_start(cls, tool_name: str, args: Optional[Dict] = None) -> "AgentEvent":
        """Create event for tool execution starting."""
        return cls(type=EventType.TOOL_START, tool_name=tool_name, tool_args=args)
    
    @classmethod
    def tool_end(cls, tool_name: str, result: Any = None) -> "AgentEvent":
        """Create event for tool execution completing."""
        return cls(type=EventType.TOOL_END, tool_name=tool_name, tool_result=result)
    
    @classmethod
    def delegate(cls, to_agent: str, task: str, from_agent: Optional[str] = None) -> "AgentEvent":
        """Create event for delegating to another agent."""
        return cls(
            type=EventType.DELEGATE, 
            to_agent=to_agent, 
            task=task,
            from_agent=from_agent
        )
    
    @classmethod
    def agent_switch(cls, to_agent: str, from_agent: Optional[str] = None) -> "AgentEvent":
        """Create event when switching to a different agent."""
        return cls(
            type=EventType.AGENT_SWITCH, 
            to_agent=to_agent,
            from_agent=from_agent
        )
    
    @classmethod
    def thinking(cls, status: str = "Thinking...") -> "AgentEvent":
        """Create event for agent thinking status."""
        return cls(type=EventType.THINKING, status=status)
    
    @classmethod
    def status_update(cls, status: str) -> "AgentEvent":
        """Create a general status update event."""
        return cls(type=EventType.STATUS, status=status)
    
    @classmethod
    def end(cls) -> "AgentEvent":
        """Create event for agent completion."""
        return cls(type=EventType.END)
    
    @classmethod
    def create_error(cls, message: str) -> "AgentEvent":
        """Create an error event."""
        return cls(type=EventType.ERROR, error=message)
    
    @classmethod
    def with_thread_id(cls, thread_id: str) -> "AgentEvent":
        """Create event containing thread ID."""
        return cls(type=EventType.THREAD_ID, thread_id=thread_id)
    
    @classmethod
    def with_metadata(cls, **kwargs) -> "AgentEvent":
        """Create event with custom metadata."""
        return cls(type=EventType.METADATA, metadata=kwargs)


# Convenience constants for SSE
SSE_DONE = "data: [DONE]\n\n"


def event_stream_headers() -> Dict[str, str]:
    """Get headers for SSE streaming response."""
    return {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no",  # Disable nginx buffering
    }
