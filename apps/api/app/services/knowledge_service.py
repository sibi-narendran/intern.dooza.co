"""
Knowledge Service

Unified access to brand settings, brand assets, and knowledge documents.
All data is org-scoped - users access through their organization membership.

Used by:
- Agents: get_brand_context tool for content creation
- API: /v1/knowledge/* endpoints for UI
- Context Loader: inject brand context into agent prompts
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from uuid import UUID

from app.core.database import get_supabase_client

logger = logging.getLogger(__name__)


# =============================================================================
# TYPES
# =============================================================================

@dataclass
class BrandSettings:
    """Organization brand identity."""
    id: str
    org_id: str
    business_name: Optional[str] = None
    website: Optional[str] = None
    tagline: Optional[str] = None
    brand_voice: Optional[str] = None
    colors: dict = field(default_factory=dict)  # {primary, secondary, tertiary}
    fonts: dict = field(default_factory=dict)   # {heading, body}
    social_links: dict = field(default_factory=dict)  # {twitter, linkedin, instagram, ...}
    description: Optional[str] = None
    value_proposition: Optional[str] = None
    industry: Optional[str] = None
    target_audience: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


@dataclass
class BrandAsset:
    """A media asset (logo, image, video, document)."""
    id: str
    org_id: str
    asset_type: str  # logo, image, video, document, font
    name: str
    description: Optional[str] = None
    storage_bucket: str = "brand-assets"
    file_path: str = ""
    public_url: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    metadata: dict = field(default_factory=dict)
    usage_count: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


@dataclass
class BrandContext:
    """
    Complete brand context for agents.
    
    This is what agents receive when they call get_brand_context().
    """
    settings: Optional[BrandSettings] = None
    logo_url: Optional[str] = None
    recent_images: list[BrandAsset] = field(default_factory=list)
    
    def to_prompt_context(self) -> str:
        """Format brand context for agent prompts."""
        if not self.settings:
            return "No brand information configured."
        
        lines = []
        
        if self.settings.business_name:
            lines.append(f"Business: {self.settings.business_name}")
        
        if self.settings.website:
            lines.append(f"Website: {self.settings.website}")
        
        if self.settings.tagline:
            lines.append(f"Tagline: {self.settings.tagline}")
        
        if self.settings.brand_voice:
            lines.append(f"\nBrand Voice:\n{self.settings.brand_voice}")
        
        if self.settings.description:
            lines.append(f"\nBusiness Description:\n{self.settings.description}")
        
        if self.settings.value_proposition:
            lines.append(f"\nValue Proposition:\n{self.settings.value_proposition}")
        
        if self.settings.colors:
            colors = self.settings.colors
            color_str = ", ".join(f"{k}: {v}" for k, v in colors.items() if v)
            if color_str:
                lines.append(f"\nBrand Colors: {color_str}")
        
        if self.settings.target_audience:
            lines.append(f"\nTarget Audience: {self.settings.target_audience}")
        
        return "\n".join(lines) if lines else "No brand information configured."


# =============================================================================
# KNOWLEDGE SERVICE
# =============================================================================

class KnowledgeService:
    """
    Centralized service for brand and knowledge data.
    
    All methods are org-scoped. Users access data through their org membership.
    """
    
    def __init__(self):
        self.client = get_supabase_client()
        if not self.client:
            logger.warning("Supabase client not available for KnowledgeService")
    
    # -------------------------------------------------------------------------
    # Organization Resolution
    # -------------------------------------------------------------------------
    
    async def get_user_org_id(self, user_id: str) -> Optional[str]:
        """
        Get the primary organization ID for a user.
        
        Users are auto-added to an org on signup. This gets their primary org.
        
        Resolution order:
        1. Check organization_members for 'owner' role first
        2. Then check organization_members for any role
        3. Fallback: check organizations.owner_id
        """
        if not self.client:
            return None
        
        try:
            # Priority 1: Get org where user has 'owner' role (most common case)
            result = (
                self.client.table("organization_members")
                .select("org_id")
                .eq("user_id", user_id)
                .eq("role", "owner")
                .limit(1)
                .execute()
            )
            
            if result.data:
                return result.data[0]["org_id"]
            
            # Priority 2: Any membership (user might be admin/member of another org)
            result = (
                self.client.table("organization_members")
                .select("org_id")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            
            if result.data:
                return result.data[0]["org_id"]
            
            # Fallback: check if user owns an org directly (legacy/edge case)
            result = (
                self.client.table("organizations")
                .select("id")
                .eq("owner_id", user_id)
                .limit(1)
                .execute()
            )
            
            if result.data:
                return result.data[0]["id"]
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting org ID for user {user_id}: {e}")
            return None
    
    # -------------------------------------------------------------------------
    # Brand Settings
    # -------------------------------------------------------------------------
    
    async def get_brand_settings(self, org_id: str) -> Optional[BrandSettings]:
        """Get brand settings for an organization."""
        if not self.client:
            return None
        
        try:
            result = (
                self.client.table("brand_settings")
                .select("*")
                .eq("org_id", org_id)
                .limit(1)
                .execute()
            )
            
            if not result.data:
                return None
            
            return self._row_to_brand_settings(result.data[0])
            
        except Exception as e:
            logger.error(f"Error fetching brand settings for org {org_id}: {e}")
            return None
    
    async def save_brand_settings(
        self,
        org_id: str,
        *,
        business_name: Optional[str] = None,
        website: Optional[str] = None,
        tagline: Optional[str] = None,
        brand_voice: Optional[str] = None,
        colors: Optional[dict] = None,
        fonts: Optional[dict] = None,
        social_links: Optional[dict] = None,
        description: Optional[str] = None,
        value_proposition: Optional[str] = None,
        industry: Optional[str] = None,
        target_audience: Optional[str] = None,
        created_by: Optional[str] = None,
    ) -> Optional[BrandSettings]:
        """
        Save brand settings for an organization.
        
        Uses UPSERT - creates if not exists, updates if exists.
        Only non-None values are updated.
        """
        if not self.client:
            return None
        
        # Build update data with only provided fields
        update_data = {
            "org_id": org_id,
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        if business_name is not None:
            update_data["business_name"] = business_name
        if website is not None:
            update_data["website"] = website
        if tagline is not None:
            update_data["tagline"] = tagline
        if brand_voice is not None:
            update_data["brand_voice"] = brand_voice
        if colors is not None:
            update_data["colors"] = colors
        if fonts is not None:
            update_data["fonts"] = fonts
        if social_links is not None:
            update_data["social_links"] = social_links
        if description is not None:
            update_data["description"] = description
        if value_proposition is not None:
            update_data["value_proposition"] = value_proposition
        if industry is not None:
            update_data["industry"] = industry
        if target_audience is not None:
            update_data["target_audience"] = target_audience
        if created_by is not None:
            update_data["created_by"] = created_by
        
        try:
            result = (
                self.client.table("brand_settings")
                .upsert(update_data, on_conflict="org_id")
                .execute()
            )
            
            if not result.data:
                logger.error(f"Failed to save brand settings for org {org_id}")
                return None
            
            logger.info(f"Saved brand settings for org {org_id}")
            return self._row_to_brand_settings(result.data[0])
            
        except Exception as e:
            logger.error(f"Error saving brand settings for org {org_id}: {e}")
            return None
    
    # -------------------------------------------------------------------------
    # Brand Assets
    # -------------------------------------------------------------------------
    
    async def get_brand_assets(
        self,
        org_id: str,
        asset_type: Optional[str] = None,
        limit: int = 50,
    ) -> list[BrandAsset]:
        """
        Get brand assets for an organization.
        
        Args:
            org_id: Organization ID
            asset_type: Optional filter (logo, image, video, document, font)
            limit: Maximum number of assets to return
            
        Returns:
            List of BrandAsset objects
        """
        if not self.client:
            return []
        
        try:
            query = (
                self.client.table("brand_assets")
                .select("*")
                .eq("org_id", org_id)
                .eq("is_deleted", False)
                .order("created_at", desc=True)
                .limit(limit)
            )
            
            if asset_type:
                query = query.eq("asset_type", asset_type)
            
            result = query.execute()
            
            if not result.data:
                return []
            
            return [self._row_to_brand_asset(row) for row in result.data]
            
        except Exception as e:
            logger.error(f"Error fetching brand assets for org {org_id}: {e}")
            return []
    
    async def get_logo(self, org_id: str) -> Optional[BrandAsset]:
        """Get the primary logo for an organization."""
        assets = await self.get_brand_assets(org_id, asset_type="logo", limit=1)
        return assets[0] if assets else None
    
    async def save_brand_asset(
        self,
        org_id: str,
        *,
        asset_type: str,
        name: str,
        file_path: str,
        description: Optional[str] = None,
        public_url: Optional[str] = None,
        file_size: Optional[int] = None,
        mime_type: Optional[str] = None,
        metadata: Optional[dict] = None,
        uploaded_by: Optional[str] = None,
    ) -> Optional[BrandAsset]:
        """
        Save a brand asset record.
        
        Note: This saves the database record. Actual file upload
        should be done separately via Supabase Storage.
        """
        if not self.client:
            return None
        
        insert_data = {
            "org_id": org_id,
            "asset_type": asset_type,
            "name": name,
            "file_path": file_path,
            "description": description,
            "public_url": public_url,
            "file_size": file_size,
            "mime_type": mime_type,
            "metadata": metadata or {},
            "uploaded_by": uploaded_by,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        try:
            result = (
                self.client.table("brand_assets")
                .insert(insert_data)
                .execute()
            )
            
            if not result.data:
                logger.error(f"Failed to save brand asset for org {org_id}")
                return None
            
            logger.info(f"Saved brand asset '{name}' for org {org_id}")
            return self._row_to_brand_asset(result.data[0])
            
        except Exception as e:
            logger.error(f"Error saving brand asset for org {org_id}: {e}")
            return None
    
    async def delete_brand_asset(self, org_id: str, asset_id: str) -> bool:
        """
        Soft delete a brand asset.
        
        Marks is_deleted=True rather than removing the record.
        """
        if not self.client:
            return False
        
        try:
            result = (
                self.client.table("brand_assets")
                .update({
                    "is_deleted": True,
                    "deleted_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat(),
                })
                .eq("id", asset_id)
                .eq("org_id", org_id)  # Security: ensure asset belongs to org
                .execute()
            )
            
            if result.data:
                logger.info(f"Deleted brand asset {asset_id} for org {org_id}")
                return True
            return False
            
        except Exception as e:
            logger.error(f"Error deleting brand asset {asset_id}: {e}")
            return False
    
    async def increment_asset_usage(self, asset_id: str) -> None:
        """
        Increment usage count for an asset (called when used in content).
        
        Non-critical operation - failures are logged but don't raise.
        """
        if not self.client:
            return
        
        try:
            # Get current count and increment
            # Note: Not atomic, but acceptable for analytics counters
            result = (
                self.client.table("brand_assets")
                .select("usage_count")
                .eq("id", asset_id)
                .limit(1)
                .execute()
            )
            
            if result.data:
                current_count = result.data[0].get("usage_count", 0) or 0
                self.client.table("brand_assets").update({
                    "usage_count": current_count + 1,
                    "last_used_at": datetime.utcnow().isoformat(),
                }).eq("id", asset_id).execute()
                
        except Exception as e:
            # Non-critical - just for analytics, log and continue
            logger.debug(f"Failed to increment asset usage for {asset_id}: {e}")
    
    # -------------------------------------------------------------------------
    # Brand Context (Combined for Agents)
    # -------------------------------------------------------------------------
    
    async def get_brand_context(self, user_id: str) -> BrandContext:
        """
        Get complete brand context for an agent.
        
        This is the main method agents use to get brand information.
        
        Args:
            user_id: User ID (we resolve to org_id internally)
            
        Returns:
            BrandContext with settings, logo, and recent images
        """
        org_id = await self.get_user_org_id(user_id)
        
        if not org_id:
            logger.warning(f"No org found for user {user_id}")
            return BrandContext()
        
        # Fetch settings and assets in parallel (conceptually)
        settings = await self.get_brand_settings(org_id)
        logo = await self.get_logo(org_id)
        images = await self.get_brand_assets(org_id, asset_type="image", limit=10)
        
        return BrandContext(
            settings=settings,
            logo_url=logo.public_url if logo else None,
            recent_images=images,
        )
    
    async def get_brand_context_by_org(self, org_id: str) -> BrandContext:
        """
        Get brand context directly by org_id.
        
        Use this when you already have the org_id (e.g., from org-scoped API).
        """
        settings = await self.get_brand_settings(org_id)
        logo = await self.get_logo(org_id)
        images = await self.get_brand_assets(org_id, asset_type="image", limit=10)
        
        return BrandContext(
            settings=settings,
            logo_url=logo.public_url if logo else None,
            recent_images=images,
        )
    
    # -------------------------------------------------------------------------
    # Knowledge Documents (Uses existing tables)
    # -------------------------------------------------------------------------
    
    async def get_knowledge_bases(self, org_id: str) -> list[dict]:
        """Get knowledge bases for an organization."""
        if not self.client:
            return []
        
        try:
            result = (
                self.client.table("knowledge_bases")
                .select("*")
                .eq("org_id", org_id)
                .eq("is_active", True)
                .execute()
            )
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"Error fetching knowledge bases for org {org_id}: {e}")
            return []
    
    async def search_knowledge(
        self,
        org_id: str,
        query: str,
        limit: int = 5,
    ) -> list[dict]:
        """
        Search knowledge documents.
        
        Uses case-insensitive search on title and content fields.
        For vector/semantic search, use embeddings when available.
        """
        if not self.client:
            return []
        
        if not query or not query.strip():
            return []
        
        try:
            # Get org's knowledge base IDs
            kb_result = (
                self.client.table("knowledge_bases")
                .select("id")
                .eq("org_id", org_id)
                .eq("is_active", True)
                .execute()
            )
            
            if not kb_result.data:
                return []
            
            kb_ids = [kb["id"] for kb in kb_result.data]
            
            # Search documents in those knowledge bases
            # Using ilike for case-insensitive search (more reliable than text_search)
            search_pattern = f"%{query}%"
            result = (
                self.client.table("knowledge_base_documents")
                .select("id, title, content, source_type, metadata")
                .in_("kb_id", kb_ids)
                .or_(f"title.ilike.{search_pattern},content.ilike.{search_pattern}")
                .limit(limit)
                .execute()
            )
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"Error searching knowledge for org {org_id}: {e}")
            return []
    
    # -------------------------------------------------------------------------
    # Private Helpers
    # -------------------------------------------------------------------------
    
    def _row_to_brand_settings(self, row: dict) -> BrandSettings:
        """Convert database row to BrandSettings."""
        return BrandSettings(
            id=row["id"],
            org_id=row["org_id"],
            business_name=row.get("business_name"),
            website=row.get("website"),
            tagline=row.get("tagline"),
            brand_voice=row.get("brand_voice"),
            colors=row.get("colors") or {},
            fonts=row.get("fonts") or {},
            social_links=row.get("social_links") or {},
            description=row.get("description"),
            value_proposition=row.get("value_proposition"),
            industry=row.get("industry"),
            target_audience=row.get("target_audience"),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
        )
    
    def _row_to_brand_asset(self, row: dict) -> BrandAsset:
        """Convert database row to BrandAsset."""
        return BrandAsset(
            id=row["id"],
            org_id=row["org_id"],
            asset_type=row["asset_type"],
            name=row["name"],
            description=row.get("description"),
            storage_bucket=row.get("storage_bucket", "brand-assets"),
            file_path=row.get("file_path", ""),
            public_url=row.get("public_url"),
            file_size=row.get("file_size"),
            mime_type=row.get("mime_type"),
            metadata=row.get("metadata") or {},
            usage_count=row.get("usage_count", 0),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
        )


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_service: Optional[KnowledgeService] = None


def get_knowledge_service() -> KnowledgeService:
    """Get or create the knowledge service singleton."""
    global _service
    if _service is None:
        _service = KnowledgeService()
    return _service
