from app.agents.base import create_base_agent, get_agent_prompt
from app.core.database import get_checkpointer


# Valid agent IDs (matches frontend agents.js)
VALID_AGENTS = {"pam", "penn", "seomi", "cassie", "dexter", "soshie"}


def is_valid_agent(agent_id: str) -> bool:
    """Check if agent_id is valid."""
    return agent_id in VALID_AGENTS


def get_agent(agent_id: str):
    """
    Get or create an agent instance by ID.
    
    Each agent has the same base graph structure but different
    system prompts that define their personality and expertise.
    
    Args:
        agent_id: The agent identifier (pam, penn, seomi, etc.)
    
    Returns:
        Compiled LangGraph agent.
    
    Raises:
        ValueError: If agent_id is not valid.
    """
    if not is_valid_agent(agent_id):
        raise ValueError(f"Invalid agent_id: {agent_id}. Must be one of: {VALID_AGENTS}")
    
    system_prompt = get_agent_prompt(agent_id)
    checkpointer = get_checkpointer()  # May be None if DB not connected
    return create_base_agent(system_prompt, checkpointer=checkpointer)
