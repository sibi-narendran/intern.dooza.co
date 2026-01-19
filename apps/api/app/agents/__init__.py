"""
Dooza AI Agents Module

This module provides the agent system including:
- DoozaAgent base class for building agents
- AgentConfig for agent configuration
- AgentEvent types for SSE streaming
- Individual agent implementations (seomi, penn, etc.)
"""

from app.agents.base import DoozaAgent, get_llm, create_base_agent, get_agent_prompt
from app.agents.config import AgentConfig
from app.agents.events import AgentEvent, EventType, event_stream_headers, SSE_DONE

__all__ = [
    # Core classes
    "DoozaAgent",
    "AgentConfig",
    "AgentEvent",
    "EventType",
    
    # Utilities
    "get_llm",
    "event_stream_headers",
    "SSE_DONE",
    
    # Legacy (backwards compatibility)
    "create_base_agent",
    "get_agent_prompt",
]
