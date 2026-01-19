"""
Agent Base Class

Base class for all Dooza agents providing:
- LangGraph workflow integration
- Tool execution with events
- Delegation to other agents
- SSE streaming support
"""

from __future__ import annotations
import json
import logging
from typing import Any, AsyncIterator, Dict, List, Optional, Sequence, Annotated, TYPE_CHECKING

from langchain_core.messages import (
    BaseMessage, 
    HumanMessage, 
    SystemMessage,
)
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from typing_extensions import TypedDict

from app.config import get_settings
from app.agents.config import AgentConfig
from app.agents.events import AgentEvent
from app.tools.base import DoozaTool

if TYPE_CHECKING:
    from app.context.types import AgentContext
    from app.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


class AgentState(TypedDict):
    """State for the agent graph."""
    messages: Annotated[Sequence[BaseMessage], add_messages]


def get_llm(streaming: bool = True, model: Optional[str] = None) -> ChatOpenAI:
    """
    Create LLM instance based on configured provider.
    
    Supports:
    - OpenAI (recommended - best streaming & tool support)
    - OpenRouter (multi-provider gateway)
    - Gemini (Google AI)
    
    Args:
        streaming: Whether to enable streaming
        model: Optional model override (default from settings)
        
    Returns:
        Configured LLM instance
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
        # Use Google's native API for better Gemini support
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
        except ImportError:
            raise ImportError("Install langchain-google-genai: pip install langchain-google-genai")
        
        model_name = model or settings.gemini_model
        logger.debug(f"Creating Gemini LLM: {model_name}")
        
        return ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=settings.gemini_api_key,
            streaming=streaming,
        )
    
    else:  # openrouter (default fallback)
        model_name = model or settings.openrouter_model
        logger.debug(f"Creating OpenRouter LLM: {model_name}")
        
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


class DoozaAgent:
    """
    Base class for all Dooza agents.
    
    Agents are stateful LangGraph workflows that:
    1. Receive messages from users
    2. Use tools to accomplish tasks
    3. Can delegate to other agents
    4. Stream responses back to users
    
    Usage:
        config = AgentConfig(slug="seomi", ...)
        agent = DoozaAgent(config, tool_registry, context)
        async for event in agent.run("Analyze example.com", thread_id):
            handle_event(event)
    """
    
    def __init__(
        self,
        config: AgentConfig,
        tool_registry: "ToolRegistry",
        context: "AgentContext",
        checkpointer=None,
        model_override: Optional[str] = None,
    ):
        """
        Initialize the agent.
        
        Args:
            config: Agent configuration
            tool_registry: Registry to get tools from
            context: Current user/org context
            checkpointer: Optional LangGraph checkpointer for persistence
            model_override: Optional model to use instead of default
        """
        self.config = config
        self.context = context
        self.checkpointer = checkpointer
        self.model_override = model_override
        
        # Get tools this agent can use based on permissions
        self.tools = tool_registry.get_tools_for_agent(config, context)
        logger.info(f"Agent {config.slug} initialized with {len(self.tools)} tools")
        
        # Build the LangGraph workflow
        self.graph = self._build_graph()
    
    def _build_graph(self):
        """
        Build the LangGraph workflow.
        
        Creates a ReAct-style agent that can:
        - Respond to user messages
        - Call tools when needed
        - Loop back to process tool results
        """
        llm = get_llm(streaming=True, model=self.model_override)
        
        # Bind tools to the LLM if we have any
        if self.tools:
            llm_with_tools = llm.bind_tools(self.tools)
        else:
            llm_with_tools = llm
        
        async def call_model(state: AgentState) -> Dict:
            """Call the LLM with current state."""
            messages = list(state["messages"])
            
            # Prepend system message
            if not messages or not isinstance(messages[0], SystemMessage):
                messages.insert(0, SystemMessage(content=self.config.system_prompt))
            
            response = await llm_with_tools.ainvoke(messages)
            return {"messages": [response]}
        
        def should_continue(state: AgentState) -> str:
            """Determine if we should call tools or end."""
            messages = state["messages"]
            last_message = messages[-1]
            
            # If there are tool calls, route to tools
            if hasattr(last_message, "tool_calls") and last_message.tool_calls:
                return "tools"
            
            # Otherwise, we're done
            return END
        
        # Build the graph
        graph = StateGraph(AgentState)
        
        # Add nodes
        graph.add_node("agent", call_model)
        
        if self.tools:
            tool_node = ToolNode(self.tools)
            graph.add_node("tools", tool_node)
            
            # Add edges
            graph.set_entry_point("agent")
            graph.add_conditional_edges(
                "agent",
                should_continue,
                {
                    "tools": "tools",
                    END: END,
                }
            )
            graph.add_edge("tools", "agent")
        else:
            # No tools - simple path to end
            graph.set_entry_point("agent")
            graph.add_edge("agent", END)
        
        # Compile with optional checkpointer
        return graph.compile(checkpointer=self.checkpointer)
    
    async def run(
        self,
        message: str,
        thread_id: str,
    ) -> AsyncIterator[AgentEvent]:
        """
        Run the agent with a user message.
        
        Uses astream_events for true token-by-token streaming.
        This provides real-time character streaming with OpenAI.
        
        Yields events for:
        - Tokens (streaming response - character by character)
        - Tool calls
        - Tool results  
        - Errors
        - Completion
        
        Args:
            message: The user's message
            thread_id: Thread ID for conversation persistence
            
        Yields:
            AgentEvent objects for SSE streaming
        """
        config = {
            "configurable": {
                "thread_id": thread_id,
                "user_id": self.context.user_id,
            }
        }
        
        try:
            token_count = 0
            current_tool_calls: Dict[str, str] = {}  # run_id -> tool_name
            got_streaming_tokens = False  # Track if we received any streaming tokens
            full_response_text = ""  # Accumulate full response to avoid duplicates
            
            async for event in self.graph.astream_events(
                {"messages": [HumanMessage(content=message)]},
                config=config,
                version="v2",
            ):
                kind = event["event"]
                name = event.get("name", "")
                
                # TRUE TOKEN-BY-TOKEN STREAMING from LLM (if provider supports it)
                if kind == "on_chat_model_stream":
                    chunk = event["data"]["chunk"]
                    if hasattr(chunk, "content") and chunk.content:
                        content = chunk.content
                        if isinstance(content, str) and content:
                            got_streaming_tokens = True
                            full_response_text += content
                            token_count += 1
                            yield AgentEvent.token(content)
                        elif isinstance(content, list):
                            for block in content:
                                text = None
                                if isinstance(block, str) and block:
                                    text = block
                                elif isinstance(block, dict) and block.get("text"):
                                    text = block["text"]
                                if text:
                                    got_streaming_tokens = True
                                    full_response_text += text
                                    token_count += 1
                                    yield AgentEvent.token(text)
                
                # FALLBACK: Get response from chain_stream ONLY if we didn't get streaming tokens
                # This handles cases where the LLM doesn't support streaming
                elif kind == "on_chain_stream" and name == "LangGraph" and not got_streaming_tokens:
                    chunk = event["data"].get("chunk", {})
                    # Get the agent output from the final state
                    agent_output = chunk.get("agent", {})
                    if agent_output:
                        messages = agent_output.get("messages", [])
                        for msg in messages:
                            if hasattr(msg, "content") and msg.content:
                                content = msg.content
                                # Only yield if it's text (not tool call)
                                if isinstance(content, str) and content:
                                    # Check for tool calls - skip messages that are just tool call requests
                                    if hasattr(msg, "tool_calls") and msg.tool_calls:
                                        continue  # Skip - this is a tool call, not final response
                                    # Only yield if different from what we've accumulated
                                    if content != full_response_text:
                                        full_response_text = content
                                        yield AgentEvent.token(content)
                
                # Tool call starting
                elif kind == "on_tool_start":
                    tool_name = event.get("name", "unknown_tool")
                    run_id = event.get("run_id", "")
                    current_tool_calls[run_id] = tool_name
                    
                    tool_input = event["data"].get("input", {})
                    safe_args = self._safe_serialize_args(tool_input)
                    yield AgentEvent.tool_start(tool_name, safe_args)
                
                # Tool call completed
                elif kind == "on_tool_end":
                    run_id = event.get("run_id", "")
                    tool_name = current_tool_calls.pop(run_id, "unknown")
                    
                    tool_output = event["data"].get("output")
                    
                    # Emit full structured data for specific tool categories
                    # This allows frontend to render rich UI components
                    if self._is_structured_tool(tool_name) and isinstance(tool_output, dict):
                        tool_category = self._get_tool_category(tool_name)
                        yield AgentEvent.tool_data(tool_name, tool_output, tool_category)
                    
                    # Also emit the standard tool_end with truncated display output
                    display_output = self._safe_serialize_output(tool_output)
                    yield AgentEvent.tool_end(tool_name, display_output)
            
            if token_count > 0:
                logger.debug(f"Streamed {token_count} tokens")
            
            yield AgentEvent.end()
            
        except Exception as e:
            logger.error(f"Agent {self.config.slug} error: {e}", exc_info=True)
            yield AgentEvent.create_error(str(e))
    
    # Tools that return structured data for frontend rendering
    STRUCTURED_TOOLS = {
        # SEO tools
        "seo_analyze_url": "seo",
        "seo_audit_meta_tags": "seo",
        "seo_analyze_headings": "seo",
        "seo_check_images": "seo",
        "seo_extract_keywords": "seo",
        # Add more categories as needed:
        # "analytics_report": "analytics",
        # "social_metrics": "social",
    }
    
    def _is_structured_tool(self, tool_name: str) -> bool:
        """Check if a tool returns structured data for frontend rendering."""
        return tool_name in self.STRUCTURED_TOOLS
    
    def _get_tool_category(self, tool_name: str) -> str:
        """Get the category of a structured tool."""
        return self.STRUCTURED_TOOLS.get(tool_name, "general")
    
    def _safe_serialize_args(self, args: Any) -> Dict[str, Any]:
        """Safely serialize tool arguments for display."""
        if not isinstance(args, dict):
            return {"input": str(args)}
        
        safe_args = {}
        for k, v in args.items():
            if isinstance(v, (str, int, float, bool, type(None))):
                safe_args[k] = v
            else:
                safe_args[k] = str(v)
        return safe_args
    
    def _safe_serialize_output(self, output: Any) -> Any:
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
    
    async def delegate(
        self,
        to_agent_slug: str,
        task: str,
        context_data: Optional[Dict] = None,
    ) -> Dict:
        """
        Delegate a task to another agent.
        
        Args:
            to_agent_slug: Slug of agent to delegate to
            task: Task description for the other agent
            context_data: Additional context to pass
            
        Returns:
            Result from the delegated agent
            
        Raises:
            PermissionError: If delegation not allowed
        """
        if to_agent_slug not in self.config.can_delegate_to:
            raise PermissionError(
                f"Agent '{self.config.slug}' cannot delegate to '{to_agent_slug}'"
            )
        
        # Get orchestrator to handle delegation
        # This will be implemented when we build the orchestrator
        raise NotImplementedError(
            "Delegation requires orchestrator - coming in Phase 2"
        )
    
    def get_tool_names(self) -> List[str]:
        """Get list of tool names available to this agent."""
        return [tool.name for tool in self.tools]


# Keep backwards compatibility with existing code
def create_base_agent(system_prompt: Optional[str] = None, checkpointer=None):
    """
    Legacy function for creating a simple agent without tools.
    
    This maintains backwards compatibility during migration.
    Use DoozaAgent directly for new code.
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
    graph.set_entry_point("agent")
    graph.add_edge("agent", END)
    
    return graph.compile(checkpointer=checkpointer)


# Legacy agent prompts - kept for backwards compatibility
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
