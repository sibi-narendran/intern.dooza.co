"""
Dooza AI Tools Module

Provides tool implementations for agents:
- SEO tools: URL analysis, meta tags, headings, images, keywords
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
from app.tools.seo import get_seo_tools

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
    "get_seo_tools",
]
