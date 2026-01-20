"""
Agent Registry

Central registry for all supervisor agents in the Dooza platform.
Provides lazy loading, caching, and discovery for LangGraph agents.

Production-ready with:
- Thread-safe singleton implementation
- Lazy loading (agents compiled on first use)
- Per-checkpointer caching (different checkpointers = different instances)
- Graceful error handling

Pattern mirrors ToolRegistry for consistency.
"""

from __future__ import annotations
import importlib
import logging
import threading
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from langgraph.checkpoint.base import BaseCheckpointSaver

logger = logging.getLogger(__name__)

# Singleton instance with thread lock
_registry_instance: Optional["AgentRegistry"] = None
_registry_lock = threading.Lock()


# =============================================================================
# AGENT REGISTRATION CONFIG
# =============================================================================

@dataclass(frozen=True)
class AgentRegistration:
    """
    Configuration for a registered agent.
    
    Attributes:
        slug: Unique identifier (e.g., 'seomi', 'penn')
        module_path: Python module path (e.g., 'app.agents.seomi')
        factory_func: Name of function that creates the agent (e.g., 'get_seomi_app')
        agent_type: Type of agent ('supervisor', 'specialist', 'legacy')
        description: Human-readable description for logging/debugging
    """
    slug: str
    module_path: str
    factory_func: str
    agent_type: str = "supervisor"
    description: str = ""


# =============================================================================
# AGENT REGISTRY DEFINITIONS
# =============================================================================
# Add new agents here. This is the ONLY place to register agents.
# The registry handles lazy loading, caching, and validation.

AGENT_REGISTRATIONS: Dict[str, AgentRegistration] = {
    "seomi": AgentRegistration(
        slug="seomi",
        module_path="app.agents.seomi",
        factory_func="get_seomi_app",
        agent_type="supervisor",
        description="SEO Lead - supervises seo_tech, seo_content, seo_analytics",
    ),
    # Future agents: just add entries here
    # "penn": AgentRegistration(
    #     slug="penn",
    #     module_path="app.agents.penn",
    #     factory_func="get_penn_app",
    #     agent_type="supervisor",
    #     description="Content Writer - creates blog posts, social content",
    # ),
}


# =============================================================================
# AGENT REGISTRY CLASS
# =============================================================================

