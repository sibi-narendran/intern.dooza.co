"""
Social Research Agent

Specialist agent responsible for social media research, trend analysis, 
and hashtag suggestions. Part of the Soshie team.

Responsibilities:
- Research trending topics and hashtags
- Analyze competitor content
- Suggest optimal posting times
- Provide content strategy insights
- Research target audience interests

Note: This agent provides research and recommendations.
For content creation, defer to social_writer.
For publishing, defer to social_publisher.
"""

from __future__ import annotations

import logging
from typing import Optional, List
from datetime import datetime

from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

from app.agents.base import get_llm

logger = logging.getLogger(__name__)


# =============================================================================
# RESEARCH TOOLS
# =============================================================================

@tool
def suggest_hashtags(
    topic: str,
    platform: str,
    max_tags: int = 10,
) -> dict:
    """
    Suggest relevant hashtags for a topic on a specific platform.
    
    Args:
        topic: The main topic or theme of the content
        platform: Target platform (instagram, twitter, linkedin, tiktok)
        max_tags: Maximum number of hashtags to suggest (default 10)
    
    Returns:
        dict with suggested hashtags and usage tips
    """
    platform = platform.lower()
    
    # Platform-specific hashtag guidelines
    guidelines = {
        "instagram": {
            "max_recommended": 10,
            "tip": "Mix popular (1M+ posts) with niche tags. Place in first comment for cleaner captions.",
        },
        "twitter": {
            "max_recommended": 2,
            "tip": "Use 1-2 highly relevant tags. Too many looks spammy.",
        },
        "linkedin": {
            "max_recommended": 5,
            "tip": "Use professional, industry-specific tags. Less is more.",
        },
        "tiktok": {
            "max_recommended": 5,
            "tip": "Include trending sounds/challenges as well as topic hashtags.",
        },
        "facebook": {
            "max_recommended": 3,
            "tip": "Hashtags are less important on Facebook. Focus on quality content.",
        },
        "youtube": {
            "max_recommended": 15,
            "tip": "Use in video tags, not description. Mix broad and specific.",
        },
    }
    
    guide = guidelines.get(platform, guidelines["instagram"])
    effective_max = min(max_tags, guide["max_recommended"])
    
    # Generate topic-based suggestions (in production, this would use real trend APIs)
    base_tags = _generate_topic_hashtags(topic, effective_max)
    
    return {
        "topic": topic,
        "platform": platform,
        "suggested_hashtags": base_tags,
        "count": len(base_tags),
        "platform_tip": guide["tip"],
        "max_recommended": guide["max_recommended"],
        "usage": f"For {platform}, use {guide['max_recommended']} or fewer hashtags.",
    }


@tool
def analyze_best_posting_time(
    platform: str,
    content_type: str,
    target_audience: str = "general",
) -> dict:
    """
    Suggest optimal posting times for a platform and content type.
    
    Args:
        platform: Target platform (instagram, twitter, linkedin, tiktok, youtube)
        content_type: Type of content (image, video, text, carousel, story)
        target_audience: Target audience description (e.g., "B2B professionals", "Gen Z")
    
    Returns:
        dict with best times to post and reasoning
    """
    platform = platform.lower()
    
    # General best times (based on common social media research)
    # In production, this would use real analytics
    best_times = {
        "instagram": {
            "best_days": ["Tuesday", "Wednesday", "Thursday"],
            "best_hours": ["11am-1pm", "7pm-9pm"],
            "avoid": "Late night (12am-6am)",
            "note": "Stories perform best in morning, Reels in evening",
        },
        "twitter": {
            "best_days": ["Tuesday", "Wednesday", "Thursday"],
            "best_hours": ["8am-10am", "12pm-1pm"],
            "avoid": "Weekends (lower engagement)",
            "note": "News/trends peak early morning",
        },
        "linkedin": {
            "best_days": ["Tuesday", "Wednesday", "Thursday"],
            "best_hours": ["7am-8am", "12pm", "5pm-6pm"],
            "avoid": "Weekends and late evenings",
            "note": "B2B content performs best mid-week mornings",
        },
        "tiktok": {
            "best_days": ["Tuesday", "Thursday", "Friday"],
            "best_hours": ["7pm-9pm", "12pm-3pm"],
            "avoid": "Early mornings",
            "note": "Younger audience most active in evenings",
        },
        "youtube": {
            "best_days": ["Thursday", "Friday", "Saturday"],
            "best_hours": ["2pm-4pm", "9pm-11pm"],
            "avoid": "Monday mornings",
            "note": "Publish 2-3 hours before peak viewing time",
        },
        "facebook": {
            "best_days": ["Wednesday", "Thursday", "Friday"],
            "best_hours": ["9am-1pm"],
            "avoid": "Late night",
            "note": "Engagement drops significantly on weekends",
        },
    }
    
    times = best_times.get(platform, best_times["instagram"])
    
    # Adjust for B2B audience
    if "b2b" in target_audience.lower() or "professional" in target_audience.lower():
        times["note"] += " For B2B, lean toward business hours (9am-5pm weekdays)."
    
    return {
        "platform": platform,
        "content_type": content_type,
        "target_audience": target_audience,
        "best_days": times["best_days"],
        "best_hours": times["best_hours"],
        "avoid": times["avoid"],
        "recommendation": times["note"],
        "timezone_note": "Times are in user's local timezone",
    }


