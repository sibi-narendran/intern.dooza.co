"""
Research Schema Models

Pydantic models for communication between Soshie and the Research subagent.
These define the structured contract for content research results.

Usage:
    from app.schemas.research import ContentResearchResult
    
    result = ContentResearchResult(
        brand_name="TechCorp",
        brand_voice=ContentTone.professional,
        content_ideas=[...],
        ...
    )
"""

from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# =============================================================================
# ENUMS
# =============================================================================

class ContentTone(str, Enum):
    """Brand voice tones for content creation."""
    professional = "professional"
    casual = "casual"
    witty = "witty"
    inspirational = "inspirational"
    educational = "educational"
    friendly = "friendly"


class ImageStyle(str, Enum):
    """Image generation styles."""
    photo_realistic = "photo_realistic"
    illustration = "illustration"
    infographic = "infographic"
    quote_card = "quote_card"
    product_shot = "product_shot"
    lifestyle = "lifestyle"
    abstract = "abstract"
    minimal = "minimal"


# =============================================================================
# SUB-MODELS
# =============================================================================

class ContentIdea(BaseModel):
    """A single content idea from research."""
    topic: str = Field(..., description="Main topic/theme for the content")
    hook: str = Field(..., description="Attention-grabbing opening line")
    key_points: List[str] = Field(
        default_factory=list, 
        description="3-5 key points to cover in the content"
    )
    cta: str = Field(..., description="Call-to-action suggestion")
    why_now: Optional[str] = Field(
        None, 
        description="Why this content is timely/relevant"
    )


class ImageSuggestion(BaseModel):
    """Image generation suggestion for visual content."""
    style: ImageStyle = Field(..., description="Visual style for the image")
    prompt: str = Field(..., description="Detailed prompt for image generation")
    aspect_ratio: str = Field(
        default="1:1", 
        description="Image aspect ratio (e.g., 1:1, 16:9, 4:5)"
    )
    mood: str = Field(
        default="professional",
        description="Visual mood: bright, dark, minimal, bold, etc."
    )
    include_text: bool = Field(
        default=False, 
        description="Should the image include text overlay?"
    )
    text_suggestion: Optional[str] = Field(
        None, 
        description="Text to overlay if include_text is True"
    )


class TrendInsight(BaseModel):
    """A trending topic or insight."""
    topic: str = Field(..., description="The trending topic")
    relevance: str = Field(..., description="Why this is relevant to the brand")
    source: Optional[str] = Field(None, description="Where this trend was found")


# =============================================================================
# MAIN RESULT MODEL
# =============================================================================

class ContentResearchResult(BaseModel):
    """
    Complete research output from the Research subagent.
    
    This is the structured contract between Research and Soshie.
    Research returns this, Soshie interprets it and decides next steps.
    """
    # Brand context summary
    brand_name: str = Field(..., description="Name of the brand")
    brand_voice: ContentTone = Field(
        default=ContentTone.professional,
        description="Brand's tone of voice"
    )
    industry: Optional[str] = Field(None, description="Brand's industry")
    target_audience: Optional[str] = Field(
        None, 
        description="Who the content is for"
    )
    
    # Content strategy
    content_ideas: List[ContentIdea] = Field(
        ..., 
        min_length=1, 
        max_length=5,
        description="List of content ideas (1-5)"
    )
    recommended_idea: int = Field(
        default=0, 
        ge=0,
        description="Index of the recommended idea (0-indexed)"
    )
    
    # For the recommended idea
    content_brief: str = Field(
        ..., 
        description="Detailed brief for content creation"
    )
    suggested_hashtags: List[str] = Field(
        default_factory=list,
        description="Recommended hashtags"
    )
    best_posting_time: Optional[str] = Field(
        None, 
        description="Recommended posting time (e.g., 'Tuesday 9am EST')"
    )
    
    # Visual content
    image_suggestion: Optional[ImageSuggestion] = Field(
        None,
        description="Image generation suggestion if visual content needed"
    )
    
    # Trends (if research found any)
    trends: List[TrendInsight] = Field(
        default_factory=list,
        description="Relevant trending topics found"
    )
    
    # Reasoning (for transparency)
    reasoning: str = Field(
        ..., 
        description="Explanation of why this strategy was chosen"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "brand_name": "TechStartup Inc",
                "brand_voice": "professional",
                "industry": "SaaS",
                "target_audience": "Tech professionals and startup founders",
                "content_ideas": [{
                    "topic": "AI productivity tips",
                    "hook": "Stop wasting 3 hours daily on tasks AI can do in minutes",
                    "key_points": [
                        "Automate email responses",
                        "Use AI for research",
                        "Batch similar tasks"
                    ],
                    "cta": "What's your biggest time waster? Comment below 👇",
                    "why_now": "AI tools trending, Monday motivation timing"
                }],
                "recommended_idea": 0,
                "content_brief": "Write a LinkedIn post about how AI tools can save professionals 3+ hours daily. Start with a bold claim about wasted time, list 3 specific automations anyone can implement today, and end with an engagement question.",
                "suggested_hashtags": ["#AI", "#Productivity", "#FutureOfWork"],
                "best_posting_time": "Tuesday 9am EST",
                "image_suggestion": {
                    "style": "infographic",
                    "prompt": "Clean minimal infographic showing 3 AI productivity tips with icons, professional blue color scheme",
                    "aspect_ratio": "1:1",
                    "mood": "bright, professional"
                },
                "trends": [{
                    "topic": "AI automation tools",
                    "relevance": "Matches brand's SaaS focus",
                    "source": "LinkedIn trending"
                }],
                "reasoning": "Brand focuses on productivity SaaS, AI content consistently performs well on LinkedIn for this audience, Monday posts get high engagement from professionals."
            }
        }


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def create_empty_research_result(
    brand_name: str = "Unknown Brand",
    error_message: str = "Research could not be completed"
) -> ContentResearchResult:
    """Create a minimal research result when research fails."""
    return ContentResearchResult(
        brand_name=brand_name,
        brand_voice=ContentTone.professional,
        content_ideas=[
            ContentIdea(
                topic="General brand update",
                hook="Share what's new with your audience",
                key_points=["Recent news", "Updates", "Engagement"],
                cta="What would you like to hear about?",
            )
        ],
        content_brief=error_message,
        reasoning="Fallback: Research could not gather enough data",
    )
