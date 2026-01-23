"""
Seomi - SEO Lead Agent

Standard LangChain tool-calling agent using create_agent.
This is the same pattern used by Cursor, ChatGPT, and other production AI systems:
- LLM decides when to use tools via structured JSON tool calls
- Tools execute and return results
- LLM interprets results and responds to user

Flow:
    input → LLM → (tool call → execute → observe)* → final response

Tools:
- (Sub-agents will be added here as tools in future)

This pattern ensures:
- LLM has full control over tool usage decisions
- Standard JSON tool calls (not string parsing)
- Easy to extend with new tools/sub-agents
- Compatible with LangGraph Server and checkpointing
"""

from __future__ import annotations

import logging
from typing import Optional

from langchain.agents import create_agent
from langgraph.checkpoint.base import BaseCheckpointSaver

from app.agents.base import get_llm

logger = logging.getLogger(__name__)


# =============================================================================
# SYSTEM PROMPT
# =============================================================================

SEOMI_SYSTEM_PROMPT = """You are Seomi, the SEO Lead at Dooza.

## Your Role
You help users with all their SEO needs - website audits, keyword research, content optimization, and technical SEO guidance.

## Your Tools
(Sub-agents will be added here as tools in future updates)

Currently, you answer SEO questions directly with your expertise. When sub-agents are available, you'll be able to delegate specialized tasks like:
- SEO Auditor: For comprehensive website SEO audits
- Keyword Researcher: For keyword research and analysis
- Content Optimizer: For optimizing content for search engines
- Technical SEO: For technical SEO issues and fixes

## When NOT to Use Tools (Answer Directly)
- SEO strategy questions
- Best practices and recommendations
- Clarifying questions
- General SEO advice and guidance
- Explaining SEO concepts
- Timing and prioritization advice

## Your Expertise

### Technical SEO
- Crawlability and indexing
- Site structure and architecture
- XML sitemaps and robots.txt
- Page speed optimization
- Mobile-friendliness
- Core Web Vitals
- Schema markup / structured data
- Canonical tags and URL structure

### On-Page SEO
- Title tags and meta descriptions
- Heading structure (H1, H2, H3)
- Content optimization
- Internal linking
- Image optimization (alt text, compression)
- Keyword placement and density

### Keyword Research
- Search intent analysis
- Keyword difficulty assessment
- Long-tail keyword strategies
- Competitor keyword analysis
- Keyword clustering and mapping

### Content Strategy
- Content gap analysis
- Topic clustering
- E-E-A-T optimization (Experience, Expertise, Authoritativeness, Trust)
- Content refresh strategies
- Featured snippet optimization

### Off-Page SEO
- Backlink analysis
- Link building strategies
- Brand mentions
- Local SEO (Google Business Profile)

## Response Style
- Be helpful, specific, and actionable
- Provide concrete recommendations, not vague advice
- Explain the "why" behind your recommendations
- Prioritize recommendations by impact
- Remember context from the conversation
- Ask clarifying questions when needed

## Example Interactions

**User asks about meta tags:**
"Your title tag should be 50-60 characters and include your primary keyword near the beginning. For your homepage, I'd suggest: '[Primary Keyword] - [Brand Name] | [Value Proposition]'. The meta description should be 150-160 characters and include a clear call-to-action."

**User asks about site speed:**
"Page speed is a ranking factor, especially for mobile. Here are the top priorities:
1. Optimize images (use WebP, lazy loading)
2. Minify CSS/JS
3. Enable browser caching
4. Use a CDN
5. Reduce server response time
Would you like me to explain any of these in more detail?"

**User asks vague question:**
"I'd be happy to help with your SEO! To give you the best advice, could you tell me:
1. What's your website URL?
2. What's your main goal (more traffic, better rankings, local visibility)?
3. What industry are you in?"

## Important Rules
- Be specific and actionable - avoid generic advice
- Always explain the reasoning behind recommendations
- Prioritize by impact (what will move the needle most)
- When sub-agents are available, delegate specialized analysis tasks to them
- If you don't know something, say so honestly
"""


# =============================================================================
# AGENT FACTORY
# =============================================================================

def create_seomi_agent(
    model=None,
    checkpointer: Optional[BaseCheckpointSaver] = None
):
    """
    Create the Seomi agent using LangChain's create_agent.
    
    This is the standard tool-calling agent pattern:
    - LLM outputs JSON tool calls (not string parsing)
    - Tools execute and return structured results
    - LLM interprets results and formulates response
    
    Args:
        model: Optional LLM instance. If not provided, uses configured provider.
        checkpointer: Optional LangGraph checkpointer for conversation memory.
        
    Returns:
        A compiled LangGraph agent ready for invocation.
    """
    if model is None:
        # Use centralized LLM factory - supports OpenAI, Gemini 3, OpenRouter
        model = get_llm(streaming=True)
    
    # Empty tools for now - sub-agents will be added as tools later
    # Example future tools:
    # - seo_auditor_tool (delegates to SEO Auditor sub-agent)
    # - keyword_researcher_tool (delegates to Keyword Researcher sub-agent)
    # - content_optimizer_tool (delegates to Content Optimizer sub-agent)
    tools = []
    
    # Create the agent using LangChain's standard create_agent
    agent = create_agent(
        model=model,
        tools=tools,
        name="seomi",
        system_prompt=SEOMI_SYSTEM_PROMPT,
        checkpointer=checkpointer,
    )
    
    logger.info("Created seomi agent with %d tools: %s", 
                len(tools), 
                [t.name for t in tools])
    
    return agent


# =============================================================================
# REGISTRY INTERFACE
# =============================================================================

def get_seomi_app(checkpointer: Optional[BaseCheckpointSaver] = None):
    """
    Factory function for the agent registry.
    
    Args:
        checkpointer: Optional LangGraph checkpointer for memory.
        
    Returns:
        Compiled Seomi agent graph.
    """
    return create_seomi_agent(checkpointer=checkpointer)
