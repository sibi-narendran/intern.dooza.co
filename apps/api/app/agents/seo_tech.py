"""
SEO Technical Specialist Agent

Uses create_react_agent from langgraph.prebuilt for the standard LangGraph pattern.
This agent handles technical SEO analysis tasks.
"""

from __future__ import annotations

import logging

from langgraph.prebuilt import create_react_agent

from app.agents.base import get_llm
from app.tools.seo import get_seo_tools

logger = logging.getLogger(__name__)


# =============================================================================
# SYSTEM PROMPT
# =============================================================================

SEO_TECH_SYSTEM_PROMPT = """You are seo-tech, the Technical SEO Specialist at Dooza.

## Your Role
You handle technical SEO analysis tasks delegated by SEOmi, the SEO Lead.
You have direct access to tools for analyzing websites.

## Your Tools
- seo_analyze_url: Comprehensive page audit (meta tags, headings, images, keywords)
- seo_audit_meta_tags: Detailed meta tag analysis
- seo_analyze_headings: Heading structure analysis
- seo_check_images: Image alt tag audit
- seo_extract_keywords: Keyword extraction from page content

## How You Work
1. Receive a task from SEOmi
2. Use your tools to gather data
3. Return the results - SEOmi will interpret them for the user

## Important
- Always use tools when asked to analyze a URL
- Return structured data from tools
- Do NOT make up data - only report what tools return
- If a tool fails, report the error clearly

## Current Capabilities (Available Now)
- Single page analysis (meta tags, headings, images, keywords)

## Coming Soon
- Site-wide crawling
- Core Web Vitals / PageSpeed analysis
- Robots.txt and sitemap validation
- Schema markup validation
- Broken link detection
"""


# =============================================================================
# AGENT FACTORY
# =============================================================================

def create_seo_tech_agent(model=None):
    """
    Create the seo-tech specialist agent using create_react_agent.
    
    This is the standard LangGraph pattern for tool-using agents.
    
    Args:
        model: Optional LLM instance. If not provided, uses configured provider.
        
    Returns:
        A compiled LangGraph agent ready for invocation.
    """
    if model is None:
        # Use centralized LLM factory - supports OpenAI, Gemini 3, OpenRouter
        model = get_llm(streaming=True)
    
    # Get SEO tools
    tools = get_seo_tools()
    
    # Create the agent using LangGraph's create_react_agent
    agent = create_react_agent(
        model=model,
        tools=tools,
        name="seo_tech",
        prompt=SEO_TECH_SYSTEM_PROMPT,
    )
    
    logger.info("Created seo_tech agent with %d tools", len(tools))
    
    return agent


# =============================================================================
# CONVENIENCE EXPORT
# =============================================================================

# Pre-create a default agent for import
def get_seo_tech_agent():
    """Get or create the seo-tech agent."""
    return create_seo_tech_agent()
