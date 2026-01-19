"""
Context Module

Provides context management for agent requests including:
- User information (id, name, tier)
- Organization information
- Available integrations
- Permission checking
"""

from app.context.types import AgentContext
from app.context.loader import ContextLoader, get_context_loader

__all__ = [
    "AgentContext",
    "ContextLoader",
    "get_context_loader",
]