@tool
def research_content_ideas(
    topic: str,
    platform: str,
    content_format: str = "any",
    count: int = 5,
) -> dict:
    """
    Generate content ideas for a topic and platform.
    
    Args:
        topic: The main topic or niche
        platform: Target platform
        content_format: Preferred format (image, video, carousel, text, any)
        count: Number of ideas to generate
    
    Returns:
        dict with content ideas and tips
    """
    platform = platform.lower()
    
    # Content format recommendations by platform
    format_tips = {
        "instagram": "Carousels get 3x more engagement. Reels reach 2x more people.",
        "twitter": "Threads perform well for long-form. Images boost engagement 150%.",
        "linkedin": "Document posts (PDF carousels) get 3x more clicks. Video is underused.",
        "tiktok": "Trend-based content and tutorials perform best. Keep under 60s.",
        "youtube": "Shorts for discovery, long-form for retention. Strong thumbnails crucial.",
        "facebook": "Native video outperforms links. Groups drive more engagement than pages.",
    }
    
    # Generate ideas based on topic
    ideas = _generate_content_ideas(topic, platform, content_format, count)
    
    return {
        "topic": topic,
        "platform": platform,
        "content_format": content_format,
        "ideas": ideas,
        "format_tip": format_tips.get(platform, "Match your content to the platform's strengths."),
        "general_tip": "Consistency beats perfection. Post regularly and iterate based on performance.",
    }


