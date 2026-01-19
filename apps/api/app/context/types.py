"""
Context Types

Dataclasses for agent context - the information passed to agents
about the current user, organization, and available resources.

Production-ready with:
- Immutable tier ordering
- Type-safe tier checking
- Serialization support
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict, FrozenSet, List, Optional


# Tier ordering for permission checks (immutable)
TIER_ORDER: Dict[str, int] = {
    "free": 0,
    "pro": 1,
    "enterprise": 2,
}

# Valid tiers (for validation)
VALID_TIERS: FrozenSet[str] = frozenset(TIER_ORDER.keys())


@dataclass
class AgentContext:
    """
    Context passed to agents for every request.
    
    Contains everything the agent needs to know about:
    - Who is making the request
    - What organization they belong to
    - What integrations are available
    - What permissions they have
    
    This context is loaded at the start of each request and passed
    through the entire agent execution.
    
    Attributes:
        user_id: Unique user identifier (required)
        user_name: Display name for the user
        user_email: User's email address
        user_tier: Subscription tier ('free', 'pro', 'enterprise')
        org_id: Organization ID if user belongs to one
        org_name: Organization name
        integrations: List of connected integration keys
        is_org_admin: Whether user is an org admin
        metadata: Additional arbitrary data
    """
    
    # User information
    user_id: str
    user_name: str = ""
    user_email: str = ""
    user_tier: str = "free"  # 'free', 'pro', 'enterprise'
    
    # Organization information (None if personal account)
    org_id: Optional[str] = None
    org_name: Optional[str] = None
    
    # Available integrations (Composio connections)
    # List of app keys like ['gmail', 'slack', 'google_analytics']
    integrations: List[str] = field(default_factory=list)
    
    # User's role in organization
    is_org_admin: bool = False
    
    # Additional metadata
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        """Validate context after initialization."""
        if not self.user_id:
            raise ValueError("user_id is required")
        
        # Normalize tier to lowercase
        self.user_tier = self.user_tier.lower()
        
        # Validate tier
        if self.user_tier not in VALID_TIERS:
            # Default to free if invalid
            self.user_tier = "free"
    
    def user_tier_allows(self, required_tier: str) -> bool:
        """
        Check if user's tier allows access to a resource.
        
        Args:
            required_tier: The minimum tier required ('free', 'pro', 'enterprise')
            
        Returns:
            True if user's tier is >= required tier
        """
        user_level = TIER_ORDER.get(self.user_tier, 0)
        required_level = TIER_ORDER.get(required_tier, 0)
        return user_level >= required_level
    
    def has_integration(self, integration: str) -> bool:
        """Check if user has a specific integration connected."""
        return integration in self.integrations
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "user_id": self.user_id,
            "user_name": self.user_name,
            "user_email": self.user_email,
            "user_tier": self.user_tier,
            "org_id": self.org_id,
            "org_name": self.org_name,
            "integrations": self.integrations,
            "is_org_admin": self.is_org_admin,
            "metadata": self.metadata,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AgentContext":
        """Create from dictionary."""
        return cls(
            user_id=data["user_id"],
            user_name=data.get("user_name", ""),
            user_email=data.get("user_email", ""),
            user_tier=data.get("user_tier", "free"),
            org_id=data.get("org_id"),
            org_name=data.get("org_name"),
            integrations=data.get("integrations", []),
            is_org_admin=data.get("is_org_admin", False),
            metadata=data.get("metadata", {}),
        )
    
    @classmethod
    def default(cls, user_id: str) -> "AgentContext":
        """
        Create a default context for development/testing.
        
        Args:
            user_id: The user ID
            
        Returns:
            A basic context with free tier and no integrations
        """
        return cls(
            user_id=user_id,
            user_name="User",
            user_tier="free",
            integrations=[],
        )
