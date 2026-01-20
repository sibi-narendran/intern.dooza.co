"""
Tool Registry

Central registry for all tools in the Dooza platform.
Tools are registered by category and can be retrieved based on
agent permissions and user context.

Production-ready with:
- Thread-safe singleton implementation
- Permission-based filtering
- Graceful error handling
"""

from __future__ import annotations
import logging
import threading
from typing import Dict, List, Optional, TYPE_CHECKING

from app.tools.base import DoozaTool, ToolMetadata

if TYPE_CHECKING:
    from app.agents.config import AgentConfig
    from app.context.types import AgentContext

logger = logging.getLogger(__name__)

# Singleton instance with thread lock for safety
_registry_instance: Optional["ToolRegistry"] = None
_registry_lock = threading.Lock()


class ToolRegistry:
    """
    Central registry for all tools across agents.
    
    Tools are organized by category and can be retrieved based on:
    - Agent's allowed tool categories
    - User's tier and permissions
    - Available integrations
    
    Usage:
        registry = get_tool_registry()
        registry.register(my_tool)
        tools = registry.get_tools_for_agent(agent_config, context)
    """
    
    def __init__(self):
        # Tools organized by category: {'seo': {'analyze_url': <tool>}}
        self._tools: Dict[str, Dict[str, DoozaTool]] = {}
        self._initialized = False
        self._lock = threading.Lock()  # Lock for tool modifications
    
    def _get_tool_metadata(self, tool: DoozaTool) -> Optional[ToolMetadata]:
        """
        Safely get metadata from a tool.
        
        Uses the tool's _get_metadata() method for consistency.
        """
        if hasattr(tool, '_get_metadata'):
            return tool._get_metadata()
        # Fallback to class attribute
        return getattr(tool.__class__, 'tool_metadata', None)
    
    def register(self, tool: DoozaTool) -> None:
        """
        Register a tool under its category.
        
        Thread-safe.
        
        Args:
            tool: The tool to register
            
        Raises:
            ValueError: If tool has no metadata or invalid slug
        """
        metadata = self._get_tool_metadata(tool)
        if not metadata:
            raise ValueError(f"Tool {tool.name} has no metadata")
        
        category = metadata.category
        # Extract tool name from slug (e.g., 'seo.analyze_url' -> 'analyze_url')
        tool_name = metadata.slug.split(".", 1)[-1]
        
        with self._lock:
            if category not in self._tools:
                self._tools[category] = {}
            
            if tool_name in self._tools[category]:
                logger.warning(f"Overwriting existing tool: {metadata.slug}")
            
            self._tools[category][tool_name] = tool
        
        logger.debug(f"Registered tool: {metadata.slug}")
    
    def register_many(self, tools: List[DoozaTool]) -> None:
        """Register multiple tools at once."""
        for tool in tools:
            try:
                self.register(tool)
            except ValueError as e:
                logger.warning(f"Skipping tool registration: {e}")
    
    def get_tool(self, slug: str) -> Optional[DoozaTool]:
        """
        Get a specific tool by its slug.
        
        Args:
            slug: Tool slug in format 'category.tool_name'
            
        Returns:
            The tool or None if not found
        """
        if "." not in slug:
            logger.warning(f"Invalid tool slug format: {slug}")
            return None
        
        category, tool_name = slug.split(".", 1)
        with self._lock:
            return self._tools.get(category, {}).get(tool_name)
    
    def get_tools_by_category(self, category: str) -> List[DoozaTool]:
        """
        Get all tools in a category.
        
        Args:
            category: The category name (e.g., 'seo')
            
        Returns:
            List of tools in that category
        """
        with self._lock:
            return list(self._tools.get(category, {}).values())
    
    def get_tools_for_agent(
        self,
        agent_config: "AgentConfig",
        context: "AgentContext",
    ) -> List[DoozaTool]:
        """
        Get all tools an agent can use in the current context.
        
        Filters based on:
        1. Agent's allowed tool categories
        2. User's tier (free/pro/enterprise)
        3. Available integrations
        
        Note: Delegation is now handled by langgraph-supervisor,
        not via a custom delegation tool.
        
        Args:
            agent_config: The agent's configuration
            context: Current user/org context
            
        Returns:
            List of tools the agent can use
        """
        tools = []
        
        with self._lock:
            for category in agent_config.tool_categories:
                if category not in self._tools:
                    logger.debug(f"Category '{category}' not found in registry")
                    continue
                
                for tool in self._tools[category].values():
                    allowed, error = tool.check_permissions(context)
                    if allowed:
                        tools.append(tool)
                    else:
                        logger.debug(f"Tool {tool.slug} not allowed: {error}")
        
        return tools
    
    def get_all_categories(self) -> List[str]:
        """Get list of all registered categories."""
        with self._lock:
            return list(self._tools.keys())
    
    def get_all_tools(self) -> List[DoozaTool]:
        """Get all registered tools."""
        with self._lock:
            tools = []
            for category_tools in self._tools.values():
                tools.extend(category_tools.values())
            return tools
    
    def clear(self) -> None:
        """Clear all registered tools. Useful for testing."""
        with self._lock:
            self._tools.clear()
            self._initialized = False
    
    def initialize(self) -> None:
        """
        Initialize the registry with default tools.
        
        This is called automatically on first access.
        Thread-safe - only initializes once.
        """
        if self._initialized:
            return
        
        with self._lock:
            # Double-check after acquiring lock
            if self._initialized:
                return
            
            logger.info("Initializing tool registry...")
            
            # Import and register SEO tools
            try:
                from app.tools.seo import get_seo_tools
                seo_tools = get_seo_tools()
                for tool in seo_tools:
                    try:
                        self._register_internal(tool)
                    except ValueError as e:
                        logger.warning(f"Skipping SEO tool: {e}")
                logger.info(f"Registered {len(seo_tools)} SEO tools")
            except ImportError as e:
                logger.warning(f"Could not load SEO tools: {e}")
            
            # Import and register Social tools
            try:
                from app.tools.social import get_social_tools
                social_tools = get_social_tools()
                for tool in social_tools:
                    try:
                        self._register_internal(tool)
                    except ValueError as e:
                        logger.warning(f"Skipping social tool: {e}")
                logger.info(f"Registered {len(social_tools)} social tools")
            except ImportError as e:
                logger.warning(f"Could not load social tools: {e}")
            
            # Import and register Image tools (when ready)
            try:
                from app.tools.image import get_image_tools
                image_tools = get_image_tools()
                for tool in image_tools:
                    try:
                        self._register_internal(tool)
                    except ValueError as e:
                        logger.warning(f"Skipping image tool: {e}")
                if image_tools:
                    logger.info(f"Registered {len(image_tools)} image tools")
            except ImportError as e:
                logger.warning(f"Could not load image tools: {e}")
            
            # Future: Register other tool categories
            # from app.tools.content import get_content_tools
            
            self._initialized = True
            tool_count = sum(len(cat) for cat in self._tools.values())
            logger.info(f"Tool registry initialized with {tool_count} tools")
    
    def _register_internal(self, tool: DoozaTool) -> None:
        """
        Internal registration method - assumes lock is already held.
        """
        metadata = self._get_tool_metadata(tool)
        if not metadata:
            raise ValueError(f"Tool {tool.name} has no metadata")
        
        category = metadata.category
        tool_name = metadata.slug.split(".", 1)[-1]
        
        if category not in self._tools:
            self._tools[category] = {}
        
        self._tools[category][tool_name] = tool


def get_tool_registry() -> ToolRegistry:
    """
    Get the singleton tool registry instance.
    
    The registry is initialized with default tools on first access.
    Thread-safe implementation using double-checked locking.
    
    Returns:
        The global ToolRegistry instance
    """
    global _registry_instance
    
    if _registry_instance is None:
        with _registry_lock:
            # Double-check after acquiring lock
            if _registry_instance is None:
                _registry_instance = ToolRegistry()
                _registry_instance.initialize()
    
    return _registry_instance


def reset_tool_registry() -> None:
    """
    Reset the tool registry. Useful for testing.
    
    Thread-safe implementation.
    """
    global _registry_instance
    with _registry_lock:
        if _registry_instance:
            _registry_instance.clear()
        _registry_instance = None
