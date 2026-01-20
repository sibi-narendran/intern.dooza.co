"""
Tool Base Classes

Provides the foundation for all Dooza tools with:
- Metadata for categorization and permissions
- Permission checking based on user context
- Integration with LangChain tool system
- Server-Driven UI schemas for frontend rendering
"""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, ClassVar, Dict, List, Optional, Tuple, TYPE_CHECKING

from langchain_core.tools import BaseTool

if TYPE_CHECKING:
    from app.context.types import AgentContext


# =============================================================================
# UI SCHEMA TYPES
# =============================================================================

class UIDisplayType(str, Enum):
    """
    Display types for tool result rendering.
    
    The frontend has a generic renderer for each type.
    Tools declare which display type best fits their output.
    """
    SCORE_CARD = "score_card"      # Circular gauge with score + summary
    DATA_TABLE = "data_table"      # Rows and columns for tabular data
    KEY_VALUE = "key_value"        # Label: value pairs for structured data
    ISSUES_LIST = "issues_list"    # Prioritized list of issues/warnings
    RAW = "raw"                    # Formatted JSON fallback


@dataclass
class FieldMapping:
    """
    Maps a JSON path in tool output to a display field.
    
    Attributes:
        path: Dot-notation path to value (e.g., 'meta_tags.title')
        label: Human-readable label for display
        format: Optional format hint ('url', 'percent', 'number', 'date')
    """
    path: str
    label: str
    format: Optional[str] = None


@dataclass
class UISection:
    """
    A section within the tool result UI (for tabbed layouts).
    
    Attributes:
        id: Unique section identifier
        label: Tab/section label
        icon: Lucide icon name (optional)
        display: Display type for this section
        fields: Fields to show in this section
        score_field: JSON path to score (for score_card sections)
    """
    id: str
    label: str
    display: UIDisplayType
    icon: Optional[str] = None
    fields: List[FieldMapping] = field(default_factory=list)
    score_field: Optional[str] = None


@dataclass
class ToolUISchema:
    """
    Server-Driven UI schema for tool result rendering.
    
    This schema travels with tool results to the frontend,
    enabling automatic rich UI without hardcoded components.
    
    Attributes:
        display: Primary display type
        title: Card/section title
        summary_template: Template string for summary (e.g., "Score: {overall_score}/100")
        score_field: JSON path to primary score (for score_card)
        fields: Field mappings for simple layouts
        sections: Section definitions for tabbed layouts
        expandable: Whether result should be collapsible (default True)
    
    Example:
        ToolUISchema(
            display=UIDisplayType.SCORE_CARD,
            title="SEO Analysis",
            summary_template="Score: {overall_score}/100 • {issues_count} issues",
            score_field="overall_score",
            fields=[
                FieldMapping("meta_tags.title", "Title"),
                FieldMapping("meta_tags.score", "Meta Score", "percent"),
            ]
        )
    """
    display: UIDisplayType
    title: str
    summary_template: Optional[str] = None
    score_field: Optional[str] = None
    fields: List[FieldMapping] = field(default_factory=list)
    sections: List[UISection] = field(default_factory=list)
    expandable: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result: Dict[str, Any] = {
            "display": self.display.value,
            "title": self.title,
            "expandable": self.expandable,
        }
        
        if self.summary_template:
            result["summary_template"] = self.summary_template
        if self.score_field:
            result["score_field"] = self.score_field
        if self.fields:
            result["fields"] = [
                {"path": f.path, "label": f.label, "format": f.format}
                for f in self.fields
            ]
        if self.sections:
            result["sections"] = [
                {
                    "id": s.id,
                    "label": s.label,
                    "display": s.display.value,
                    "icon": s.icon,
                    "fields": [{"path": f.path, "label": f.label, "format": f.format} for f in s.fields],
                    "score_field": s.score_field,
                }
                for s in self.sections
            ]
        
        return result


# =============================================================================
# TOOL METADATA
# =============================================================================

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
        ui_schema: Server-Driven UI schema for frontend rendering (optional)
    """
    slug: str
    category: str
    name: str
    description: str
    requires_integration: Optional[str] = None
    min_tier: str = "free"
    ui_schema: Optional[ToolUISchema] = None
    
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
    
    def get_ui_schema_dict(self) -> Optional[Dict[str, Any]]:
        """Get UI schema as dictionary for JSON serialization."""
        return self.ui_schema.to_dict() if self.ui_schema else None


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
    
    def get_ui_schema(self) -> Optional[Dict[str, Any]]:
        """
        Get UI schema dictionary for frontend rendering.
        
        Returns:
            UI schema dict or None if not defined
        """
        metadata = self._get_metadata()
        return metadata.get_ui_schema_dict() if metadata else None


def create_tool(
    slug: str,
    category: str,
    tool_name: str,
    description: str,
    func: Callable,
    requires_integration: Optional[str] = None,
    min_tier: str = "free",
    args_schema: Any = None,
    ui_schema: Optional[ToolUISchema] = None,
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
        ui_schema: Server-Driven UI schema for frontend rendering (optional)
    
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
        ui_schema=ui_schema,
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
