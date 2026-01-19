"""
Tool Base Classes

Provides the foundation for all Dooza tools with:
- Metadata for categorization and permissions
- Permission checking based on user context
- Integration with LangChain tool system
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Callable, ClassVar, Optional, Tuple, TYPE_CHECKING

from langchain_core.tools import BaseTool

if TYPE_CHECKING:
    from app.context.types import AgentContext


@dataclass
class ToolMetadata:
    """
    Metadata for tool registration and access control.
    
    Attributes:
        slug: Unique identifier in format 'category.tool_name' (e.g., 'seo.analyze_url')
        category: Tool category for grouping (e.g., 'seo', 'content')
        name: Human-readable name
        description: What the tool does
        requires_integration: Composio integration required (e.g., 'google_analytics') or None
        min_tier: Minimum user tier required ('free', 'pro', 'enterprise')
    """
    slug: str
    category: str
    name: str
    description: str
    requires_integration: Optional[str] = None
    min_tier: str = "free"
    
    def __post_init__(self):
        # Validate slug format
        if "." not in self.slug:
            raise ValueError(f"Tool slug must be in format 'category.name', got: {self.slug}")
        
        # Ensure category matches slug prefix
        slug_category = self.slug.split(".")[0]
        if slug_category != self.category:
            raise ValueError(
                f"Tool slug category '{slug_category}' doesn't match category '{self.category}'"
            )


class DoozaTool(BaseTool):
    """
    Base class for all Dooza tools.
    
    Extends LangChain's BaseTool with:
    - Metadata for categorization
    - Permission checking
    - Standardized error handling
    
    Subclasses should:
    1. Define `tool_metadata` class variable (no type annotation to avoid Pydantic treating it as a field)
    2. Set `name` and `description`
    3. Implement `_run()` method
    4. Optionally implement `_arun()` for async
    
    Example:
        class MyTool(DoozaTool):
            tool_metadata = ToolMetadata(slug="cat.name", category="cat", ...)
            name: str = "cat.name"
            description: str = "..."
    """
    
    def _get_metadata(self) -> Optional[ToolMetadata]:
        """Get tool metadata from class variable."""
        return getattr(self.__class__, 'tool_metadata', None)
    
    def check_permissions(self, context: "AgentContext") -> Tuple[bool, Optional[str]]:
        """
        Check if tool can be used in current context.
        
        Args:
            context: The agent context with user/org info
            
        Returns:
            Tuple of (allowed: bool, error_message: str | None)
        """
        metadata = self._get_metadata()
        if not metadata:
            return True, None
        
        # Check tier
        if not context.user_tier_allows(metadata.min_tier):
            return False, f"Tool '{metadata.name}' requires {metadata.min_tier} tier"
        
        # Check integration requirement
        if metadata.requires_integration:
            if metadata.requires_integration not in context.integrations:
                return False, (
                    f"Tool '{metadata.name}' requires "
                    f"{metadata.requires_integration} integration"
                )
        
        return True, None
    
    @property
    def category(self) -> str:
        """Get tool category from metadata."""
        metadata = self._get_metadata()
        return metadata.category if metadata else "unknown"
    
    @property
    def slug(self) -> str:
        """Get tool slug from metadata."""
        metadata = self._get_metadata()
        return metadata.slug if metadata else self.name


def create_tool(
    slug: str,
    category: str,
    tool_name: str,
    description: str,
    func: Callable,
    requires_integration: Optional[str] = None,
    min_tier: str = "free",
    args_schema: Any = None,
) -> DoozaTool:
    """
    Factory function to create a DoozaTool from a function.
    
    This is a convenience function for creating tools without subclassing.
    
    Args:
        slug: Unique identifier (e.g., 'seo.analyze_url')
        category: Tool category
        tool_name: Human-readable name
        description: What the tool does
        func: The function to execute
        requires_integration: Composio integration required or None
        min_tier: Minimum user tier
        args_schema: Pydantic model for arguments (optional)
    
    Returns:
        A configured DoozaTool instance
    """
    metadata = ToolMetadata(
        slug=slug,
        category=category,
        name=tool_name,
        description=description,
        requires_integration=requires_integration,
        min_tier=min_tier,
    )
    
    class FunctionTool(DoozaTool):
        tool_metadata: ClassVar[ToolMetadata] = metadata
        name: str = slug
        description: str = description
        
        def _run(self, *args, **kwargs) -> Any:
            return func(*args, **kwargs)
        
        async def _arun(self, *args, **kwargs) -> Any:
            # If func is async, await it; otherwise just call it
            import asyncio
            if asyncio.iscoroutinefunction(func):
                return await func(*args, **kwargs)
            return func(*args, **kwargs)
    
    # Set args_schema if provided
    if args_schema:
        FunctionTool.args_schema = args_schema
    
    return FunctionTool(name=slug, description=description)
