"""
SEO Analytics Specialist Agent

Uses LangGraph's create_react_agent for standard ReAct pattern.
This agent handles analytics and data-focused SEO tasks.

Note: Tools are under development. Requires GSC/GA integrations.
"""

from langchain_openai import ChatOpenAI
from langchain.agents import create_agent  # Standard LangGraph V1.0+ import

from app.config import get_settings


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

def create_seo_analytics_agent(model: ChatOpenAI | None = None):
    """
    Create the seo-analytics specialist agent using LangGraph's create_react_agent.
    
    Note: Currently has no tools - requires integrations.
    
    Args:
        model: Optional ChatOpenAI instance. If not provided, uses default.
        
    Returns:
        A compiled LangGraph agent ready for invocation.
    """
    if model is None:
        settings = get_settings()
        model = ChatOpenAI(
            api_key=settings.openai_api_key,  # Explicitly pass API key from settings
            model=settings.openai_model or "gpt-4o-mini",
            temperature=0.5,
            streaming=True,
        )
    
    # No tools yet - requires integrations
    tools = []
    
    # Create the agent using LangGraph's standard pattern
    agent = create_agent(
        model=model,
        tools=tools,
        name="seo_analytics",
        system_prompt=SEO_ANALYTICS_SYSTEM_PROMPT,
    )
    
    return agent


# =============================================================================
# CONVENIENCE EXPORT
# =============================================================================

def get_seo_analytics_agent():
    """Get or create the seo-analytics agent."""
    return create_seo_analytics_agent()
