"""
Research Tools for the Research Subagent

These tools are used autonomously by the Research subagent to gather
information for content strategy decisions.

Tools:
- get_brand_context: Load brand settings from knowledge base
- search_trends: Find trending topics for a platform
- get_competitor_insights: Get competitor content examples

Usage:
    These tools are registered with the Research subagent, not Soshie directly.
    The Research subagent decides when and how to call them.
"""

from __future__ import annotations

import logging
from typing import Optional

from langchain_core.tools import tool

from app.tools.task import get_agent_context

logger = logging.getLogger(__name__)


# =============================================================================
# BRAND CONTEXT TOOL
# =============================================================================

@tool
async def get_brand_context() -> dict:
    """
    Load brand settings from the knowledge base.
    
    This should be called FIRST in any research session to understand
    the brand's voice, industry, and target audience.
    
    Returns:
        dict with:
        - brand_name: Business name
        - brand_voice: Tone of voice (professional, casual, etc.)
        - industry: Business industry
        - description: Brand description
        - value_proposition: What the brand offers
        - target_audience: Who the brand serves
        - colors: Brand colors (if set)
        - social_links: Connected social profiles
    """
    from app.services.knowledge_service import get_knowledge_service
    
    ctx = get_agent_context()
    if not ctx:
        logger.warning("No agent context - returning empty brand context")
        return {
            "error": "no_context",
            "message": "Could not determine user - please try again"
        }
    
    user_id = ctx.user_id
    service = get_knowledge_service()
    
    try:
        org_id = await service.get_user_org_id(user_id)
        if not org_id:
            return {
                "error": "no_organization",
                "message": "No organization found. Please set up your brand in the Brain tab first.",
                "brand_name": "Unknown",
                "brand_voice": "professional",
            }
        
        brand = await service.get_brand_settings(org_id)
        
        return {
            "brand_name": brand.business_name or "Your Brand",
            "brand_voice": brand.brand_voice or "professional",
            "industry": brand.industry,
            "description": brand.description,
            "value_proposition": brand.value_proposition,
            "target_audience": brand.target_audience,
            "tagline": brand.tagline,
            "website": brand.website,
            "colors": brand.colors or {},
            "social_links": brand.social_links or {},
        }
        
    except Exception as e:
        logger.error(f"Failed to load brand context: {e}")
        return {
            "error": "load_failed",
            "message": f"Could not load brand settings: {str(e)}",
            "brand_name": "Unknown",
            "brand_voice": "professional",
        }


# =============================================================================
# TRENDS SEARCH TOOL
# =============================================================================

@tool
async def search_trends(
    topic: str,
    platform: str = "linkedin"
) -> dict:
    """
    Search for trending topics related to a subject on a specific platform.
    
    Use this to find timely content angles that resonate with current trends.
    
    Args:
        topic: The topic area to search (e.g., "AI", "productivity", "marketing")
        platform: Target platform (linkedin, instagram, twitter, tiktok, facebook)
    
    Returns:
        dict with:
        - trends: List of trending topics/angles
        - hashtags: Popular hashtags for this topic
        - timing: Best times to post about this
        - notes: Additional insights
    """
    # For now, return curated insights based on platform
    # In production, this could call external APIs:
    # - Google Trends API
    # - Platform-specific trend APIs
    # - Social listening tools
    
    platform_insights = {
        "linkedin": {
            "content_types": ["thought leadership", "industry insights", "career advice", "company updates"],
            "best_times": ["Tuesday-Thursday 8-10am", "Tuesday 10am-12pm"],
            "hashtag_limit": "3-5 hashtags",
            "tone": "Professional, insightful, data-driven",
        },
        "instagram": {
            "content_types": ["behind-the-scenes", "tips & tutorials", "user-generated content", "reels"],
            "best_times": ["Monday-Friday 11am-1pm", "Tuesday 11am-2pm"],
            "hashtag_limit": "10-15 hashtags",
            "tone": "Visual-first, casual, authentic",
        },
        "twitter": {
            "content_types": ["threads", "hot takes", "news commentary", "quick tips"],
            "best_times": ["Monday-Friday 8am-4pm", "Wednesday 9am"],
            "hashtag_limit": "1-2 hashtags",
            "tone": "Concise, timely, engaging",
        },
        "tiktok": {
            "content_types": ["educational", "entertaining", "trending sounds", "challenges"],
            "best_times": ["Tuesday 9am", "Thursday 12pm", "Friday 5am"],
            "hashtag_limit": "3-5 hashtags",
            "tone": "Authentic, entertaining, trend-aware",
        },
        "facebook": {
            "content_types": ["community posts", "live videos", "stories", "group content"],
            "best_times": ["Monday-Friday 1-4pm", "Wednesday 12pm"],
            "hashtag_limit": "2-3 hashtags",
            "tone": "Community-focused, conversational",
        },
    }
    
    # Topic-specific trending angles (curated knowledge)
    topic_trends = {
        "ai": [
            "AI tools replacing manual tasks",
            "Ethical AI concerns",
            "AI in everyday work",
            "ChatGPT and productivity",
            "AI automation success stories",
        ],
        "productivity": [
            "Work-life balance tips",
            "Time blocking methods",
            "Remote work productivity",
            "Tool recommendations",
            "Morning routine optimization",
        ],
        "marketing": [
            "AI in marketing",
            "Content repurposing strategies",
            "Short-form video dominance",
            "Authentic brand storytelling",
            "Community-led growth",
        ],
        "startup": [
            "Founder mental health",
            "Bootstrapping vs fundraising",
            "Product-market fit stories",
            "Team building challenges",
            "Pivot success stories",
        ],
    }
    
    platform_data = platform_insights.get(platform.lower(), platform_insights["linkedin"])
    
    # Find relevant trends for the topic
    topic_lower = topic.lower()
    relevant_trends = []
    for key, trends in topic_trends.items():
        if key in topic_lower or topic_lower in key:
            relevant_trends.extend(trends)
    
    if not relevant_trends:
        relevant_trends = [
            f"{topic} best practices",
            f"Common {topic} mistakes",
            f"{topic} trends for 2024",
            f"How to improve {topic}",
        ]
    
    return {
        "topic": topic,
        "platform": platform,
        "trends": relevant_trends[:5],
        "platform_insights": platform_data,
        "suggested_hashtags": [
            f"#{topic.replace(' ', '')}",
            f"#{platform}marketing" if platform != "linkedin" else "#linkedintips",
        ],
        "timing": platform_data["best_times"],
        "notes": f"Focus on {platform_data['tone']} content. {platform_data['hashtag_limit']} recommended.",
    }


