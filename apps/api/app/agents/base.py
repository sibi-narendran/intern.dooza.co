"""
Agent Base Utilities

Provides:
- LLM factory (supports OpenAI, Gemini, OpenRouter)
- Legacy agent support for simple agents
- Tool output utilities

Note: Main agent logic is in individual agent files using langgraph-supervisor.
"""

from __future__ import annotations
import json
import logging
from typing import Any, Dict, Optional, Sequence, Annotated

from langchain_core.messages import BaseMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict

from app.config import get_settings

logger = logging.getLogger(__name__)


# =============================================================================
# STATE DEFINITION
# =============================================================================

class AgentState(TypedDict):
    """Standard state for LangGraph agent workflows."""
    messages: Annotated[Sequence[BaseMessage], add_messages]


# =============================================================================
# LLM FACTORY
# =============================================================================

def get_llm(streaming: bool = True, model: Optional[str] = None) -> Any:
    """
    Create LLM instance based on configured provider.
    
    Supports:
    - openai: OpenAI direct API (recommended for best compatibility)
    - openrouter: Multi-provider gateway (supports Gemini, Claude, etc.)
    - gemini: Google AI direct (streaming disabled due to SDK bug)
    
    Args:
        streaming: Whether to enable streaming (ignored for Gemini direct)
        model: Optional model override (defaults to provider's configured model)
        
    Returns:
        Configured LLM instance (ChatOpenAI or ChatGoogleGenerativeAI)
        
    Raises:
        ValueError: If LLM_PROVIDER is not one of: openai, openrouter, gemini
        ImportError: If Gemini provider selected but langchain-google-genai not installed
    """
    settings = get_settings()
    provider = settings.llm_provider
    
    if provider == "openai":
        model_name = model or settings.openai_model
        logger.debug(f"Creating OpenAI LLM: {model_name}")
        
        return ChatOpenAI(
            model=model_name,
            api_key=settings.openai_api_key,
            streaming=streaming,
        )
    
    elif provider == "gemini":
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
        except ImportError:
            raise ImportError("Install langchain-google-genai>=4.0.0: pip install langchain-google-genai")
        
        model_name = model or settings.gemini_model
        logger.debug(f"Creating Gemini LLM: {model_name}")
        
        # Gemini 3 models require include_thoughts=True for proper thoughtSignature handling
        # This is required for tool calling workflows to work correctly
        is_gemini_3 = "gemini-3" in model_name
        
        # NOTE: Streaming disabled due to bug in google-genai SDK v1.59.0
        # Error: 'ClientResponse' object is not subscriptable in _api_client.py
        # Re-enable when SDK is fixed
        return ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=settings.gemini_api_key,
            streaming=False,  # Disabled: google-genai streaming bug
            include_thoughts=is_gemini_3,
        )
    
    elif provider == "openrouter":
        model_name = model or settings.openrouter_model
        logger.debug(f"Creating OpenRouter LLM: {model_name}")
        
        # #region agent log
        import json as _json
        with open("/Users/sibinarendran/codes/workforce.dooza-ai/.cursor/debug.log", "a") as _f:
            _f.write(_json.dumps({"location":"base.py:get_llm","message":"Creating OpenRouter LLM","data":{"model":model_name,"streaming":streaming,"provider":"openrouter"},"timestamp":__import__("time").time()*1000,"sessionId":"debug-session","hypothesisId":"A,E"})+"\n")
        # #endregion
        
        return ChatOpenAI(
            model=model_name,
            api_key=settings.openrouter_api_key,
            base_url="https://openrouter.ai/api/v1",
            default_headers={
                "HTTP-Referer": "https://dooza.ai",
                "X-Title": "Dooza AI",
            },
            streaming=streaming,
        )
    
    else:
        # Fail fast on invalid provider - don't silently use wrong config
        valid_providers = ["openai", "openrouter", "gemini"]
        raise ValueError(
            f"Invalid LLM_PROVIDER: '{provider}'. "
            f"Must be one of: {', '.join(valid_providers)}"
        )


# =============================================================================
# TOOL OUTPUT UTILITIES (Used by chat.py)
# =============================================================================

STRUCTURED_TOOLS = {
    "seo_analyze_url": "seo",
    "seo_audit_meta_tags": "seo",
    "seo_analyze_headings": "seo",
    "seo_check_images": "seo",
    "seo_extract_keywords": "seo",
}


def is_structured_tool(tool_name: str) -> bool:
    """Check if a tool returns structured data for frontend rendering."""
    return tool_name in STRUCTURED_TOOLS


def get_tool_category(tool_name: str) -> str:
    """Get the category of a structured tool."""
    return STRUCTURED_TOOLS.get(tool_name, "general")


def safe_serialize_output(output: Any) -> Any:
    """Safely serialize tool output for display."""
    if output is None:
        return "No output"
    elif isinstance(output, str):
        return output[:500] + "..." if len(output) > 500 else output
    elif isinstance(output, (int, float, bool)):
        return output
    elif isinstance(output, dict):
        try:
            return json.dumps(output, indent=2, default=str)[:1000]
        except Exception:
            return str(output)[:500]
    else:
        return str(output)[:500]


def extract_tool_result(output: Any) -> Optional[Dict[str, Any]]:
    """Extract dict result from tool output."""
    if hasattr(output, 'content'):
        try:
            content = output.content
            if isinstance(content, str):
                return json.loads(content)
            elif isinstance(content, dict):
                return content
        except (json.JSONDecodeError, TypeError):
            pass
    
    if isinstance(output, dict):
        return output
    
    return None


# =============================================================================
# LEGACY AGENT SUPPORT
# =============================================================================

# Prompts for legacy simple agents (no tools)
AGENT_PROMPTS = {
    "pam": """You are Pam, a friendly and professional AI receptionist for Dooza. 
You help users schedule appointments, answer questions, and route inquiries.
Be warm, helpful, and efficient.""",
    
    "penn": """You are Penn, a skilled AI copywriter for Dooza.
You create compelling copy for ads, emails, and marketing materials.
Be creative, persuasive, and adapt to the target audience.""",
    
    "cassie": """You are Cassie, a patient AI customer support agent for Dooza.
You resolve customer issues and ensure satisfaction.
Be empathetic, solution-oriented, and thorough.""",
    
    "dexter": """You are Dexter, a data analyst AI for Dooza.
You analyze data and uncover business insights.
Be precise, analytical, and explain findings clearly.""",
    
    "soshie": """You are Soshie, a social media manager AI for Dooza.
You plan content and manage social media presence.
Be engaging and understand platform best practices.""",
}


def get_agent_prompt(agent_id: str) -> str:
    """Get the system prompt for a specific agent."""
    return AGENT_PROMPTS.get(
        agent_id,
        "You are a helpful AI assistant. Be concise and helpful."
    )


def create_base_agent(system_prompt: Optional[str] = None, checkpointer=None):
    """
    Create a simple agent without tools (legacy support).
    
    For new agents, use langgraph-supervisor or create_react_agent.
    """
    llm = get_llm()
    
    async def call_model(state: AgentState) -> Dict:
        messages = list(state["messages"])
        
        if system_prompt and (not messages or not isinstance(messages[0], SystemMessage)):
            messages.insert(0, SystemMessage(content=system_prompt))
        
        response = await llm.ainvoke(messages)
        return {"messages": [response]}
    
    graph = StateGraph(AgentState)
    graph.add_node("agent", call_model)
    graph.add_edge(START, "agent")  # Modern LangGraph API
    graph.add_edge("agent", END)
    
    return graph.compile(checkpointer=checkpointer)
