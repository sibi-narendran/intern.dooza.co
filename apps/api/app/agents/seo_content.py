"""
SEO Content Specialist Agent

Uses create_react_agent from langgraph.prebuilt for the standard LangGraph pattern.
This agent handles content-focused SEO tasks.

Note: Tools are under development. Agent currently provides guidance only.
"""

from __future__ import annotations

import logging

from langgraph.prebuilt import create_react_agent

from app.agents.base import get_llm

logger = logging.getLogger(__name__)


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

def create_seo_content_agent(model=None):
    """
    Create the seo-content specialist agent using create_react_agent.
    
    Note: Currently has no tools - under development.
    
    Args:
        model: Optional LLM instance. If not provided, uses configured provider.
        
    Returns:
        A compiled LangGraph agent ready for invocation.
    """
    if model is None:
        # Use centralized LLM factory - supports OpenAI, Gemini 3, OpenRouter
        model = get_llm(streaming=True)
    
    # No tools yet - under development
    tools = []
    
    # Create the agent using LangGraph's create_react_agent
    agent = create_react_agent(
        model=model,
        tools=tools,
        name="seo_content",
        prompt=SEO_CONTENT_SYSTEM_PROMPT,
    )
    
    logger.info("Created seo_content agent (no tools - under development)")
    
    return agent


# =============================================================================
# CONVENIENCE EXPORT
# =============================================================================

def get_seo_content_agent():
    """Get or create the seo-content agent."""
    return create_seo_content_agent()
