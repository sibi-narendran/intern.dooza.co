"""
Subagent Task Schemas

Defines structured input/output formats for communication between
Soshie (supervisor) and subagents (research, image_gen).

This follows the LangGraph pattern of passing structured state
instead of free-form text messages.

Architecture:
    Soshie → Tool (structured args) → Subagent (structured task) → Result

Benefits:
- Type-safe communication
- Clear contract between agents
- Parseable by both LLM and code
- Consistent response format
"""

from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# =============================================================================
# TASK TYPES
# =============================================================================

class SubagentTaskType(str, Enum):
    """Types of tasks subagents can perform."""
    research_content = "research_content"
    generate_image = "generate_image"


# =============================================================================
# RESEARCH SUBAGENT SCHEMAS
# =============================================================================

# Re-export from canonical source to avoid duplication
from app.schemas.research import ContentIdea, ContentTone, ImageSuggestion, TrendInsight


class ResearchTaskInput(BaseModel):
    """
    Structured input for the Research subagent.
    
    Passed as JSON in the HumanMessage content.
    """
    task_type: str = Field(default="research_content", description="Task identifier")
    platforms: list[str] = Field(description="Target platforms (e.g., ['linkedin'])")
    topic_hint: Optional[str] = Field(default=None, description="Optional topic direction")
    
    # Context (auto-populated from AgentContext)
    user_id: Optional[str] = Field(default=None, description="User ID for brand lookup")
    
    class Config:
        json_schema_extra = {
            "example": {
                "task_type": "research_content",
                "platforms": ["linkedin"],
                "topic_hint": "AI productivity",
            }
        }


class ResearchTaskOutput(BaseModel):
    """
    Structured output from the Research subagent.
    
    Compatible with ContentResearchResult from schemas/research.py.
    Uses flexible types for parsing LLM responses.
    """
    # Status
    success: bool = Field(default=True, description="Whether research succeeded")
    
    # Brand context
    brand_name: str = Field(description="Brand being researched")
    brand_voice: str = Field(default="professional", description="Brand tone")
    industry: Optional[str] = Field(default=None, description="Brand's industry")
    target_audience: Optional[str] = Field(default=None, description="Target audience")
    
    # Content strategy
    content_ideas: list[dict] = Field(default_factory=list, description="Generated content ideas")
    recommended_idea: int = Field(default=0, description="Index of recommended idea")
    content_brief: str = Field(default="", description="Detailed content creation instructions")
    
    # Hashtags and timing
    suggested_hashtags: list[str] = Field(default_factory=list, description="Recommended hashtags")
    best_posting_time: Optional[str] = Field(default=None, description="Recommended posting time")
    
    # Visual content
    image_suggestion: Optional[dict] = Field(default=None, description="Image generation suggestion")
    
    # Trends
    trends: list[dict] = Field(default_factory=list, description="Relevant trends found")
    
    # Reasoning
    reasoning: str = Field(default="", description="Why this strategy was recommended")
    
    # Error handling
    error: Optional[str] = Field(default=None, description="Error code if failed")
    error_detail: Optional[str] = Field(default=None, description="Detailed error message")


# =============================================================================
# IMAGE GENERATION SUBAGENT SCHEMAS
# =============================================================================

# Re-export ImageStyle from the canonical source to avoid duplication
from app.schemas.image_generation import ImageStyle, ImageStatus


class ImageTaskInput(BaseModel):
    """
    Structured input for the Image Generation subagent.
    
    Passed as JSON in the HumanMessage content.
    """
    task_type: str = Field(default="generate_image", description="Task identifier")
    description: str = Field(description="What the image should show")
    platform: str = Field(default="instagram", description="Target platform")
    style: str = Field(default="photo_realistic", description="Visual style")
    include_brand_colors: bool = Field(default=True, description="Use brand colors")
    
    # Context (auto-populated from AgentContext)
    user_id: Optional[str] = Field(default=None, description="User ID for brand lookup")
    
    class Config:
        json_schema_extra = {
            "example": {
                "task_type": "generate_image",
                "description": "Professional team meeting with AI assistants",
                "platform": "linkedin",
                "style": "photo_realistic",
                "include_brand_colors": True,
            }
        }


