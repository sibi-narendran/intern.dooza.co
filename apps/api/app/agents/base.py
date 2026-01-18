from typing import Annotated, Optional, Sequence
from typing_extensions import TypedDict

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages

from app.config import get_settings


class AgentState(TypedDict):
    """State for the agent graph."""
    messages: Annotated[Sequence[BaseMessage], add_messages]


def get_llm() -> ChatOpenAI:
    """Create OpenRouter-backed LLM instance."""
    settings = get_settings()
    
    return ChatOpenAI(
        model=settings.default_model,
        openai_api_key=settings.openrouter_api_key,
        openai_api_base="https://openrouter.ai/api/v1",
        default_headers={
            "HTTP-Referer": "https://dooza.ai",
            "X-Title": "Dooza AI",
        },
        streaming=True,
    )


def create_base_agent(system_prompt: Optional[str] = None, checkpointer=None):
    """
    Create a base conversational agent using LangGraph.
    
    This is a simple agent that can chat. Tools can be added later
    by extending this graph.
    
    Args:
        system_prompt: Optional system message to set agent personality/role.
        checkpointer: Optional checkpointer for state persistence.
    
    Returns:
        Compiled LangGraph agent.
    """
    llm = get_llm()
    
    async def call_model(state: AgentState) -> dict:
        """Call the LLM with the current conversation state."""
        messages = list(state["messages"])
        
        # Prepend system message if provided
        if system_prompt and (not messages or not isinstance(messages[0], SystemMessage)):
            messages.insert(0, SystemMessage(content=system_prompt))
        
        response = await llm.ainvoke(messages)
        return {"messages": [response]}
    
    # Build the graph
    graph = StateGraph(AgentState)
    graph.add_node("agent", call_model)
    graph.set_entry_point("agent")
    graph.add_edge("agent", END)
    
    # Compile with optional checkpointer for state persistence
    return graph.compile(checkpointer=checkpointer)


# Agent system prompts - will be expanded when building specific agents
AGENT_PROMPTS = {
    "pam": """You are Pam, a friendly and professional AI receptionist for Dooza. 
You help users schedule appointments, answer questions, and route inquiries to the right team members.
Be warm, helpful, and efficient. Keep responses concise but friendly.""",
    
    "penn": """You are Penn, a skilled AI copywriter for Dooza.
You help create compelling copy for ads, emails, landing pages, and marketing materials.
Be creative, persuasive, and adapt your tone to the target audience.""",
    
    "seomi": """You are Seomi, an SEO expert AI for Dooza.
You help optimize content for search engines, analyze keywords, and improve website rankings.
Be analytical, precise, and explain SEO concepts clearly.""",
    
    "cassie": """You are Cassie, a patient and helpful AI customer support agent for Dooza.
You help resolve customer issues, answer questions, and ensure customer satisfaction.
Be empathetic, solution-oriented, and thorough.""",
    
    "dexter": """You are Dexter, a data analyst AI for Dooza.
You help analyze data, create visualizations, and uncover business insights.
Be precise, analytical, and explain findings in accessible terms.""",
    
    "soshie": """You are Soshie, a social media manager AI for Dooza.
You help plan content, write engaging posts, and manage social media presence.
Be trendy, engaging, and understand platform-specific best practices.""",
}


def get_agent_prompt(agent_id: str) -> str:
    """Get the system prompt for a specific agent."""
    return AGENT_PROMPTS.get(
        agent_id,
        "You are a helpful AI assistant. Be concise and helpful."
    )
