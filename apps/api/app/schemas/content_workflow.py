"""
Content Workflow Schemas

Pydantic models for the content creation workflow state and outputs.
Used by the parallel research, prompt chaining, and evaluator-optimizer patterns.
"""

from __future__ import annotations

from typing import Optional, List, Literal
from pydantic import BaseModel, Field


# =============================================================================
# RESEARCH OUTPUT SCHEMAS
# =============================================================================

class HashtagResearch(BaseModel):
    """Output from hashtag research."""
    topic: str
    platform: str
    suggested_hashtags: List[str] = Field(default_factory=list)
    platform_tip: str = ""
    max_recommended: int = 10


class TimingResearch(BaseModel):
    """Output from posting time research."""
    platform: str
    content_type: str
    best_days: List[str] = Field(default_factory=list)
    best_hours: List[str] = Field(default_factory=list)
    avoid: str = ""
    recommendation: str = ""


class ContentIdea(BaseModel):
    """Single content idea."""
    title: str
    format: str  # carousel, video, text, image
    hook: str


class ContentIdeasResearch(BaseModel):
    """Output from content ideas research."""
    topic: str
    platform: str
    ideas: List[ContentIdea] = Field(default_factory=list)
    format_tip: str = ""


class CompetitorInsight(BaseModel):
    """Output from competitor analysis."""
    competitor: str
    platform: str
    analysis_framework: dict = Field(default_factory=dict)
    what_to_learn: List[str] = Field(default_factory=list)


# =============================================================================
# CONTENT BRIEF SCHEMA
# =============================================================================

class ContentBrief(BaseModel):
    """
    Content brief synthesized from research.
    
    This guides the content creation phase.
    """
    topic: str
    platform: str
    content_type: str  # linkedin_post, tweet, instagram_post, etc.
    
    # From research
    target_hashtags: List[str] = Field(default_factory=list)
    best_posting_time: str = ""
    content_angle: str = ""  # The hook/approach to take
    
    # Guidelines
    tone: str = "professional"
    target_length: str = ""  # e.g., "150-300 words"
    key_points: List[str] = Field(default_factory=list)
    call_to_action: str = ""
    
    # Platform-specific
    platform_tips: List[str] = Field(default_factory=list)


# =============================================================================
# DRAFT CONTENT SCHEMA
# =============================================================================

class DraftContent(BaseModel):
    """
    Draft content generated from brief.
    
    Platform-agnostic representation that will be
    converted to platform-specific format.
    """
    platform: str
    content_type: str
    
    # The actual content
    text: str = ""
    title: Optional[str] = None  # For blog posts, videos
    hashtags: List[str] = Field(default_factory=list)
    
    # Optional elements
    hook: Optional[str] = None
    body: Optional[str] = None
    call_to_action: Optional[str] = None
    
    # For threads/carousels
    parts: Optional[List[str]] = None


# =============================================================================
# EVALUATION SCHEMA
# =============================================================================

class ContentFeedback(BaseModel):
    """
    Structured evaluation of generated content.
    
    Used by the evaluator-optimizer loop to determine
    if content needs refinement.
    """
    grade: Literal["pass", "needs_improvement"] = Field(
        description="Whether content meets quality standards"
    )
    
    # Individual scores (1-10)
    platform_fit_score: int = Field(
        ge=1, le=10,
        description="How well it fits the platform conventions"
    )
    engagement_score: int = Field(
        ge=1, le=10,
        description="Potential for likes, comments, shares"
    )
    clarity_score: int = Field(
        ge=1, le=10,
        description="How clear and readable the content is"
    )
    cta_score: int = Field(
        ge=1, le=10,
        description="Call-to-action effectiveness"
    )
    
    # Feedback for improvement
    feedback: str = Field(
        description="Specific suggestions for improvement"
    )
    
    # What specifically needs work
    issues: List[str] = Field(
        default_factory=list,
        description="List of specific issues to address"
    )
    
    @property
    def overall_score(self) -> float:
        """Calculate average score."""
        return (
            self.platform_fit_score + 
            self.engagement_score + 
            self.clarity_score + 
            self.cta_score
        ) / 4
    
    @property
    def passes_threshold(self) -> bool:
        """Check if content passes minimum quality threshold."""
        return self.overall_score >= 7.0 and self.grade == "pass"


# =============================================================================
# FINAL OUTPUT SCHEMA
# =============================================================================

class FinalContent(BaseModel):
    """
    Final polished content ready for task creation.
    
    Includes both the content and metadata about the
    creation process for transparency.
    """
    # The content
    platform: str
    content_type: str
    text: str
    title: Optional[str] = None
    hashtags: List[str] = Field(default_factory=list)
    
    # Research metadata (for display in UI)
    research_insights: dict = Field(default_factory=dict)
    
    # Evaluation metadata
    evaluation_score: float = 0.0
    iterations_needed: int = 1


# =============================================================================
# WORKFLOW METADATA
# =============================================================================

class WorkflowMetadata(BaseModel):
    """
    Metadata about the workflow execution.
    
    Stored alongside the task for debugging and analytics.
    """
    workflow_id: str = ""
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    
    # Steps completed
    research_completed: bool = False
    brief_completed: bool = False
    draft_completed: bool = False
    evaluation_iterations: int = 0
    
    # Final outcome
    final_score: float = 0.0
    total_duration_seconds: float = 0.0
