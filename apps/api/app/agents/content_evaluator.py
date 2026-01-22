"""
Content Evaluator Agent

Dedicated evaluator for the content creation workflow.
Uses structured output to grade content quality across multiple dimensions.

This evaluator is used by the content workflow's evaluate-refine loop
to determine if content meets quality standards or needs improvement.

Evaluation Criteria:
- Platform Fit: Does it follow platform conventions?
- Engagement Potential: Will it get likes/comments/shares?
- Clarity: Is the message clear and readable?
- CTA Effectiveness: Does it have a compelling call-to-action?

Note: ContentFeedback schema is defined in schemas/content_workflow.py
      to avoid duplication. This module re-exports it for convenience.
"""

from __future__ import annotations

import logging
from typing import List

from langchain_core.messages import HumanMessage

from app.agents.base import get_llm
from app.schemas.content_workflow import ContentFeedback  # Single source of truth

logger = logging.getLogger(__name__)


# =============================================================================
# PLATFORM-SPECIFIC CRITERIA
# =============================================================================

PLATFORM_CRITERIA = {
    "linkedin": {
        "tone": "Professional, thought-leadership focused",
        "length": "150-300 words optimal",
        "structure": "Hook in first line, clear paragraphs, ends with question/CTA",
        "hashtags": "3-5 professional hashtags",
        "red_flags": [
            "Too casual or emoji-heavy",
            "Over 3000 characters",
            "No clear value proposition",
            "Missing call-to-action",
        ],
    },
    "twitter": {
        "tone": "Engaging, punchy, conversational",
        "length": "Max 280 characters per tweet",
        "structure": "Strong hook, clear point, 1-2 hashtags",
        "hashtags": "1-2 highly relevant tags",
        "red_flags": [
            "Exceeds 280 characters",
            "Too many hashtags (3+)",
            "No hook in first line",
            "Boring/generic opening",
        ],
    },
    "instagram": {
        "tone": "Authentic, visual-first mindset",
        "length": "125-150 chars for engagement, can go up to 2200",
        "structure": "Front-load important info, use line breaks, emoji strategy",
        "hashtags": "10-30 hashtags (in caption or first comment)",
        "red_flags": [
            "Over 2200 characters",
            "Wall of text without line breaks",
            "No visual context reference",
            "Missing emojis entirely",
        ],
    },
    "tiktok": {
        "tone": "Casual, trendy, authentic",
        "length": "Short and punchy, max 2200 chars",
        "structure": "Hook in first 3 seconds concept, value prop, CTA",
        "hashtags": "3-5 including trending",
        "red_flags": [
            "Too formal or corporate",
            "No trend awareness",
            "Weak hook",
            "Too long-winded",
        ],
    },
    "facebook": {
        "tone": "Community-focused, shareable",
        "length": "40-80 chars for engagement (can be longer)",
        "structure": "Engaging opening, value, clear CTA",
        "hashtags": "1-2 max (less important on Facebook)",
        "red_flags": [
            "Too promotional",
            "No engagement hook",
            "Hashtag overuse",
            "No shareable element",
        ],
    },
}


# =============================================================================
# EVALUATOR FUNCTIONS
# =============================================================================

def get_evaluation_prompt(platform: str, content: str) -> str:
    """
    Generate platform-specific evaluation prompt.
    
    Args:
        platform: Target platform (linkedin, twitter, etc.)
        content: The content to evaluate
        
    Returns:
        Formatted evaluation prompt
    """
    criteria = PLATFORM_CRITERIA.get(platform.lower(), PLATFORM_CRITERIA["linkedin"])
    
    return f"""You are a social media content quality evaluator. 
Evaluate this {platform.upper()} post against platform best practices.

CONTENT TO EVALUATE:
---
{content}
---

EVALUATION CRITERIA FOR {platform.upper()}:
- Tone: {criteria['tone']}
- Length: {criteria['length']}
- Structure: {criteria['structure']}
- Hashtags: {criteria['hashtags']}

RED FLAGS TO CHECK:
{chr(10).join(f'- {flag}' for flag in criteria['red_flags'])}

SCORING (1-10 for each):
1. Platform Fit: Does it follow {platform} conventions and best practices?
2. Engagement Potential: Will it get likes, comments, shares?
3. Clarity: Is the message clear and easy to understand?
4. CTA Effectiveness: Does it have a compelling call-to-action?

GRADING:
- "pass" if average score is 7+ AND no major red flags
- "needs_improvement" if average score is below 7 OR has major issues

Respond in this exact JSON format:
{{
    "grade": "pass" or "needs_improvement",
    "platform_fit_score": <1-10>,
    "engagement_score": <1-10>,
    "clarity_score": <1-10>,
    "cta_score": <1-10>,
    "feedback": "<2-3 sentences of specific improvement suggestions>",
    "issues": ["<issue 1>", "<issue 2>"]
}}

Be specific in your feedback. If there are red flags, list them in issues.
"""


