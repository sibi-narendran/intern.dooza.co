"""
SEO Content Specialist Agent

Uses LangGraph's create_react_agent for standard ReAct pattern.
This agent handles content-focused SEO tasks.

Note: Tools are under development. Agent currently provides guidance only.
"""

from langchain_openai import ChatOpenAI
from langchain.agents import create_agent  # Standard LangGraph V1.0+ import

from app.config import get_settings


# =============================================================================
# SYSTEM PROMPT
# =============================================================================

SEO_CONTENT_SYSTEM_PROMPT = """You are seo-content, the Content SEO Specialist at Dooza.

## Your Role
You handle content-focused SEO tasks delegated by SEOmi, the SEO Lead.
You specialize in keyword research, content strategy, and content optimization.

## Current Status
**My content SEO tools are currently under development.**

When asked to perform a task, I will:
1. Acknowledge the task
2. Explain what I WOULD do once my tools are ready
3. Provide general guidance based on SEO best practices

## Capabilities Coming Soon
- Keyword research (search volume, difficulty, CPC, trends)
- SERP analysis (who ranks, why, featured snippets)
- Content gap analysis vs competitors
- Topic clustering and content planning
- Content briefs generation
- Keyword cannibalization detection

## What I Can Do Now
- Provide general SEO content advice
- Explain content optimization best practices
- Suggest content structure approaches
- Discuss keyword targeting strategies

## Important
- Be honest that tools are not yet available
- Provide helpful guidance within my current limitations
- SEOmi will relay my status to the user
"""


# =============================================================================
# AGENT FACTORY
# =============================================================================

def create_seo_content_agent(model: ChatOpenAI | None = None):
    """
    Create the seo-content specialist agent using LangGraph's create_react_agent.
    
    Note: Currently has no tools - under development.
    
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
    
    # No tools yet - under development
    tools = []
    
    # Create the agent using LangGraph's standard pattern
    agent = create_agent(
        model=model,
        tools=tools,
        name="seo_content",
        system_prompt=SEO_CONTENT_SYSTEM_PROMPT,
    )
    
    return agent


# =============================================================================
# CONVENIENCE EXPORT
# =============================================================================

def get_seo_content_agent():
    """Get or create the seo-content agent."""
    return create_seo_content_agent()
