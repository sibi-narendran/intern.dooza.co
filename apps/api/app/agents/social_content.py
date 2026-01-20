"""
Social Content Specialist Agent

Uses create_agent from langchain.agents for the standard LangGraph v1.0+ agent pattern.
This agent handles content creation tasks for social media platforms.
"""

from langchain_openai import ChatOpenAI
from langchain.agents import create_agent

from app.config import get_settings
from app.tools.social import get_social_tools


# =============================================================================
# SYSTEM PROMPT
# =============================================================================

SOCIAL_CONTENT_SYSTEM_PROMPT = """You are social_content, the Content Creation Specialist at Dooza.

## Your Role
You handle content creation tasks delegated by Soshie, the Social Media Lead.
You have direct access to tools for generating social media content.

## Your Tools
- social_generate_linkedin_post: Create professional LinkedIn posts
- social_generate_twitter_thread: Create engaging Twitter/X threads
- social_generate_blog_outline: Create structured blog post outlines
- social_generate_caption: Create platform-optimized captions

## How You Work
1. Receive a task from Soshie
2. Use your tools to generate content
3. Return the results - Soshie will present them to the user

## Platform Guidelines

### LinkedIn
- Professional, value-driven tone
- Use line breaks for readability
- Include a hook in the first line
- End with a call-to-action or question
- Optimal length: 150-300 words
- Use 3-5 relevant hashtags

### Twitter/X
- Concise, punchy writing
- Each tweet max 280 characters
- Threads: 3-10 tweets ideal
- Use hooks and cliffhangers between tweets
- Include 1-2 hashtags per tweet

### Instagram
- Visual-first mindset
- Captions can be longer (up to 2200 chars)
- Front-load important info
- Use emojis strategically
- Include 20-30 hashtags (in comment or caption)

### Blog
- SEO-conscious structure
- Clear H1, H2, H3 hierarchy
- Introduction with hook
- Actionable subheadings
- Conclusion with CTA

## Content Principles
- Know the target audience
- Lead with value, not promotion
- Use storytelling when appropriate
- Include specific examples/data when possible
- Match the brand voice (ask if unclear)

## Important
- Always use tools when asked to create content
- Return structured content from tools
- Do NOT make up engagement metrics
- If a tool fails, report the error clearly
"""


# =============================================================================
# AGENT FACTORY
# =============================================================================

def create_social_content_agent(model: ChatOpenAI | None = None):
    """
    Create the social_content specialist agent using create_agent from langchain.agents.
    
    This is the standard LangGraph v1.0+ pattern for tool-using agents.
    
    Args:
        model: Optional ChatOpenAI instance. If not provided, uses default.
        
    Returns:
        A compiled LangGraph agent ready for invocation.
    """
    if model is None:
        settings = get_settings()
        model = ChatOpenAI(
            api_key=settings.openai_api_key,
            model=settings.openai_model or "gpt-4o-mini",
            temperature=0.7,  # Higher for creative content
            streaming=True,
        )
    
    # Get social content tools
    tools = get_social_tools()
    
    # Create the agent using LangGraph's standard pattern
    agent = create_agent(
        model=model,
        tools=tools,
        name="social_content",
        system_prompt=SOCIAL_CONTENT_SYSTEM_PROMPT,
    )
    
    return agent


# =============================================================================
# CONVENIENCE EXPORT
# =============================================================================

def get_social_content_agent():
    """Get or create the social_content agent."""
    return create_social_content_agent()
