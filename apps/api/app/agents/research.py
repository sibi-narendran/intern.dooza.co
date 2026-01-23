"""
Research Subagent

A true subagent with its own ReAct loop that autonomously researches
brand context, trends, and competitor insights to recommend content strategy.

This subagent is invoked by Soshie via the research_for_content tool.
It decides which research tools to call and synthesizes findings into
a structured ContentResearchResult.

Architecture:
    Soshie → research_for_content tool → Research Agent → returns result → Soshie

The Research Agent has its own tools:
- get_brand_context: Load brand from knowledge base
- search_trends: Find trending topics
- get_competitor_insights: Analyze competitors

Usage:
    from app.agents.research import create_research_agent
    
    agent = create_research_agent()
    result = await agent.ainvoke({"messages": [HumanMessage(...)]})
"""

from __future__ import annotations

import logging
from typing import Optional

from langchain.agents import create_agent
from langgraph.checkpoint.base import BaseCheckpointSaver

from app.agents.base import get_llm
from app.tools.research_tools import RESEARCH_TOOLS

logger = logging.getLogger(__name__)


# =============================================================================
# SYSTEM PROMPT
# =============================================================================

RESEARCH_SYSTEM_PROMPT = """You are a Content Research Specialist working as part of the Dooza social media team.

## Your Role
You research and analyze brand context, trends, and competitor strategies to recommend content ideas for social media posts.

## Your Tools

### 1. get_brand_context
**ALWAYS call this first.** Loads the brand's settings from the knowledge base.
Returns: brand name, voice, industry, description, target audience, values.

### 2. search_trends
Search for trending topics related to a subject on a specific platform.
Parameters:
- topic: What to search (e.g., "AI", "productivity")
- platform: Target platform (linkedin, instagram, twitter, tiktok, facebook)
Returns: trending angles, hashtags, best posting times.

### 3. get_competitor_insights
Get insights about what competitors in an industry are posting.
Parameters:
- industry: The industry (e.g., "SaaS", "E-commerce")
- platform: Target platform
Returns: common themes, content gaps, differentiation tips.

## Your Process

1. **ALWAYS start with get_brand_context** - You need to understand the brand first
2. **Then search_trends** - Find what's relevant and timely for the topic/platform
3. **Optionally get_competitor_insights** - If you need differentiation ideas

## Your Output

After gathering data, synthesize your findings into a recommendation.
Your final message should include:

1. **Brand Summary**: Key aspects of the brand voice and audience
2. **Content Ideas**: 2-3 specific content ideas with hooks and key points
3. **Recommended Idea**: Which one you think is best and why
4. **Content Brief**: Detailed instructions for creating the recommended content
5. **Image Suggestion**: If visual content is appropriate, describe what image would work
6. **Reasoning**: Why this strategy fits the brand and current trends

## Important Guidelines

- Be specific in your recommendations - vague advice is not helpful
- Consider platform-specific best practices
- Align content with brand voice and values
- Think about timing and relevance
- Suggest hashtags appropriate to the platform
"""


# =============================================================================
# AGENT FACTORY
# =============================================================================

def create_research_agent(
    model=None,
    checkpointer: Optional[BaseCheckpointSaver] = None
):
    """
    Create the Research subagent.
    
    This is a full ReAct agent with its own tools that can autonomously
    decide what research to perform.
    
    Args:
        model: Optional LLM instance. If not provided, uses configured provider.
        checkpointer: Optional checkpointer (usually None for subagents).
        
    Returns:
        A compiled LangGraph agent ready for invocation.
    """
    if model is None:
        # Use non-streaming for subagent (results go to parent, not user)
        model = get_llm(streaming=False)
    
    agent = create_agent(
        model=model,
        tools=RESEARCH_TOOLS,
        name="research",
        system_prompt=RESEARCH_SYSTEM_PROMPT,
        checkpointer=checkpointer,
    )
    
    logger.info(
        "Created research subagent with %d tools: %s",
        len(RESEARCH_TOOLS),
        [t.name for t in RESEARCH_TOOLS]
    )
    
    return agent


# =============================================================================
# CONVENIENCE EXPORT
# =============================================================================

def get_research_agent(checkpointer: Optional[BaseCheckpointSaver] = None):
    """
    Get or create the Research subagent.
    
    Note: Unlike Soshie, Research typically doesn't need a checkpointer
    since it's invoked fresh for each research request.
    """
    return create_research_agent(checkpointer=checkpointer)