async def evaluate_content(
    content: str,
    platform: str = "linkedin",
    model=None,
) -> ContentFeedback:
    """
    Evaluate content quality for a specific platform.
    
    Args:
        content: The content text to evaluate
        platform: Target platform
        model: Optional LLM instance (uses default if not provided)
        
    Returns:
        ContentFeedback with scores and suggestions
    """
    if model is None:
        model = get_llm(streaming=False)
    
    prompt = get_evaluation_prompt(platform, content)
    
    try:
        response = await model.ainvoke([HumanMessage(content=prompt)])
        
        # Parse JSON response
        import json
        content_str = response.content.strip()
        
        # Extract JSON from response
        start = content_str.find('{')
        end = content_str.rfind('}') + 1
        
        if start != -1 and end > start:
            json_str = content_str[start:end]
            data = json.loads(json_str)
            
            return ContentFeedback(
                grade=data.get("grade", "pass"),
                platform_fit_score=data.get("platform_fit_score", 7),
                engagement_score=data.get("engagement_score", 7),
                clarity_score=data.get("clarity_score", 7),
                cta_score=data.get("cta_score", 7),
                feedback=data.get("feedback", ""),
                issues=data.get("issues", []),
            )
        else:
            logger.warning("Could not parse evaluation response as JSON")
            return _default_feedback()
            
    except Exception as e:
        logger.error(f"Error evaluating content: {e}")
        return _default_feedback()


def evaluate_content_sync(
    content: str,
    platform: str = "linkedin",
    model=None,
) -> ContentFeedback:
    """
    Synchronous version of evaluate_content.
    
    For use in non-async contexts.
    """
    import asyncio
    return asyncio.run(evaluate_content(content, platform, model))


def _default_feedback() -> ContentFeedback:
    """Return default passing feedback when evaluation fails."""
    return ContentFeedback(
        grade="pass",
        platform_fit_score=7,
        engagement_score=7,
        clarity_score=7,
        cta_score=7,
        feedback="Evaluation completed.",
        issues=[],
    )


# =============================================================================
# QUICK EVALUATION (NO LLM)
# =============================================================================

def quick_evaluate(content: str, platform: str = "linkedin") -> ContentFeedback:
    """
    Quick rule-based evaluation without LLM.
    
    Useful for fast checks or when LLM is unavailable.
    Checks basic criteria like length, hashtag count, etc.
    """
    criteria = PLATFORM_CRITERIA.get(platform.lower(), PLATFORM_CRITERIA["linkedin"])
    issues = []
    
    # Length checks
    content_length = len(content)
    if platform == "twitter" and content_length > 280:
        issues.append(f"Exceeds Twitter limit: {content_length}/280 chars")
    elif platform == "linkedin" and content_length > 3000:
        issues.append(f"Exceeds LinkedIn limit: {content_length}/3000 chars")
    elif platform == "instagram" and content_length > 2200:
        issues.append(f"Exceeds Instagram limit: {content_length}/2200 chars")
    
    # Hashtag checks
    hashtag_count = content.count('#')
    if platform == "twitter" and hashtag_count > 2:
        issues.append(f"Too many hashtags for Twitter: {hashtag_count}")
    elif platform == "facebook" and hashtag_count > 3:
        issues.append(f"Too many hashtags for Facebook: {hashtag_count}")
    
    # Basic content checks
    word_count = len(content.split())
    if word_count < 10:
        issues.append("Content too short")
    
    # Check for CTA indicators
    cta_indicators = ['?', 'comment', 'share', 'like', 'follow', 'click', 'link', 'check', 'learn']
    has_cta = any(indicator in content.lower() for indicator in cta_indicators)
    if not has_cta:
        issues.append("No clear call-to-action detected")
    
    # Calculate scores based on issues
    base_score = 8
    score_penalty = min(len(issues), 3)  # Max 3 point penalty
    
    final_score = max(5, base_score - score_penalty)
    
    return ContentFeedback(
        grade="pass" if final_score >= 7 and len(issues) < 2 else "needs_improvement",
        platform_fit_score=final_score,
        engagement_score=final_score,
        clarity_score=final_score + 1 if word_count > 20 else final_score,
        cta_score=final_score + 1 if has_cta else final_score - 1,
        feedback=f"Quick evaluation found {len(issues)} potential issues." if issues else "Content looks good!",
        issues=issues,
    )


# =============================================================================
# EXPORTS
# =============================================================================

__all__ = [
    "ContentFeedback",
    "PLATFORM_CRITERIA",
    "evaluate_content",
    "evaluate_content_sync",
    "quick_evaluate",
    "get_evaluation_prompt",
]
