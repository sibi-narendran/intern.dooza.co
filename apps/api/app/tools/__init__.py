"""
Dooza AI Tools Module

Provides tool implementations for agents:
- Task tools: Create workspace tasks for user review
- Social tools: Publishing to social platforms
- Server-Driven UI schemas for frontend rendering

Note: Delegation is handled by langgraph-supervisor, not custom tools.
"""

from app.tools.base import (
    DoozaTool,
    ToolMetadata,
    ToolUISchema,
    UIDisplayType,
    UISection,
    FieldMapping,
    create_tool,
)
from app.tools.registry import ToolRegistry, get_tool_registry, reset_tool_registry
from app.tools.task import (
    create_task,
    get_task_types,
    TASK_TOOLS,
    AgentContext,
    set_agent_context,
    clear_agent_context,
    get_agent_context,
)
from app.tools.composio_social import (
    get_social_publish_tools,
    get_connection_tools,
    get_user_social_connections,
    publish_to_instagram,
    publish_to_facebook,
    publish_to_linkedin,
    publish_to_tiktok,
    publish_to_youtube,
    publish_task,
)

__all__ = [
    # Base tool classes
    "DoozaTool",
    "ToolMetadata",
    "create_tool",
    # UI Schema types (Server-Driven UI)
    "ToolUISchema",
    "UIDisplayType",
    "UISection",
    "FieldMapping",
    # Registry
    "ToolRegistry",
    "get_tool_registry",
    "reset_tool_registry",
    # Tool factories
    "get_social_publish_tools",
    "get_connection_tools",
    # Task tools
    "create_task",
    "get_task_types",
    "TASK_TOOLS",
    # Social publish tools
    "get_user_social_connections",
    "publish_to_instagram",
    "publish_to_facebook",
    "publish_to_linkedin",
    "publish_to_tiktok",
    "publish_to_youtube",
    "publish_task",
    # Agent context
    "AgentContext",
    "set_agent_context",
    "clear_agent_context",
    "get_agent_context",
]
