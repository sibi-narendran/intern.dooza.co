"""
Agent Events

Event types emitted during agent execution for SSE streaming.
These events allow the frontend to show real-time feedback about
what the agent is doing (thinking, using tools, etc.)

Production-ready:
- Only includes actively used event types
- Safe JSON serialization
- Standard SSE format
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
    """
    if depth > 10:
        return str(obj)[:200]
    
    if obj is None:
        return None
    
    if isinstance(obj, (str, int, float, bool)):
        return obj
    
    if isinstance(obj, bytes):
        return obj.decode('utf-8', errors='replace')
    
    if isinstance(obj, (list, tuple)):
        return [_safe_serialize(item, depth + 1) for item in obj]
    
    if isinstance(obj, (set, frozenset)):
        return [_safe_serialize(item, depth + 1) for item in obj]
    
    if isinstance(obj, dict):
        return {str(k): _safe_serialize(v, depth + 1) for k, v in obj.items()}
    
    if callable(obj):
        return f"<callable:{type(obj).__name__}>"
    
    # Pydantic objects
    if hasattr(obj, 'model_dump') and callable(getattr(obj, 'model_dump')):
        try:
            return _safe_serialize(obj.model_dump(), depth + 1)
        except Exception:
            pass
    
    if hasattr(obj, 'dict') and callable(getattr(obj, 'dict')):
        try:
            return _safe_serialize(obj.dict(), depth + 1)
        except Exception:
            pass
    
    try:
        json.dumps(obj)
        return obj
    except (TypeError, ValueError):
        return f"<{type(obj).__name__}>: {str(obj)[:200]}"


class EventType(str, Enum):
    """Types of events emitted by agents."""
    
    # Streaming response tokens
    TOKEN = "token"
    
    # Tool execution
    TOOL_START = "tool_start"
    TOOL_END = "tool_end"
    TOOL_DATA = "tool_data"
    
    # Completion
    END = "end"
    ERROR = "error"
    
    # Metadata
    THREAD_ID = "thread_id"


@dataclass
class AgentEvent:
    """
    Events emitted during agent execution for SSE streaming.
    
    Used for:
    - Streaming text tokens
    - Tool usage indicators
    - Errors and completion
    """
    
    type: EventType
    
    # Token streaming
    content: Optional[str] = None
    
    # Tool execution
    tool_name: Optional[str] = None
    tool_args: Optional[Dict[str, Any]] = None
    tool_result: Any = None
    
    # Status/metadata
    thread_id: Optional[str] = None
    
    # Error
    error: Optional[str] = None
    
    # Additional data
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary, excluding None values."""
        type_str = self.type.value if isinstance(self.type, EventType) else str(self.type)
        result: Dict[str, Any] = {"type": type_str}
        
        if self.content is not None:
            result["content"] = str(self.content)
        if self.tool_name is not None:
            result["tool"] = str(self.tool_name)
        if self.tool_args is not None:
            result["args"] = _safe_serialize(self.tool_args)
        if self.tool_result is not None:
            result["result"] = _safe_serialize(self.tool_result)
        if self.thread_id is not None:
            result["thread_id"] = str(self.thread_id)
        if self.error is not None:
            result["error"] = str(self.error)
        if self.metadata:
            result["metadata"] = _safe_serialize(self.metadata)
        
        return result
    
    def to_sse(self) -> str:
        """Convert to SSE format string."""
        try:
            data = self.to_dict()
            return f"data: {json.dumps(data)}\n\n"
        except TypeError as e:
            logger.error(f"JSON serialization error: {e}")
            safe_data = {
                "type": self.type.value if isinstance(self.type, EventType) else str(self.type),
                "error": f"Serialization error: {str(e)}"
            }
            return f"data: {json.dumps(safe_data)}\n\n"
    
    # Factory methods for common events
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
    def tool_data(
        cls, 
        tool_name: str, 
        data: Dict[str, Any],
        tool_category: Optional[str] = None
    ) -> "AgentEvent":
        """Create event with full structured tool data for frontend rendering."""
        return cls(
            type=EventType.TOOL_DATA,
            tool_name=tool_name,
            tool_result=data,
            metadata={"category": tool_category} if tool_category else {}
        )
    
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


# SSE constants
SSE_DONE = "data: [DONE]\n\n"


def event_stream_headers() -> Dict[str, str]:
    """Get headers for SSE streaming response."""
    return {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no",
    }
