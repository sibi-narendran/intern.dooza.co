"""
Dooza AI Agents Module

This module provides the agent system using LangGraph's supervisor pattern.

Agent Hierarchy:
- Supervisor (user-facing): SEOmi - routes to specialists
- Specialists (hidden): seo_tech, seo_content, seo_analytics

Usage:
    from app.agents import get_seomi_app
    
    app = get_seomi_app(checkpointer=checkpointer)
    result = await app.ainvoke({"messages": [HumanMessage(content="...")]}, config)
"""

# Supervisor - Main entry point
from app.agents.seomi import (
    create_seomi_supervisor,
    get_seomi_app,
    SEOMI_CONFIG,
)

# Specialists (for direct testing/use)
from app.agents.seo_tech import create_seo_tech_agent
from app.agents.seo_content import create_seo_content_agent
from app.agents.seo_analytics import create_seo_analytics_agent

# Factory utilities
from app.agents.factory import (
    get_agent,
    get_supervisor_app,
    get_legacy_agent,
    is_supervisor_agent,
    get_agent_config,
    is_valid_agent,
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
    # Supervisor
    "create_seomi_supervisor",
    "get_seomi_app",
    "SEOMI_CONFIG",
    
    # Specialists
    "create_seo_tech_agent",
    "create_seo_content_agent",
    "create_seo_analytics_agent",
    
    # Factory
    "get_agent",
    "get_supervisor_app",
    "get_legacy_agent",
    "is_supervisor_agent",
    "get_agent_config",
    "is_valid_agent",
    
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