class AgentRegistry:
    """
    Central registry for all LangGraph supervisor agents.
    
    Thread-safe singleton that provides:
    - Agent discovery (list available agents)
    - Lazy loading (agents compiled on first request)
    - Checkpointer-aware caching (different checkpointers = different instances)
    - Validation (check if agent exists before routing)
    
    Usage:
        registry = get_agent_registry()
        graph = registry.get_agent("seomi", checkpointer=checkpointer)
    """
    
    def __init__(self):
        # Cache: {(slug, checkpointer_id): compiled_graph}
        self._cache: Dict[str, Any] = {}
        self._cache_lock = threading.Lock()
        self._factory_cache: Dict[str, Callable] = {}  # Cached factory functions
    
    def _get_factory(self, registration: AgentRegistration) -> Callable:
        """
        Get the factory function for an agent, caching the import.
        
        Args:
            registration: Agent registration config
            
        Returns:
            Factory function that creates the agent
            
        Raises:
            ImportError: If module or function not found
        """
        cache_key = f"{registration.module_path}.{registration.factory_func}"
        
        if cache_key in self._factory_cache:
            return self._factory_cache[cache_key]
        
        try:
            module = importlib.import_module(registration.module_path)
            factory = getattr(module, registration.factory_func)
            self._factory_cache[cache_key] = factory
            logger.debug(f"Loaded factory for agent '{registration.slug}'")
            return factory
        except ImportError as e:
            logger.error(f"Failed to import module '{registration.module_path}': {e}")
            raise
        except AttributeError as e:
            logger.error(
                f"Function '{registration.factory_func}' not found in "
                f"'{registration.module_path}': {e}"
            )
            raise ImportError(
                f"Factory function '{registration.factory_func}' not found"
            ) from e
    
    def get_agent(
        self, 
        slug: str, 
        checkpointer: Optional["BaseCheckpointSaver"] = None
    ) -> Any:
        """
        Get or create a compiled agent graph by slug.
        
        Lazy loads the agent on first request. Caches per checkpointer
        to allow different checkpointers for different use cases.
        
        Args:
            slug: Agent identifier (e.g., 'seomi')
            checkpointer: Optional LangGraph checkpointer for memory
            
        Returns:
            Compiled LangGraph workflow
            
        Raises:
            ValueError: If agent slug not registered
            ImportError: If agent module/function not found
        """
        if slug not in AGENT_REGISTRATIONS:
            available = list(AGENT_REGISTRATIONS.keys())
            raise ValueError(
                f"Agent '{slug}' not registered. Available: {available}"
            )
        
        # Cache key includes checkpointer identity
        cache_key = f"{slug}:{id(checkpointer)}"
        
        # Fast path: check cache without lock
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        # Slow path: acquire lock and create
        with self._cache_lock:
            # Double-check after acquiring lock
            if cache_key in self._cache:
                return self._cache[cache_key]
            
            registration = AGENT_REGISTRATIONS[slug]
            factory = self._get_factory(registration)
            
            logger.info(f"Creating agent '{slug}' ({registration.agent_type})")
            
            # Call factory with checkpointer
            graph = factory(checkpointer=checkpointer)
            
            self._cache[cache_key] = graph
            logger.info(f"Agent '{slug}' created and cached")
            
            return graph
    
    def is_valid_agent(self, slug: str) -> bool:
        """Check if an agent slug is registered."""
        return slug in AGENT_REGISTRATIONS
    
    def is_supervisor(self, slug: str) -> bool:
        """Check if an agent is a supervisor type."""
        registration = AGENT_REGISTRATIONS.get(slug)
        return registration is not None and registration.agent_type == "supervisor"
    
    def get_registration(self, slug: str) -> Optional[AgentRegistration]:
        """Get registration config for an agent."""
        return AGENT_REGISTRATIONS.get(slug)
    
    def list_agents(self, agent_type: Optional[str] = None) -> list[str]:
        """
        List all registered agent slugs.
        
        Args:
            agent_type: Optional filter by type ('supervisor', 'specialist', 'legacy')
            
        Returns:
            List of agent slugs
        """
        if agent_type is None:
            return list(AGENT_REGISTRATIONS.keys())
        
        return [
            slug for slug, reg in AGENT_REGISTRATIONS.items()
            if reg.agent_type == agent_type
        ]
    
    def list_supervisors(self) -> list[str]:
        """List all supervisor agent slugs (convenience method)."""
        return self.list_agents(agent_type="supervisor")
    
    def clear_cache(self) -> None:
        """Clear all cached agent instances. Useful for testing."""
        with self._cache_lock:
            self._cache.clear()
            self._factory_cache.clear()
        logger.info("Agent cache cleared")


# =============================================================================
# SINGLETON ACCESSOR
# =============================================================================

def get_agent_registry() -> AgentRegistry:
    """
    Get the singleton agent registry instance.
    
    Thread-safe implementation using double-checked locking.
    
    Returns:
        The global AgentRegistry instance
    """
    global _registry_instance
    
    if _registry_instance is None:
        with _registry_lock:
            # Double-check after acquiring lock
            if _registry_instance is None:
                _registry_instance = AgentRegistry()
                logger.info(
                    f"Agent registry initialized with "
                    f"{len(AGENT_REGISTRATIONS)} agents: "
                    f"{list(AGENT_REGISTRATIONS.keys())}"
                )
    
    return _registry_instance


def reset_agent_registry() -> None:
    """
    Reset the agent registry. Useful for testing.
    
    Thread-safe implementation.
    """
    global _registry_instance
    with _registry_lock:
        if _registry_instance:
            _registry_instance.clear_cache()
        _registry_instance = None
    logger.info("Agent registry reset")
