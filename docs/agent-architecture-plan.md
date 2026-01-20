# Dooza AI Agent Architecture

> Comprehensive architecture for a multi-agent AI platform with shared tools, 
> cross-agent communication, and enterprise-grade access controls.

---

## Table of Contents

1. [Vision](#vision)
2. [Core Concepts](#core-concepts)
3. [System Architecture](#system-architecture)
4. [Data Model](#data-model)
5. [Access Control](#access-control)
6. [Tool System](#tool-system)
7. [Agent System](#agent-system)
8. [Context & Memory](#context--memory)
9. [Integration Hub](#integration-hub)
10. [UI System](#ui-system)
11. [Implementation Phases](#implementation-phases)

---

## Vision

Dooza AI is a **multi-agent platform** where:

- **Agents** are specialized AI workers with distinct skills (SEO, Content, Social, etc.)
- **Tools** are shared capabilities that any authorized agent can use
- **Users** can chat with agents, create custom agents, and automate workflows
- **Companies** have centralized knowledge, integrations, and agent management
- **Marketplace** allows sharing agents, skills, and workflows across organizations

### Key Principles

1. **Tool-Agent Separation**: Tools are independent; agents declare which tools they can use
2. **Permission-First**: Every action is gated by user/org/agent permissions
3. **Context-Aware**: Agents have access to relevant user and company context
4. **Composable**: Agents can delegate to other agents, creating workflows
5. **Observable**: All actions are logged for analytics, debugging, and billing

---

## Core Concepts

### Hierarchy

```
DOOZA PLATFORM
├── Organizations (Companies)
│   ├── Users
│   │   ├── Personal Agents
│   │   └── Personal Integrations
│   ├── Company Agents
│   ├── Company Integrations
│   ├── Knowledge Base
│   └── Master Agent (Orchestrator)
└── Dooza Agents (Seomi, Penn, Soshie, etc.)
    └── Available to all organizations
```

### Agent Types

| Type | Created By | Visible To | Examples |
|------|------------|------------|----------|
| **Dooza Agent** | Dooza | All users | Seomi, Penn, Cassie |
| **Company Agent** | Org Admin | Org members | Custom Support Bot |
| **Personal Agent** | User | Only that user | Personal Assistant |

### Tool Categories

| Category | Tools | Used By |
|----------|-------|---------|
| `seo` | analyze_url, audit_meta, check_keywords | Seomi, Penn |
| `content` | write_blog, generate_headline, rewrite | Penn, Soshie |
| `social` | create_post, schedule, analyze_engagement | Soshie |
| `data` | query_analytics, generate_report | Dexter |
| `communication` | send_email, send_slack, schedule_meeting | Pam, Cassie |
| `integrations` | google_analytics, search_console, ahrefs | Any (via Composio) |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Chat UI  │ │ Agent    │ │ Routines │ │ Admin    │ │ Builder  │      │
│  │          │ │ Gallery  │ │ Dashboard│ │ Console  │ │ Studio   │      │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘      │
└───────┼────────────┼────────────┼────────────┼────────────┼─────────────┘
        │            │            │            │            │
        └────────────┴────────────┴─────┬──────┴────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ /v1/chat     │ │ /v1/agents   │ │ /v1/tools    │ │ /v1/admin    │   │
│  │              │ │              │ │              │ │              │   │
│  │ - stream     │ │ - list       │ │ - list       │ │ - users      │   │
│  │ - history    │ │ - hire       │ │ - execute    │ │ - orgs       │   │
│  │ - feedback   │ │ - configure  │ │ - permissions│ │ - billing    │   │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘   │
└─────────┼────────────────┼────────────────┼────────────────┼────────────┘
          │                │                │                │
          └────────────────┴────────┬───────┴────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           CORE SERVICES                                  │
│                                                                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│  │  ORCHESTRATOR   │    │  TOOL REGISTRY  │    │  CONTEXT LOADER │     │
│  │                 │    │                 │    │                 │     │
│  │ - route tasks   │    │ - register      │    │ - user context  │     │
│  │ - delegation    │    │ - get_for_agent │    │ - org context   │     │
│  │ - workflows     │    │ - permissions   │    │ - integrations  │     │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘     │
│           │                      │                      │               │
│           └──────────────────────┼──────────────────────┘               │
│                                  │                                      │
│                                  ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        AGENT POOL                                │   │
│  │                                                                  │   │
│  │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐   │   │
│  │   │ Seomi   │  │ Penn    │  │ Soshie  │  │ Custom Agents   │   │   │
│  │   │ (SEO)   │  │(Content)│  │(Social) │  │ (User/Company)  │   │   │
│  │   └─────────┘  └─────────┘  └─────────┘  └─────────────────┘   │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                     │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  Supabase    │  │  Vector DB   │  │  Redis       │  │  Composio  │  │
│  │  (Postgres)  │  │  (Embeddings)│  │  (Cache)     │  │  (OAuth)   │  │
│  │              │  │              │  │              │  │            │  │
│  │ - users      │  │ - knowledge  │  │ - sessions   │  │ - gmail    │  │
│  │ - agents     │  │ - documents  │  │ - rate limit │  │ - slack    │  │
│  │ - tools      │  │ - memory     │  │ - context    │  │ - analytics│  │
│  │ - logs       │  │              │  │              │  │            │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Core Tables

```sql
-- Organizations
organizations (
    id UUID PRIMARY KEY,
    name TEXT,
    slug TEXT UNIQUE,
    settings JSONB,
    created_at TIMESTAMPTZ
)

-- Users (extends Supabase auth.users)
profiles (
    id UUID PRIMARY KEY REFERENCES auth.users,
    org_id UUID REFERENCES organizations,
    first_name TEXT,
    last_name TEXT,
    role TEXT,  -- 'admin', 'member', 'viewer'
    preferences JSONB,
    created_at TIMESTAMPTZ
)

-- Agent Definitions
agents (
    id UUID PRIMARY KEY,
    slug TEXT UNIQUE,
    name TEXT,
    role TEXT,
    description TEXT,
    system_prompt TEXT,
    
    -- Ownership
    owner_type TEXT,  -- 'dooza', 'org', 'user'
    owner_id UUID,    -- org_id or user_id (NULL for dooza)
    
    -- Configuration
    tool_categories TEXT[],      -- ['seo', 'content']
    allowed_integrations TEXT[], -- ['google_analytics']
    can_delegate_to TEXT[],      -- ['penn', 'soshie']
    
    -- UI
    avatar_url TEXT,
    gradient TEXT,
    custom_ui_config JSONB,
    
    -- Status
    is_published BOOLEAN,
    is_featured BOOLEAN,
    tier TEXT,  -- 'free', 'pro', 'enterprise'
    
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)

-- Tool Definitions
tools (
    id UUID PRIMARY KEY,
    slug TEXT UNIQUE,           -- 'seo.analyze_url'
    name TEXT,
    description TEXT,
    category TEXT,              -- 'seo', 'content', etc.
    
    -- Permissions
    requires_integration TEXT,  -- 'google_analytics' or NULL
    min_tier TEXT,              -- 'free', 'pro', 'enterprise'
    
    -- Schema
    input_schema JSONB,
    output_schema JSONB,
    
    created_at TIMESTAMPTZ
)

-- Hired Agents (user/org has access to agent)
hired_agents (
    id UUID PRIMARY KEY,
    agent_id UUID REFERENCES agents,
    user_id UUID REFERENCES auth.users,
    org_id UUID REFERENCES organizations,
    
    -- Custom config overrides
    custom_config JSONB,
    
    is_active BOOLEAN,
    hired_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ
)

-- Conversations
conversations (
    id UUID PRIMARY KEY,
    thread_id TEXT UNIQUE,
    user_id UUID REFERENCES auth.users,
    agent_id UUID REFERENCES agents,
    
    -- Context snapshot
    context_snapshot JSONB,
    
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)

-- Messages
messages (
    id UUID PRIMARY KEY,
    conversation_id UUID REFERENCES conversations,
    
    role TEXT,          -- 'user', 'assistant', 'tool', 'system'
    content TEXT,
    
    -- Tool calls
    tool_calls JSONB,   -- [{tool: 'analyze_url', args: {...}}]
    tool_results JSONB, -- [{tool: 'analyze_url', result: {...}}]
    
    -- Delegation
    delegated_to TEXT,  -- agent slug if delegated
    delegated_from TEXT,
    
    -- Metadata
    tokens_used INTEGER,
    latency_ms INTEGER,
    
    created_at TIMESTAMPTZ
)

-- Tool Usage Log (for billing/analytics)
tool_usage_log (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users,
    org_id UUID REFERENCES organizations,
    agent_id UUID REFERENCES agents,
    tool_id UUID REFERENCES tools,
    
    -- Execution details
    input_args JSONB,
    output_result JSONB,
    execution_ms INTEGER,
    success BOOLEAN,
    error_message TEXT,
    
    -- Cost
    estimated_cost_cents INTEGER,
    
    created_at TIMESTAMPTZ
)

-- Integrations (Composio connections)
integrations (
    id UUID PRIMARY KEY,
    app_key TEXT,           -- 'gmail', 'slack', etc.
    
    -- Ownership
    scope TEXT,             -- 'org', 'user'
    org_id UUID REFERENCES organizations,
    user_id UUID REFERENCES auth.users,
    
    -- Composio data
    composio_connection_id TEXT,
    status TEXT,            -- 'active', 'expired', 'revoked'
    
    created_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
)

-- Routines (scheduled agent tasks)
routines (
    id UUID PRIMARY KEY,
    name TEXT,
    description TEXT,
    
    agent_id UUID REFERENCES agents,
    user_id UUID REFERENCES auth.users,
    org_id UUID REFERENCES organizations,
    
    -- Schedule
    schedule_type TEXT,     -- 'cron', 'interval', 'webhook'
    schedule_config JSONB,  -- {cron: '0 9 * * *'} or {interval_minutes: 60}
    
    -- Task
    task_prompt TEXT,
    task_context JSONB,
    
    is_active BOOLEAN,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ
)
```

---

## Access Control

### Permission Model

```python
class Permission:
    """
    Permissions are checked at multiple levels:
    1. User tier (free/pro/enterprise)
    2. Organization settings
    3. Agent permissions
    4. Tool requirements
    """
    
    # User can use this agent?
    def can_use_agent(user: User, agent: Agent) -> bool:
        # Check if hired
        # Check tier requirements
        # Check org permissions
        
    # Agent can use this tool?
    def agent_can_use_tool(agent: Agent, tool: Tool, user: User) -> bool:
        # Check tool category in agent's allowed categories
        # Check tool tier vs user tier
        # Check integration requirements
        
    # Agent can delegate to another agent?
    def can_delegate(from_agent: Agent, to_agent: Agent) -> bool:
        # Check can_delegate_to list
        # Check user has access to target agent
```

### Access Levels

| Level | Scope | Example |
|-------|-------|---------|
| `personal` | Only the user | Personal assistant memories |
| `team` | User's team | Team-shared agent configs |
| `org` | Entire organization | Company knowledge base |
| `public` | Cross-organization | Published marketplace agents |

### Integration Access

```python
class IntegrationAccess:
    """
    Integrations can be:
    1. Org-level: Shared by all org members (e.g., company Slack)
    2. User-level: Personal (e.g., personal Gmail)
    
    Agents access integrations through the user's context.
    """
    
    def get_available_integrations(user: User, agent: Agent) -> list[str]:
        # Get user's personal integrations
        personal = get_user_integrations(user.id)
        
        # Get org's shared integrations
        org = get_org_integrations(user.org_id)
        
        # Filter by what agent is allowed to use
        allowed = agent.allowed_integrations
        
        return [i for i in (personal + org) if i.app_key in allowed]
```

---

## Tool System

### Tool Definition

```python
from dataclasses import dataclass
from typing import Any, Callable
from langchain_core.tools import BaseTool

@dataclass
class ToolMetadata:
    """Metadata for tool registration and access control."""
    slug: str                    # 'seo.analyze_url'
    category: str                # 'seo'
    name: str                    # 'Analyze URL'
    description: str
    requires_integration: str | None  # 'google_analytics' or None
    min_tier: str = 'free'       # 'free', 'pro', 'enterprise'


class DoozaTool(BaseTool):
    """Base class for all Dooza tools."""
    
    metadata: ToolMetadata
    
    def check_permissions(self, context: "AgentContext") -> bool:
        """Check if tool can be used in current context."""
        # Check tier
        if not context.user_tier_allows(self.metadata.min_tier):
            return False
        
        # Check integration
        if self.metadata.requires_integration:
            if self.metadata.requires_integration not in context.integrations:
                return False
        
        return True
```

### Tool Registry

```python
class ToolRegistry:
    """
    Central registry for all tools.
    
    Tools are registered by category and can be retrieved
    based on agent permissions and user context.
    """
    
    _instance: "ToolRegistry" = None
    
    def __init__(self):
        self._tools: dict[str, dict[str, DoozaTool]] = {}
        # {'seo': {'analyze_url': <tool>, 'audit_meta': <tool>}}
    
    @classmethod
    def get_instance(cls) -> "ToolRegistry":
        if cls._instance is None:
            cls._instance = cls()
            cls._instance._register_default_tools()
        return cls._instance
    
    def register(self, tool: DoozaTool):
        """Register a tool under its category."""
        category = tool.metadata.category
        slug = tool.metadata.slug.split('.')[-1]  # 'seo.analyze_url' -> 'analyze_url'
        
        if category not in self._tools:
            self._tools[category] = {}
        self._tools[category][slug] = tool
    
    def get_tools_for_agent(
        self, 
        agent_config: "AgentConfig",
        context: "AgentContext"
    ) -> list[DoozaTool]:
        """Get all tools an agent can use in current context."""
        tools = []
        
        for category in agent_config.tool_categories:
            if category not in self._tools:
                continue
            
            for tool in self._tools[category].values():
                if tool.check_permissions(context):
                    tools.append(tool)
        
        return tools
    
    def get_tool(self, slug: str) -> DoozaTool | None:
        """Get a specific tool by slug."""
        category, name = slug.split('.', 1)
        return self._tools.get(category, {}).get(name)
```

---

## Agent System

### Agent Configuration

```python
from dataclasses import dataclass, field

@dataclass
class AgentConfig:
    """Configuration for an agent."""
    
    # Identity
    slug: str
    name: str
    role: str
    description: str
    system_prompt: str
    
    # Permissions
    tool_categories: list[str] = field(default_factory=list)
    allowed_integrations: list[str] = field(default_factory=list)
    can_delegate_to: list[str] = field(default_factory=list)
    
    # Ownership
    owner_type: str = 'dooza'  # 'dooza', 'org', 'user'
    owner_id: str | None = None
    
    # UI
    avatar_url: str | None = None
    gradient: str | None = None
    custom_ui_config: dict | None = None
    
    # Tier
    min_tier: str = 'free'
```

### Agent Base Class

```python
from typing import AsyncIterator
from langgraph.graph import StateGraph

class DoozaAgent:
    """
    Base class for all Dooza agents.
    
    Agents are stateful LangGraph workflows that:
    1. Receive messages from users
    2. Use tools to accomplish tasks
    3. Can delegate to other agents
    4. Stream responses back to users
    """
    
    def __init__(
        self, 
        config: AgentConfig,
        tool_registry: ToolRegistry,
        context: "AgentContext"
    ):
        self.config = config
        self.context = context
        self.tools = tool_registry.get_tools_for_agent(config, context)
        self.graph = self._build_graph()
    
    def _build_graph(self) -> CompiledStateGraph:
        """Build the LangGraph workflow."""
        # Implemented by subclasses or use default ReAct pattern
        raise NotImplementedError
    
    async def run(
        self, 
        message: str, 
        thread_id: str
    ) -> AsyncIterator["AgentEvent"]:
        """
        Run the agent with a user message.
        
        Yields events for:
        - Tokens (streaming response)
        - Tool calls
        - Tool results
        - Delegations
        - Errors
        """
        config = {
            "configurable": {
                "thread_id": thread_id,
                "user_id": self.context.user_id,
            }
        }
        
        async for event in self.graph.astream_events(
            {"messages": [HumanMessage(content=message)]},
            config=config,
            version="v2"
        ):
            yield self._process_event(event)
    
    async def delegate(
        self, 
        to_agent_slug: str, 
        task: str, 
        context: dict
    ) -> dict:
        """Delegate a task to another agent."""
        if to_agent_slug not in self.config.can_delegate_to:
            raise PermissionError(f"Cannot delegate to {to_agent_slug}")
        
        # Get orchestrator to handle delegation
        orchestrator = get_orchestrator()
        return await orchestrator.delegate(
            from_agent=self.config.slug,
            to_agent=to_agent_slug,
            task=task,
            context=context,
            user_context=self.context
        )
```

### Agent Events

```python
from dataclasses import dataclass
from typing import Literal

@dataclass
class AgentEvent:
    """Events emitted during agent execution."""
    
    type: Literal[
        'token',        # Streaming text token
        'tool_start',   # Starting tool execution
        'tool_end',     # Tool execution complete
        'delegate',     # Delegating to another agent
        'agent_switch', # Another agent is now responding
        'error',        # Error occurred
        'end'           # Agent finished
    ]
    
    # Content based on type
    content: str | None = None      # For 'token'
    tool_name: str | None = None    # For 'tool_start', 'tool_end'
    tool_args: dict | None = None   # For 'tool_start'
    tool_result: dict | None = None # For 'tool_end'
    to_agent: str | None = None     # For 'delegate', 'agent_switch'
    error: str | None = None        # For 'error'
```

---

## Context & Memory

### Agent Context

```python
@dataclass
class AgentContext:
    """
    Context passed to agents for every request.
    
    Contains everything the agent needs to know about:
    - Who is making the request
    - What organization they belong to
    - What integrations are available
    - What permissions they have
    """
    
    # User info
    user_id: str
    user_name: str
    user_email: str
    user_tier: str  # 'free', 'pro', 'enterprise'
    
    # Organization info
    org_id: str | None
    org_name: str | None
    
    # Available integrations (connected via Composio)
    integrations: list[str]  # ['gmail', 'slack', 'google_analytics']
    
    # Permissions
    is_org_admin: bool
    
    def user_tier_allows(self, required_tier: str) -> bool:
        """Check if user's tier allows access."""
        tier_order = {'free': 0, 'pro': 1, 'enterprise': 2}
        return tier_order.get(self.user_tier, 0) >= tier_order.get(required_tier, 0)


class ContextLoader:
    """Load context for agent requests."""
    
    @staticmethod
    async def load(user_id: str) -> AgentContext:
        """Load full context for a user."""
        # Fetch user profile
        user = await get_user_profile(user_id)
        
        # Fetch org info
        org = await get_organization(user.org_id) if user.org_id else None
        
        # Fetch integrations
        integrations = await get_available_integrations(user_id, user.org_id)
        
        return AgentContext(
            user_id=user_id,
            user_name=f"{user.first_name} {user.last_name}",
            user_email=user.email,
            user_tier=user.tier or 'free',
            org_id=str(org.id) if org else None,
            org_name=org.name if org else None,
            integrations=[i.app_key for i in integrations],
            is_org_admin=user.role == 'admin'
        )
```

### Memory System (Future)

```python
class AgentMemory:
    """
    Memory system for agents.
    
    Three types of memory:
    1. Short-term: Current conversation context
    2. Long-term: Learned user preferences, past interactions
    3. Shared: Cross-agent shared knowledge
    """
    
    # Short-term (handled by LangGraph checkpointer)
    # Long-term (vector DB - future)
    # Shared (Redis/DB - future)
    pass
```

---

## Integration Hub

### Composio Integration

```python
class IntegrationHub:
    """
    Manages external integrations via Composio.
    
    Supports:
    - Org-level connections (shared by all members)
    - User-level connections (personal)
    """
    
    def __init__(self):
        self._composio = get_composio_client()
    
    async def get_available_for_agent(
        self, 
        agent_config: AgentConfig,
        user_id: str,
        org_id: str | None
    ) -> list[str]:
        """Get integrations available for an agent."""
        # Get all connected integrations
        connected = await self._get_connected(user_id, org_id)
        
        # Filter by what agent is allowed
        allowed = set(agent_config.allowed_integrations)
        
        return [c for c in connected if c in allowed]
    
    async def get_tools_for_integration(
        self, 
        integration: str
    ) -> list[BaseTool]:
        """Get Composio tools for an integration."""
        if not self._composio:
            return []
        
        # Use Composio to get LangChain tools
        from composio_langchain import ComposioToolSet
        toolset = ComposioToolSet()
        return toolset.get_tools(apps=[integration])
```

---

## UI System

### Pages Structure

```
/                           # Landing / Marketing
/login                      # Auth
/dashboard                  # User's hired agents
/gallery                    # Browse available agents
/chat/:agentSlug            # Chat with agent
/agent/:agentSlug           # Agent detail page
/agent/:agentSlug/settings  # Agent configuration
/agent/:agentSlug/ui        # Custom agent UI (if available)
/routines                   # Scheduled tasks
/integrations               # Manage connections
/admin                      # Org admin panel (if admin)
/builder                    # Custom agent builder (future)
```

### Chat UI Events

```typescript
// SSE events from backend
type ChatEvent = 
  | { type: 'token'; content: string }
  | { type: 'tool_start'; tool: string; args?: object }
  | { type: 'tool_end'; tool: string; result?: object }
  | { type: 'delegate'; to: string; task: string }
  | { type: 'agent_switch'; agent: string; name: string }
  | { type: 'error'; message: string }
  | { type: 'end' }
  | { type: 'thread_id'; thread_id: string }
```

---

## Implementation Phases

### Phase 1: Foundation (Current)

**Goal**: Build architecture that supports future expansion

- [ ] Tool Registry with permission checks
- [ ] Agent base class with tool access
- [ ] Context loader
- [ ] Event types for SSE
- [ ] Seomi agent (first agent)
- [ ] Chat UI with tool indicators

### Phase 2: Multi-Agent

**Goal**: Agents can work together

- [ ] Orchestrator for delegation
- [ ] Inter-agent messaging
- [ ] Penn agent (content)
- [ ] Workflow examples

### Phase 3: Enterprise

**Goal**: Production-ready for companies

- [ ] Knowledge base (RAG)
- [ ] Routines system
- [ ] Admin console
- [ ] Master agent

### Phase 4: Platform

**Goal**: Agent economy

- [ ] Custom agent builder
- [ ] Agent marketplace
- [ ] Cross-company agents
- [ ] Public API/SDK
- [ ] Billing integration

---

## File Structure

```
apps/api/app/
├── __init__.py
├── main.py
├── config.py
│
├── tools/
│   ├── __init__.py
│   ├── base.py              # DoozaTool base class
│   ├── registry.py          # ToolRegistry
│   ├── seo.py               # SEO tools
│   ├── content.py           # Content tools (future)
│   └── social.py            # Social tools (future)
│
├── agents/
│   ├── __init__.py
│   ├── base.py              # DoozaAgent base class
│   ├── config.py            # AgentConfig dataclass
│   ├── events.py            # AgentEvent types
│   ├── seomi.py             # Seomi agent
│   ├── penn.py              # Penn agent (future)
│   └── orchestrator.py      # Multi-agent orchestrator (future)
│
├── context/
│   ├── __init__.py
│   ├── types.py             # AgentContext dataclass
│   └── loader.py            # ContextLoader
│
├── core/
│   ├── __init__.py
│   ├── auth.py
│   ├── database.py
│   └── permissions.py       # Permission checks
│
├── integrations/
│   ├── __init__.py
│   └── hub.py               # IntegrationHub (Composio)
│
└── routers/
    ├── __init__.py
    ├── chat.py
    ├── agents.py
    ├── tools.py             # Tool info endpoints (future)
    ├── gallery.py
    ├── integrations.py
    └── health.py
```

---

## Summary

This architecture provides:

1. **Scalability**: Add new agents/tools without changing core
2. **Security**: Permission checks at every level
3. **Flexibility**: Custom agents, shared tools, delegation
4. **Observability**: Full logging for analytics/billing
5. **Future-proof**: Foundation for marketplace, cross-company, etc.

The key insight is **separation of concerns**:
- Tools are independent of agents
- Agents are independent of UI
- Permissions are checked at runtime based on context
- Everything is logged for observability
