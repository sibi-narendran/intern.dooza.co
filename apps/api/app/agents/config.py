"""
Agent Configuration

Dataclass for agent configuration including:
- Identity (slug, name, role)
- Permissions (tool categories, delegations)
- UI settings (avatar, gradient)
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class AgentConfig:
    """
    Configuration for a Dooza agent.
    
    This configuration is used to:
    - Define the agent's identity and system prompt
    - Control which tools the agent can use
    - Specify which other agents it can delegate to
    - Configure UI appearance
    
    Attributes:
        slug: Unique identifier (e.g., 'soshie', 'penn')
        name: Display name (e.g., 'Seomi', 'Penn')
        role: Short role description (e.g., 'SEO Expert')
        description: Longer description of capabilities
        system_prompt: The system message that defines agent behavior
        
        tool_categories: List of tool categories agent can use
        allowed_integrations: List of Composio integrations allowed
        can_delegate_to: List of agent slugs this agent can delegate to
        
        owner_type: Who created this agent ('dooza', 'org', 'user')
        owner_id: ID of owner (org_id or user_id, None for dooza)
        
        avatar_url: URL to agent's avatar image
        gradient: CSS gradient for UI backgrounds
        custom_ui_config: Optional custom UI configuration
        
        min_tier: Minimum user tier required to use this agent
        is_published: Whether agent is visible in gallery
        is_featured: Whether agent is featured
        
        uses_tools: Whether agent uses the new DoozaAgent system with tools
        is_specialist: Whether agent is a hidden specialist (not user-facing)
    """
    
    # Identity
    slug: str
    name: str
    role: str
    description: str
    system_prompt: str
    
    # Tool & Integration permissions
    tool_categories: List[str] = field(default_factory=list)
    allowed_integrations: List[str] = field(default_factory=list)
    can_delegate_to: List[str] = field(default_factory=list)
    
    # Ownership
    owner_type: str = "dooza"  # 'dooza', 'org', 'user'
    owner_id: Optional[str] = None
    
    # UI Configuration
    avatar_url: Optional[str] = None
    gradient: Optional[str] = None
    custom_ui_config: Optional[Dict[str, Any]] = None
    
    # Access Control
    min_tier: str = "free"  # 'free', 'pro', 'enterprise'
    is_published: bool = True
    is_featured: bool = False
    
    # Agent type flags
    uses_tools: bool = False  # Uses the new DoozaAgent system with tools
    is_specialist: bool = False  # Hidden specialist agent (not user-facing)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "slug": self.slug,
            "name": self.name,
            "role": self.role,
            "description": self.description,
            "system_prompt": self.system_prompt,
            "tool_categories": self.tool_categories,
            "allowed_integrations": self.allowed_integrations,
            "can_delegate_to": self.can_delegate_to,
            "owner_type": self.owner_type,
            "owner_id": self.owner_id,
            "avatar_url": self.avatar_url,
            "gradient": self.gradient,
            "custom_ui_config": self.custom_ui_config,
            "min_tier": self.min_tier,
            "is_published": self.is_published,
            "is_featured": self.is_featured,
            "uses_tools": self.uses_tools,
            "is_specialist": self.is_specialist,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AgentConfig":
        """Create from dictionary."""
        return cls(
            slug=data["slug"],
            name=data["name"],
            role=data.get("role", ""),
            description=data.get("description", ""),
            system_prompt=data.get("system_prompt", ""),
            tool_categories=data.get("tool_categories", []),
            allowed_integrations=data.get("allowed_integrations", []),
            can_delegate_to=data.get("can_delegate_to", []),
            owner_type=data.get("owner_type", "dooza"),
            owner_id=data.get("owner_id"),
            avatar_url=data.get("avatar_url"),
            gradient=data.get("gradient"),
            custom_ui_config=data.get("custom_ui_config"),
            min_tier=data.get("min_tier", "free"),
            is_published=data.get("is_published", True),
            is_featured=data.get("is_featured", False),
            uses_tools=data.get("uses_tools", False),
            is_specialist=data.get("is_specialist", False),
        )
    
    @classmethod
    def from_db_row(cls, row: Dict[str, Any]) -> "AgentConfig":
        """
        Create from database row.
        
        Maps database column names to config attributes.
        """
        return cls(
            slug=row["slug"],
            name=row["name"],
            role=row.get("role", ""),
            description=row.get("description", ""),
            system_prompt=row.get("system_prompt", ""),
            tool_categories=row.get("tool_categories") or [],
            allowed_integrations=row.get("allowed_integrations") or [],
            can_delegate_to=row.get("can_delegate_to") or [],
            owner_type=row.get("owner_type", "dooza"),
            owner_id=row.get("owner_id"),
            avatar_url=row.get("avatar_url"),
            gradient=row.get("gradient"),
            custom_ui_config=row.get("custom_ui_config"),
            min_tier=row.get("tier", "free"),
            is_published=row.get("is_published", True),
            is_featured=row.get("is_featured", False),
            uses_tools=row.get("uses_tools", False),
            is_specialist=row.get("is_specialist", False),
        )