class ImageTaskOutput(BaseModel):
    """
    Structured output from the Image Generation subagent.
    
    Compatible with ImageGenerationResult from schemas/image_generation.py.
    Uses string types for flexibility in parsing LLM responses.
    """
    # Status fields
    success: bool = Field(default=True, description="Whether generation succeeded")
    status: str = Field(description="success, error, filtered, or stub")
    
    # Result (if successful)
    image_url: Optional[str] = Field(default=None, description="Public URL of generated image")
    image_data_url: Optional[str] = Field(default=None, description="Base64 data URL fallback")
    
    # Generation details
    prompt_used: str = Field(description="Prompt used for generation")
    enhanced_prompt: Optional[str] = Field(default=None, description="LLM-enhanced prompt")
    negative_prompt: Optional[str] = Field(default=None, description="Negative prompt if used")
    style: str = Field(default="photo_realistic", description="Style applied")
    aspect_ratio: str = Field(default="1:1", description="Aspect ratio used")
    
    # Platform info
    platform: str = Field(default="instagram", description="Target platform")
    dimensions: Optional[str] = Field(default=None, description="Image dimensions (e.g., 1080x1080)")
    
    # Provider info
    provider: Optional[str] = Field(default=None, description="Backend used for generation")
    model: Optional[str] = Field(default=None, description="Model used")
    
    # Brand consistency
    brand_colors_used: bool = Field(default=False, description="Whether brand colors were used")
    
    # Message for user
    message: str = Field(default="", description="Human-readable status message")
    
    # API readiness (for backwards compatibility)
    ready_for_api: bool = Field(default=True, description="Flag indicating API is configured")
    
    # Error handling
    error: Optional[str] = Field(default=None, description="Error code if failed")
    error_detail: Optional[str] = Field(default=None, description="Detailed error message")


# =============================================================================
# MESSAGE BUILDERS
# =============================================================================

def build_research_message(task: ResearchTaskInput) -> str:
    """
    Build a structured JSON message for the Research subagent.
    
    The subagent prompt is configured to parse this JSON format.
    """
    return task.model_dump_json(indent=2)


def build_image_message(task: ImageTaskInput) -> str:
    """
    Build a structured JSON message for the Image Generation subagent.
    
    The subagent prompt is configured to parse this JSON format.
    """
    return task.model_dump_json(indent=2)


# =============================================================================
# RESULT PARSERS
# =============================================================================

def parse_research_result(content: str) -> ResearchTaskOutput:
    """
    Parse subagent response into structured output.
    
    Handles:
    - JSON responses from Research subagent (ContentResearchResult format)
    - Enum values (converts to strings)
    - Fallback to raw content if parsing fails
    """
    import json
    import re
    
    try:
        # Look for JSON in the response
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            data = json.loads(json_match.group())
            
            # Convert enum values to strings if needed
            if "brand_voice" in data and hasattr(data["brand_voice"], "value"):
                data["brand_voice"] = data["brand_voice"].value
            elif "brand_voice" in data:
                data["brand_voice"] = str(data["brand_voice"])
            
            # Ensure success flag
            if "success" not in data:
                data["success"] = True
            
            # Ensure required fields have defaults
            if "brand_name" not in data:
                data["brand_name"] = "Your Brand"
            if "content_brief" not in data:
                data["content_brief"] = ""
            if "reasoning" not in data:
                data["reasoning"] = ""
            
            return ResearchTaskOutput(**data)
    except (json.JSONDecodeError, Exception) as e:
        # Log for debugging but don't fail
        import logging
        logging.getLogger(__name__).debug(f"Failed to parse research result JSON: {e}")
    
    # Fallback: wrap raw content as reasoning
    return ResearchTaskOutput(
        success=True,
        brand_name="Your Brand",
        brand_voice="professional",
        content_ideas=[{
            "topic": "Based on research",
            "hook": "See reasoning for details",
            "key_points": ["Check the full reasoning below"],
            "cta": "What do you think?",
        }],
        recommended_idea=0,
        content_brief="See the detailed reasoning from research",
        reasoning=content,
    )


def parse_image_result(content: str, fallback_description: str = "") -> ImageTaskOutput:
    """
    Parse subagent response into structured output.
    
    Handles:
    - JSON responses from create_image tool (ImageGenerationResult format)
    - Enum values (converts to strings)
    - Fallback to raw content if parsing fails
    """
    import json
    import re
    
    try:
        # Look for JSON in the response
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            data = json.loads(json_match.group())
            
            # Convert enum values to strings if needed
            if "status" in data and hasattr(data["status"], "value"):
                data["status"] = data["status"].value
            if "style" in data and hasattr(data["style"], "value"):
                data["style"] = data["style"].value
            if "provider" in data and hasattr(data["provider"], "value"):
                data["provider"] = data["provider"].value
            
            # Ensure status is a string
            if "status" in data:
                data["status"] = str(data["status"])
            
            # Determine success based on status
            if "success" not in data:
                data["success"] = data.get("status") == "success"
            
            # Ensure required fields have defaults
            if "prompt_used" not in data:
                data["prompt_used"] = fallback_description
            if "message" not in data:
                data["message"] = ""
            
            return ImageTaskOutput(**data)
    except (json.JSONDecodeError, Exception) as e:
        # Log for debugging but don't fail
        import logging
        logging.getLogger(__name__).debug(f"Failed to parse image result JSON: {e}")
    
    # Fallback
    return ImageTaskOutput(
        success=False,
        status="stub",
        image_url=None,
        prompt_used=fallback_description,
        style="photo_realistic",
        aspect_ratio="1:1",
        platform="instagram",
        dimensions="1080x1080",
        message=content,
    )
