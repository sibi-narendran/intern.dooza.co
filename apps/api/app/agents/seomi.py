"""
SEOmi - SEO Lead Orchestrator Agent

Uses LangGraph's create_supervisor for standard multi-agent pattern.
SEOmi supervises seo-tech, seo-content, and seo-analytics specialists.

This is the production-grade, standard LangGraph architecture.
"""

from typing import Any, Optional

from langchain_openai import ChatOpenAI
from langgraph_supervisor import create_supervisor
from langgraph.checkpoint.base import BaseCheckpointSaver

from app.config import get_settings
from app.agents.seo_tech import create_seo_tech_agent
from app.agents.seo_content import create_seo_content_agent
from app.agents.seo_analytics import create_seo_analytics_agent


# =============================================================================
# SYSTEM PROMPT
# =============================================================================

SEOMI_SYSTEM_PROMPT = """You are SEOmi, the SEO Lead at Dooza.

## Your Role
You are the user-facing SEO expert. Users talk to you for all SEO needs.
You have a team of specialists that you delegate to for specific tasks.

## Your Team (Specialists)
1. **seo_tech** - Technical SEO Specialist
   - Has tools for: URL analysis, meta tags, headings, images, keywords
   - Delegate: technical audits, page analysis, site issues

2. **seo_content** - Content SEO Specialist  
   - Coming soon: keyword research, content gaps, content briefs
   - Currently: provides guidance on content strategy

3. **seo_analytics** - Analytics SEO Specialist
   - Coming soon: GSC data, rankings, traffic analysis
   - Requires: Google Search Console / Analytics integration

## How You Work
1. User asks an SEO question
2. You decide which specialist can help (or answer directly if simple)
3. You delegate to the specialist using the transfer tools
4. Specialist does the work and returns results
5. You interpret results and present to the user in a friendly way

## When to Delegate
- "Analyze this URL" → delegate to seo_tech
- "Audit my site" → delegate to seo_tech
- "Check my meta tags" → delegate to seo_tech
- "Keyword research for X" → delegate to seo_content (coming soon)
- "How are my rankings?" → delegate to seo_analytics (requires GSC)

## When to Answer Directly
- General SEO questions and advice
- Explaining SEO concepts
- Discussing strategy at a high level

## Your Communication Style
- Friendly and professional
- Explain technical findings in simple terms
- Always provide actionable recommendations
- Prioritize issues by impact (critical → important → nice-to-have)

## Presenting Results
After receiving specialist results:
1. Summarize key findings
2. Explain why each issue matters
3. Give specific, actionable fixes
4. Prioritize what to fix first
5. Offer next steps

Example:
"I've analyzed your site. Here's what matters most:

**🔴 Critical - Fix These First**
- No H1 heading (hurts SEO significantly)
- Title tag too short

**🟡 Important - This Week**
- Missing meta description on 3 pages

Would you like me to help you fix any of these?"

## Important Rules
- NEVER say "I can't access websites" - you CAN via seo_tech
- NEVER make up data - only report what specialists return
- ALWAYS delegate technical tasks to specialists
- ALWAYS interpret results for the user (don't just dump data)
"""


# =============================================================================
# SUPERVISOR FACTORY
# =============================================================================

def create_seomi_supervisor(
    model: ChatOpenAI | None = None,
    checkpointer: BaseCheckpointSaver | None = None,
) -> Any:
    """
    Create the SEOmi supervisor agent using LangGraph's create_supervisor.
    
    This is the standard LangGraph multi-agent pattern where:
    - SEOmi is the supervisor that routes to specialists
    - Specialists are create_react_agent instances with their tools
    - Handoff is automatic via transfer tools
    
    Args:
        model: Optional ChatOpenAI for the supervisor. Uses default if not provided.
        checkpointer: Optional checkpointer for conversation persistence.
        
    Returns:
        A compiled LangGraph supervisor workflow.
    """
    if model is None:
        settings = get_settings()
        model = ChatOpenAI(
            api_key=settings.openai_api_key,  # Explicitly pass API key from settings
            model=settings.openai_model or "gpt-4o",  # Supervisor uses better model
            temperature=0.7,
            streaming=True,
        )
    
    # Create specialist agents
    seo_tech = create_seo_tech_agent()
    seo_content = create_seo_content_agent()
    seo_analytics = create_seo_analytics_agent()
    
    # Create the supervisor workflow
    # This automatically creates handoff tools for transferring to specialists
    # Note: No output_mode - we need full event streaming for tool visibility
    workflow = create_supervisor(
        agents=[seo_tech, seo_content, seo_analytics],
        model=model,
        prompt=SEOMI_SYSTEM_PROMPT,
    )
    
    # Compile with optional checkpointer
    if checkpointer:
        return workflow.compile(checkpointer=checkpointer)
    else:
        return workflow.compile()


# =============================================================================
# CONVENIENCE EXPORTS
# =============================================================================

def get_seomi_app(checkpointer: BaseCheckpointSaver | None = None):
    """
    Get a compiled SEOmi supervisor app ready for invocation.
    
    Args:
        checkpointer: Optional checkpointer for conversation persistence.
        
    Returns:
        Compiled supervisor workflow.
    """
    return create_seomi_supervisor(checkpointer=checkpointer)


# Keep for backward compatibility during transition
SEOMI_CONFIG = {
    "slug": "seomi",
    "name": "SEOmi",
    "title": "SEO Expert",
    "description": "Your AI SEO lead - handles technical audits, content strategy, and analytics.",
    "domain": "seo",
    "avatar_gradient": "from-emerald-500 to-teal-600",
    "avatar_icon": "TrendingUp",
}