# =============================================================================
# COMPETITOR INSIGHTS TOOL
# =============================================================================

@tool
async def get_competitor_insights(
    industry: str,
    platform: str = "linkedin"
) -> dict:
    """
    Get insights about competitor content in a specific industry.
    
    Use this to understand what content works well in the industry
    and find opportunities for differentiation.
    
    Args:
        industry: The industry to research (e.g., "SaaS", "E-commerce", "Healthcare")
        platform: Target platform for insights
    
    Returns:
        dict with:
        - common_themes: Topics competitors frequently cover
        - content_gaps: Underserved topics (opportunities)
        - engagement_patterns: What drives engagement in this industry
        - differentiation_tips: How to stand out
    """
    # Curated industry insights
    # In production, this could pull from:
    # - Competitor analysis databases
    # - Social listening tools
    # - Content performance analytics
    
    industry_insights = {
        "saas": {
            "common_themes": [
                "Product feature announcements",
                "Customer success stories",
                "Industry trend analysis",
                "How-to tutorials",
                "Thought leadership",
            ],
            "content_gaps": [
                "Behind-the-scenes team content",
                "Honest failure stories",
                "Unfiltered founder perspectives",
                "Customer interview series",
            ],
            "engagement_drivers": [
                "Specific metrics and results",
                "Controversial opinions",
                "Personal storytelling",
                "Interactive polls",
            ],
            "differentiation_tips": [
                "Share real numbers (revenue, users, growth)",
                "Be vulnerable about challenges",
                "Create recurring content series",
                "Engage actively in comments",
            ],
        },
        "ecommerce": {
            "common_themes": [
                "Product showcases",
                "Sales and promotions",
                "Customer reviews",
                "Lifestyle content",
            ],
            "content_gaps": [
                "Sustainability practices",
                "Product sourcing stories",
                "Team and culture content",
                "Educational content",
            ],
            "engagement_drivers": [
                "User-generated content",
                "Limited-time offers",
                "Behind-the-scenes",
                "Interactive shopping",
            ],
            "differentiation_tips": [
                "Tell your brand story",
                "Show your values in action",
                "Create community",
                "Educate, don't just sell",
            ],
        },
        "default": {
            "common_themes": [
                "Industry news",
                "Tips and advice",
                "Company updates",
                "Customer stories",
            ],
            "content_gaps": [
                "Personal founder stories",
                "Industry predictions",
                "Controversial takes",
                "Educational deep-dives",
            ],
            "engagement_drivers": [
                "Authenticity",
                "Timeliness",
                "Value-first approach",
                "Strong CTAs",
            ],
            "differentiation_tips": [
                "Find your unique voice",
                "Be consistent",
                "Engage with your community",
                "Test different formats",
            ],
        },
    }
    
    # Match industry to insights
    industry_lower = industry.lower()
    insights = industry_insights.get("default")
    
    for key, data in industry_insights.items():
        if key in industry_lower or industry_lower in key:
            insights = data
            break
    
    return {
        "industry": industry,
        "platform": platform,
        "common_themes": insights["common_themes"],
        "content_gaps": insights["content_gaps"],
        "engagement_drivers": insights["engagement_drivers"],
        "differentiation_tips": insights["differentiation_tips"],
        "recommendation": f"Focus on {insights['content_gaps'][0]} - it's underserved in {industry}",
    }


# =============================================================================
# TOOL EXPORTS
# =============================================================================

RESEARCH_TOOLS = [
    get_brand_context,
    search_trends,
    get_competitor_insights,
]
