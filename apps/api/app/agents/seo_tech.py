"""
SEO Technical Specialist Agent

Uses create_agent from langchain.agents for the standard LangGraph v1.0+ agent pattern.
This agent handles technical SEO analysis tasks.
"""

from langchain_openai import ChatOpenAI
from langchain.agents import create_agent  # Standard LangGraph V1.0+ import

from app.config import get_settings
from app.tools.seo import get_seo_tools


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

def create_seo_tech_agent(model: ChatOpenAI | None = None):
    """
    Create the seo-tech specialist agent using create_agent from langchain.agents.
    
    This is the standard LangGraph v1.0+ pattern for tool-using agents.
    
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
            temperature=0.3,  # Lower temperature for technical analysis
            streaming=True,
        )
    
    # Get SEO tools
    tools = get_seo_tools()
    
    # Create the agent using LangGraph's standard pattern
    agent = create_agent(
        model=model,
        tools=tools,
        name="seo_tech",
        system_prompt=SEO_TECH_SYSTEM_PROMPT,
    )
    
    return agent


# =============================================================================
# CONVENIENCE EXPORT
# =============================================================================

# Pre-create a default agent for import
def get_seo_tech_agent():
    """Get or create the seo-tech agent."""
    return create_seo_tech_agent()
