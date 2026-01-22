"""
Dooza AI Agents Module

This module provides AI agents using LangGraph patterns:

Agents:
- Soshie: Tool-calling agent using create_react_agent with create_social_content tool

Usage:
    from app.agents import get_soshie_app
    
    app = get_soshie_app(checkpointer=checkpointer)
    result = await app.ainvoke({"messages": [HumanMessage(content="...")]}, config)
"""

# Soshie Agent (standard tool-calling pattern with create_react_agent)
from app.agents.soshie import (
    create_soshie_agent,
    get_soshie_app,
    SOSHIE_SYSTEM_PROMPT,
)

# Content Evaluator (uses ContentFeedback from schemas/content_workflow.py)
from app.agents.content_evaluator import (
    ContentFeedback,
    evaluate_content,
    quick_evaluate,
    PLATFORM_CRITERIA,
)

# Content Workflow (preferred for content creation)
from app.workflows.content_workflow import (
    create_content_workflow,
    create_content_workflow_agent,
    run_content_workflow,
)

# Factory utilities
from app.agents.factory import (
    get_agent,
    get_supervisor_app,
    get_legacy_agent,
    is_supervisor_agent,
    get_agent_config,
    is_valid_agent,
)

# Agent Registry (singleton pattern)
from app.agents.registry import (
    AgentRegistry,
    AgentRegistration,
    get_agent_registry,
    reset_agent_registry,
    AGENT_REGISTRATIONS,
)

# Events (for SSE streaming)
from app.agents.events import (
    AgentEvent,
    EventType,
    event_stream_headers,
    SSE_DONE,
)

# Config
from app.agents.config import AgentConfig

# Base utilities
from app.agents.base import get_llm, create_base_agent


__all__ = [
    # Soshie Agent (standard tool-calling pattern)
    "create_soshie_agent",
    "get_soshie_app",
    "SOSHIE_SYSTEM_PROMPT",
    
    # Content Evaluator
    "ContentFeedback",
    "evaluate_content",
    "quick_evaluate",
    "PLATFORM_CRITERIA",
    
    # Content Workflow (preferred for content creation)
    "create_content_workflow",
    "create_content_workflow_agent",
    "run_content_workflow",
    
    # Factory
    "get_agent",
    "get_supervisor_app",
    "get_legacy_agent",
    "is_supervisor_agent",
    "get_agent_config",
    "is_valid_agent",
    
    # Registry
    "AgentRegistry",
    "AgentRegistration",
    "get_agent_registry",
    "reset_agent_registry",
    "AGENT_REGISTRATIONS",
    
    # Events
    "AgentEvent",
    "EventType",
    "event_stream_headers",
    "SSE_DONE",
    
    # Config
    "AgentConfig",
    
    # Base
    "get_llm",
    "create_base_agent",
]
