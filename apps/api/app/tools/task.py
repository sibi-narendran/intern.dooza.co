"""
Task Creation Tool for Agents

Allows agents to create workspace tasks that users can review and approve.
This transforms agents from "chatbots" to "workers" that produce artifacts.

Usage:
    Agent calls create_task() to produce a task
    Task appears in user's calendar/dashboard as "pending_approval"
    User approves/rejects
    If rejected, agent can revise based on feedback
"""

from __future__ import annotations

import logging
from contextvars import ContextVar
from datetime import datetime
from typing import Optional, Any

from langchain_core.tools import tool

from app.services.task_service import TaskService, get_task_service
from app.schemas.task_content import CONTENT_SCHEMAS

logger = logging.getLogger(__name__)


# =============================================================================
# AGENT CONTEXT (Thread-safe using contextvars)
# =============================================================================

# ContextVar provides async-safe, per-request isolation
# Each concurrent request gets its own copy of the context
_agent_context_var: ContextVar[Optional["AgentContext"]] = ContextVar(
    "agent_context", default=None
)


class AgentContext:
    """
    Runtime context for the executing agent.
    
    Set by the API handler before invoking the agent graph.
    Provides agent identity and user context for tool calls.
    
    Uses contextvars for thread-safety in concurrent async environments.
    Each request gets isolated context - no cross-request contamination.
    """
    
    def __init__(
        self,
        agent_slug: str,
        user_id: str,
        org_id: Optional[str] = None,
        thread_id: Optional[str] = None,
    ):
        self.agent_slug = agent_slug
        self.user_id = user_id
        self.org_id = org_id
        self.thread_id = thread_id
    
    @classmethod
    def set_current(cls, context: "AgentContext") -> None:
        """Set the current agent context for this async context."""
        _agent_context_var.set(context)
    
    @classmethod
    def get_current(cls) -> Optional["AgentContext"]:
        """Get the current agent context for this async context."""
        return _agent_context_var.get()
    
    @classmethod
    def clear(cls) -> None:
        """Clear the current context."""
        _agent_context_var.set(None)


def set_agent_context(
    agent_slug: str,
    user_id: str,
    org_id: Optional[str] = None,
    thread_id: Optional[str] = None,
) -> AgentContext:
    """
    Set the agent context for the current async execution.
    
    Call this before invoking the agent graph so tools
    know the agent identity and user context.
    
    Thread-safe: Uses contextvars for per-request isolation.
    
    Returns the created context.
    """
    context = AgentContext(
        agent_slug=agent_slug,
        user_id=user_id,
        org_id=org_id,
        thread_id=thread_id,
    )
    AgentContext.set_current(context)
    return context


def clear_agent_context() -> None:
    """Clear the agent context after execution."""
    AgentContext.clear()


def get_agent_context() -> Optional[AgentContext]:
    """Get the current agent context (convenience function)."""
    return AgentContext.get_current()


# =============================================================================
# TASK CREATION TOOL
# =============================================================================

@tool
async def create_task(
    task_type: str,
    title: str,
    content: dict,
    due_date: Optional[str] = None,
) -> dict:
    """
    Create a task for user review and approval.
    
    Use this tool to produce deliverables that the user can review,
    approve, edit, or reject with feedback.
    
    Args:
        task_type: Type of task. Must be one of:
            - "blog_post": SEO-optimized blog post with title, body, keywords
            - "tweet": Twitter/X post with text, hashtags, optional media
            - "social_post": Generic social post for any platform
            - "video_script": Video script with hook, scenes, CTA
            - "content_brief": Content brief for writers
        title: Brief title for display in calendar/dashboard
        content: Task content matching the schema for this task_type.
            For blog_post: {"title": str, "body": str, "keywords": list, "meta_description": str}
            For tweet: {"text": str, "hashtags": list, "media_url": str}
            For video_script: {"title": str, "hook": str, "scenes": list, "duration_seconds": int}
        due_date: Optional due date in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)
    
    Returns:
        dict with:
            - task_id: UUID of created task
            - status: "pending_approval"
            - message: Confirmation message
            - view_url: URL to view in workspace (if available)
    
    Example:
        ```
        result = create_task(
            task_type="blog_post",
            title="10 AI Trends for 2026",
            content={
                "title": "10 AI Trends for 2026",
                "body": "# Introduction\\n\\nAI is transforming...",
                "keywords": ["AI", "trends", "2026"],
                "meta_description": "Discover the top 10 AI trends..."
            },
            due_date="2026-01-28"
        )
        ```
    """
    # Get current agent context
    context = AgentContext.get_current()
    if not context:
        return {
            "success": False,
            "error": "No agent context set. Cannot determine user/agent identity.",
        }
    
    # Validate task_type is known (for better error messages)
    if task_type not in CONTENT_SCHEMAS:
        known_types = ", ".join(CONTENT_SCHEMAS.keys())
        return {
            "success": False,
            "error": f"Unknown task_type '{task_type}'. Known types: {known_types}",
        }
    
    # Parse due_date if provided
    parsed_due_date = None
    if due_date:
        try:
            # Try ISO format
            parsed_due_date = datetime.fromisoformat(due_date.replace("Z", "+00:00"))
        except ValueError:
            try:
                # Try date only
                parsed_due_date = datetime.strptime(due_date, "%Y-%m-%d")
            except ValueError:
                return {
                    "success": False,
                    "error": f"Invalid due_date format: {due_date}. Use YYYY-MM-DD or ISO format.",
                }
    
    try:
        # Get task service
        service = get_task_service()
        
        # Create the task
        task = await service.create_task(
            user_id=context.user_id,
            agent_slug=context.agent_slug,
            task_type=task_type,
            title=title,
            content=content,
            org_id=context.org_id,
            due_date=parsed_due_date,
            thread_id=context.thread_id,
            status="pending_approval",
        )
        
        logger.info(
            f"Agent {context.agent_slug} created task {task['id']} "
            f"({task_type}) for user {context.user_id}"
        )
        
        return {
            "success": True,
            "task_id": task["id"],
            "status": task["status"],
            "message": f"Task '{title}' created and pending approval. The user can view it in their Workspace Calendar.",
            "view_url": f"/workspace?task={task['id']}",
        }
        
    except Exception as e:
        logger.error(f"Failed to create task: {e}")
        return {
            "success": False,
            "error": str(e),
        }


@tool
def get_task_types() -> dict:
    """
    Get available task types and their required content schemas.
    
    Use this to understand what task types you can create
    and what fields are required for each.
    
    Returns:
        dict mapping task_type to schema info including required fields.
    """
    result = {}
    
    for task_type, schema in CONTENT_SCHEMAS.items():
        # Extract field info from Pydantic model
        fields = {}
        for name, field_info in schema.model_fields.items():
            fields[name] = {
                "required": field_info.is_required(),
                "type": str(field_info.annotation),
                "description": field_info.description or "",
            }
        
        result[task_type] = {
            "description": schema.__doc__ or f"Schema for {task_type}",
            "fields": fields,
        }
    
    return {
        "task_types": result,
        "usage": "Call create_task(task_type, title, content, due_date) to create a task",
    }


# =============================================================================
# TOOL LIST FOR AGENTS
# =============================================================================

# Export tools for agent registration
TASK_TOOLS = [create_task, get_task_types]
