"""
SEO Analytics Specialist Agent

Uses create_react_agent from langgraph.prebuilt for the standard LangGraph pattern.
This agent handles analytics and data-focused SEO tasks.

Note: Tools are under development. Requires GSC/GA integrations.
"""

from __future__ import annotations

import logging

from langgraph.prebuilt import create_react_agent

from app.agents.base import get_llm

logger = logging.getLogger(__name__)


# =============================================================================
# SYSTEM PROMPT
# =============================================================================

SEO_ANALYTICS_SYSTEM_PROMPT = """You are seo-analytics, the Analytics SEO Specialist at Dooza.

## Your Role
You handle analytics and data-focused SEO tasks delegated by SEOmi, the SEO Lead.
You specialize in search performance data, rankings, and traffic analysis.

## Current Status
**My analytics tools are currently under development.**
**These tools require Google Search Console and Google Analytics integrations.**

When asked to perform a task, I will:
1. Acknowledge the task
2. Explain what I WOULD do once my tools and integrations are ready
3. Suggest that the user connect their GSC/GA accounts

## Capabilities Coming Soon (Requires Integrations)
- Google Search Console data (impressions, clicks, CTR, positions)
- Google Analytics organic traffic data
- Keyword ranking tracking over time
- Index coverage monitoring
- Competitor traffic estimates
- Backlink profile analysis (requires Ahrefs/Moz integration)

## What I Can Do Now
- Explain what metrics to track
- Guide users on setting up GSC/GA
- Discuss SEO performance analysis approaches
- Suggest KPIs for SEO campaigns

## Important
- Be honest that tools/integrations are not yet available
- Encourage users to connect their accounts for future capabilities
- SEOmi will relay my status to the user
"""


# =============================================================================
# AGENT FACTORY
# =============================================================================

def create_seo_analytics_agent(model=None):
    """
    Create the seo-analytics specialist agent using create_react_agent.
    
    Note: Currently has no tools - requires GSC/GA integrations.
    
    Args:
        model: Optional LLM instance. If not provided, uses configured provider.
        
    Returns:
        A compiled LangGraph agent ready for invocation.
    """
    if model is None:
        # Use centralized LLM factory - supports OpenAI, Gemini 3, OpenRouter
        model = get_llm(streaming=True)
    
    # No tools yet - requires integrations
    tools = []
    
    # Create the agent using LangGraph's create_react_agent
    agent = create_react_agent(
        model=model,
        tools=tools,
        name="seo_analytics",
        prompt=SEO_ANALYTICS_SYSTEM_PROMPT,
    )
    
    logger.info("Created seo_analytics agent (no tools - requires integrations)")
    
    return agent


# =============================================================================
# CONVENIENCE EXPORT
# =============================================================================

def get_seo_analytics_agent():
    """Get or create the seo-analytics agent."""
    return create_seo_analytics_agent()