@tool
def analyze_competitor(
    competitor_handle: str,
    platform: str,
) -> dict:
    """
    Analyze a competitor's social media presence.
    
    Note: This provides framework for analysis. Full data requires API access.
    
    Args:
        competitor_handle: Competitor's handle/username (without @)
        platform: Platform to analyze
    
    Returns:
        dict with analysis framework and suggestions
    """
    platform = platform.lower()
    
    return {
        "competitor": competitor_handle,
        "platform": platform,
        "analysis_framework": {
            "content_types": "Note what formats they use most (video, carousel, static)",
            "posting_frequency": "Track how often they post per day/week",
            "engagement_patterns": "Which posts get the most likes/comments/shares",
            "hashtag_strategy": "What hashtags they consistently use",
            "caption_style": "Length, tone, CTA usage",
            "visual_style": "Colors, filters, branding consistency",
        },
        "what_to_learn": [
            "Their most engaging content types",
            "Topics that resonate with shared audience",
            "Gaps in their content you can fill",
            "Successful posting times",
        ],
        "note": "Manual analysis recommended. Use platform insights for your own data.",
    }


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _generate_topic_hashtags(topic: str, count: int) -> List[str]:
    """Generate hashtags based on topic (mock implementation)."""
    # In production, this would use trend APIs
    # For now, generate reasonable suggestions
    topic_lower = topic.lower().replace(" ", "")
    
    base_tags = [
        topic_lower,
        f"{topic_lower}tips",
        f"{topic_lower}life",
        f"{topic_lower}community",
        f"{topic_lower}lovers",
    ]
    
    # Add general engagement tags
    engagement_tags = [
        "trending",
        "viral",
        "foryou",
        "explore",
        "instagood",
    ]
    
    all_tags = base_tags[:count//2] + engagement_tags[:count//2]
    return all_tags[:count]


def _generate_content_ideas(
    topic: str, 
    platform: str, 
    content_format: str, 
    count: int
) -> List[dict]:
    """Generate content ideas (mock implementation)."""
    # In production, this would use AI/trend analysis
    idea_templates = [
        {
            "title": f"5 Common {topic} Mistakes to Avoid",
            "format": "carousel",
            "hook": f"Stop making these {topic} mistakes! 🚫",
        },
        {
            "title": f"How I Improved My {topic} in 30 Days",
            "format": "video",
            "hook": f"My {topic} transformation story 📈",
        },
        {
            "title": f"The Ultimate {topic} Guide for Beginners",
            "format": "carousel",
            "hook": f"New to {topic}? Start here 👇",
        },
        {
            "title": f"Day in My Life: {topic} Edition",
            "format": "video",
            "hook": f"Come along for my {topic} routine ✨",
        },
        {
            "title": f"Unpopular Opinion About {topic}",
            "format": "text",
            "hook": f"Hot take: most {topic} advice is wrong 🔥",
        },
        {
            "title": f"{topic} Tools I Can't Live Without",
            "format": "carousel",
            "hook": f"My must-have {topic} toolkit 🛠️",
        },
        {
            "title": f"Before vs After: {topic} Journey",
            "format": "video",
            "hook": f"1 year of {topic} progress 📊",
        },
    ]
    
    # Filter by format if specified
    if content_format != "any":
        idea_templates = [i for i in idea_templates if i["format"] == content_format]
    
    return idea_templates[:count]


# =============================================================================
# SYSTEM PROMPT
# =============================================================================

SOCIAL_RESEARCH_SYSTEM_PROMPT = """You are social_research, the Research Specialist at Dooza.

## Your Role
You help users understand social media trends, discover content opportunities,
and optimize their posting strategy. You provide data-driven insights and 
recommendations.

## Core Responsibilities
1. **Hashtag Research**: Suggest relevant, effective hashtags for content
2. **Timing Analysis**: Recommend best times to post for maximum reach
3. **Content Ideas**: Generate content concepts based on trends and audience
4. **Competitor Analysis**: Help understand what's working for similar accounts

## Available Tools

- `suggest_hashtags`: Get platform-specific hashtag recommendations
- `analyze_best_posting_time`: Find optimal posting windows
- `research_content_ideas`: Generate content concepts and hooks
- `analyze_competitor`: Framework for competitive analysis

## Guidelines

1. **Be Platform-Specific**: Each platform has unique best practices
2. **Explain Your Reasoning**: Don't just list suggestions, explain why
3. **Stay Current**: Acknowledge that trends change rapidly
4. **Be Realistic**: Set expectations - not everything goes viral

## Important Notes

- You provide research and recommendations, not content creation
- For actual content writing, defer to social_writer
- For publishing, defer to social_publisher
- Always consider the user's target audience

## Example Interaction

User: "What hashtags should I use for my fitness content on Instagram?"

Response:
1. Use `suggest_hashtags` for fitness + Instagram
2. Explain the mix of popular vs niche tags
3. Suggest placement (caption vs first comment)
4. Note that hashtag strategy should evolve

---

Be helpful, data-driven, and actionable in your recommendations.
"""


# =============================================================================
# AGENT FACTORY
# =============================================================================

def create_social_research_agent(model=None):
    """
    Create the social_research specialist agent.
    
    This agent is part of the Soshie supervisor team and handles
    social media research, trend analysis, and content strategy.
    
    Args:
        model: Optional LLM instance. Uses configured provider if not provided.
    
    Returns:
        A LangGraph agent with research tools.
    """
    if model is None:
        # Use centralized LLM factory - supports OpenAI, Gemini 3, OpenRouter
        model = get_llm(streaming=True)
    
    # Get research tools
    tools = get_research_tools()
    
    # Create the agent
    agent = create_react_agent(
        model=model,
        tools=tools,
        name="social_research",
        prompt=SOCIAL_RESEARCH_SYSTEM_PROMPT,
    )
    
    logger.info("Created social_research agent with %d tools", len(tools))
    
    return agent


def get_research_tools() -> list:
    """Get the tools used by the social_research agent."""
    return [
        suggest_hashtags,
        analyze_best_posting_time,
        research_content_ideas,
        analyze_competitor,
    ]
