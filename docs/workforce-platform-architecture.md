# Dooza Workforce Platform Architecture

## Executive Summary

Dooza Workforce is a **SaaS AI Workforce Platform** where users build their own AI team by hiring domain-specific AI agents. Each domain has an **orchestrator agent** (team lead) that can delegate to **specialist agents** for complex tasks.

**Key Concepts:**
- Users hire/fire domain orchestrators like employees
- Each domain orchestrator manages specialists within its domain
- Shared integrations (Google, social platforms) across the app
- Per-domain data visualization and editing UI
- Scheduled routines per agent for automated workflows

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DOOZA WORKFORCE PLATFORM                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        USER'S WORKSPACE                              │   │
│  │                                                                      │   │
│  │  ┌──── HIRED AGENTS (User's Team) ────────────────────────────┐    │   │
│  │  │                                                             │    │   │
│  │  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐           │    │   │
│  │  │  │ SEOmi  │  │ Soshie │  │  Vidi  │  │ Dexter │           │    │   │
│  │  │  │(hired) │  │(hired) │  │(not    │  │(hired) │           │    │   │
│  │  │  │        │  │        │  │ hired) │  │        │           │    │   │
│  │  │  └───┬────┘  └───┬────┘  └────────┘  └───┬────┘           │    │   │
│  │  │      │           │                       │                 │    │   │
│  │  │  Specialists  Specialists             Specialists         │    │   │
│  │  │  (hidden)     (hidden)                (hidden)            │    │   │
│  │  │                                                             │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  │  ┌──── SHARED INTEGRATIONS ───────────────────────────────────┐    │   │
│  │  │  Connected once, used by all relevant agents                │    │   │
│  │  │  Google (GSC, GA) │ Social (Twitter, IG) │ CMS │ Email     │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  │  ┌──── ROUTINES ──────────────────────────────────────────────┐    │   │
│  │  │  Scheduled tasks per agent (daily blog, weekly audit, etc.) │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Master Agent (Top-Level Orchestrator)

### What is the Master Agent?

The Master Agent is an optional top-level orchestrator that users can talk to when they don't know which domain agent to use. It analyzes user intent and routes to the appropriate domain orchestrator.

**Slug:** `master` or `dooza`
**Role:** General assistant, intent router, cross-domain coordinator

### Architecture with Master Agent

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                         ┌─────────────────┐                                 │
│                         │  Master Agent   │  ← User can start here         │
│                         │    (Dooza)      │                                 │
│                         └────────┬────────┘                                 │
│                                  │                                          │
│              ┌───────────────────┼───────────────────┐                     │
│              │ routes by intent  │                   │                     │
│              ▼                   ▼                   ▼                     │
│        ┌──────────┐        ┌──────────┐        ┌──────────┐               │
│        │  SEOmi   │        │  Soshie  │        │  Dexter  │               │
│        │(SEO Lead)│        │(Social)  │        │ (Data)   │               │
│        └──────────┘        └──────────┘        └──────────┘               │
│              │                   │                   │                     │
│         specialists         specialists         specialists               │
│                                                                             │
│   OR user can talk directly to any hired domain agent ──────────────────▶  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Master Agent Responsibilities

| Responsibility | Description |
|----------------|-------------|
| **Intent Detection** | Understand what domain the user's request belongs to |
| **Routing** | Hand off to the appropriate domain orchestrator |
| **Cross-Domain Coordination** | Handle tasks that span multiple domains |
| **Fallback** | Handle general questions that don't fit a specific domain |
| **Onboarding** | Help new users understand which agents to hire |

### Routing Logic

The Master Agent determines which domain to route to:

```
User: "Help me improve my website's Google ranking"
  → Intent: SEO
  → Route to: SEOmi

User: "Create a Twitter thread about our new product"
  → Intent: Social Media
  → Route to: Soshie

User: "Analyze last month's sales data"
  → Intent: Data/Analytics
  → Route to: Dexter

User: "I need a blog post and social media content for it"
  → Intent: Cross-domain (Content + Social)
  → Route to: SEOmi (primary), then coordinate with Soshie
```

### User Entry Points

Users have two ways to interact:

| Entry Point | When to Use |
|-------------|-------------|
| **Talk to Master** | "I need help but don't know which agent" |
| **Talk to Domain Agent directly** | "I know I need SEO help, going straight to SEOmi" |

### Master Agent Configuration

```
Master Agent:
  slug: "master" or "dooza"
  can_delegate_to: ["seomi", "soshie", "vidi", "imagi", "dexter", "penn", "cassie"]
  
  # Can route to ANY domain orchestrator the user has hired
  # Cannot route to specialists (those are internal to domains)
```

### Cross-Domain Workflows

When a task spans multiple domains, Master coordinates:

```
User: "Create a content campaign for our product launch"
         │
         ▼
    ┌──────────┐
    │  Master  │  Analyzes: This needs SEO content + Social + possibly Video
    └────┬─────┘
         │
    ┌────┴────────────────────────────────┐
    │                                      │
    ▼                                      ▼
┌────────┐                           ┌────────┐
│ SEOmi  │ "Create SEO-optimized     │ Soshie │ "Create social posts
│        │  blog post + brief"       │        │  to promote the blog"
└───┬────┘                           └───┬────┘
    │                                    │
    │ delegates to Penn                  │ creates posts
    ▼                                    ▼
┌────────┐                           Results
│  Penn  │ Writes the blog post
└────────┘
```

---

## Inter-Agent Communication

### Communication Patterns

Production multi-agent systems use several patterns for agents to communicate. Dooza supports these patterns:

### Pattern 1: Delegation (Primary Pattern)

One agent explicitly hands a task to another agent and waits for the result.

```
┌────────────┐         ┌────────────┐
│  Agent A   │────────▶│  Agent B   │
│            │ delegate│            │
│            │◀────────│            │
│            │ result  │            │
└────────────┘         └────────────┘
```

**Use When:** 
- Agent A knows exactly what it needs from Agent B
- Sequential workflow (A then B)
- Clear parent-child relationship

**Implementation:**
- `can_delegate_to` permission list
- `delegate()` method in DoozaAgent
- Results returned to delegating agent

### Pattern 2: Handoff (Transfer Pattern)

One agent completely hands the conversation to another agent. The original agent exits.

```
┌────────────┐         ┌────────────┐
│  Master    │────────▶│  SEOmi     │
│            │ handoff │            │
│   (exits)  │         │ (continues)│
└────────────┘         └────────────┘
```

**Use When:**
- Routing to the right domain
- Master Agent transferring to domain lead
- User should continue with the new agent

**Implementation:**
- Return `handoff_to: "agent_slug"` in agent response
- Frontend switches active agent
- Conversation continues with new agent

### Pattern 3: Shared Context (Memory Pattern)

Agents share a common context/memory that persists across the conversation.

```
┌────────────┐    ┌─────────────────┐    ┌────────────┐
│  Agent A   │───▶│ Shared Context  │◀───│  Agent B   │
│            │    │ - User prefs    │    │            │
│            │    │ - Previous data │    │            │
│            │    │ - Workflow state│    │            │
└────────────┘    └─────────────────┘    └────────────┘
```

**Use When:**
- Multiple agents need the same information
- Workflow state must persist across agents
- User preferences apply to all agents

**Implementation:**
- `AgentContext` object passed to all agents
- Stored in conversation thread
- Includes: user_id, org_id, integrations, preferences, prior results

### Pattern 4: Event Bus (Pub/Sub Pattern)

Agents publish events that other agents can subscribe to. Decoupled communication.

```
┌────────────┐                        ┌────────────┐
│  Agent A   │──publish──▶ EVENT ────▶│  Agent B   │
│            │           BUS          │ (subscribed)│
└────────────┘             │          └────────────┘
                           │
                           ▼
                    ┌────────────┐
                    │  Agent C   │
                    │ (subscribed)│
                    └────────────┘
```

**Use When:**
- Loose coupling needed
- Multiple agents might care about an event
- Background/async workflows

**Implementation:**
- Event types: `task_completed`, `data_available`, `error_occurred`
- Agents register interest in event types
- Used primarily for routines and background tasks

### Pattern 5: Workflow/Pipeline (Sequential Pattern)

Pre-defined sequence of agents processing data in order.

```
┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│  Agent A   │───▶│  Agent B   │───▶│  Agent C   │───▶│  Output    │
│ (research) │    │  (write)   │    │  (edit)    │    │            │
└────────────┘    └────────────┘    └────────────┘    └────────────┘
```

**Use When:**
- Known sequence of steps
- Each agent transforms/enriches the output
- Routines and automated workflows

**Implementation:**
- Defined in `workflows/` directory
- Each step specifies: agent, task template, output key
- Orchestrator runs steps in sequence

---

## Inter-Agent Communication Rules

### Permission Matrix

| From / To | Master | Domain Leads | Specialists | Shared (Penn) |
|-----------|--------|--------------|-------------|---------------|
| **Master** | - | ✅ Handoff/Delegate | ❌ | ✅ Delegate |
| **Domain Leads** | ❌ | ❌ | ✅ Delegate | ✅ Delegate |
| **Specialists** | ❌ | ❌ | ❌ | ✅ Delegate |
| **Shared (Penn)** | ❌ | ❌ | ❌ | - |

**Key Rules:**
1. Master can route to any domain lead (that user has hired)
2. Domain leads can delegate to their own specialists
3. Domain leads can delegate to shared agents (Penn)
4. Domain leads CANNOT delegate to other domain leads
5. Specialists CANNOT delegate to other specialists
6. No circular delegation allowed

### Context Passing

When agents communicate, context flows with the request:

```
Context Object:
{
  // User/Org identity
  user_id: "uuid",
  org_id: "uuid",
  
  // What integrations are available
  available_integrations: ["google_search_console", "twitter"],
  
  // Data from previous steps in this workflow
  workflow_data: {
    "keyword_research": { ... },
    "content_brief": { ... }
  },
  
  // User preferences that apply to all agents
  preferences: {
    tone: "professional",
    brand_name: "Acme Inc"
  },
  
  // Current conversation thread
  thread_id: "uuid",
  
  // Who delegated (for context)
  delegated_from: "seomi",
  delegation_depth: 1  // Prevent infinite delegation
}
```

### Delegation Depth Limit

To prevent infinite loops, delegation has a maximum depth:

```
Max Delegation Depth: 3

Example (allowed):
User → SEOmi → seo-content → Penn
       (0)        (1)         (2)

Example (blocked):
User → Master → SEOmi → seo-content → Penn → ??? 
       (0)       (1)        (2)         (3)    (4) ← BLOCKED
```

### Error Handling in Multi-Agent Flows

When a delegated agent fails:

```
1. Delegated agent encounters error
2. Error event emitted with context
3. Delegating agent receives error
4. Delegating agent can:
   a. Retry with different parameters
   b. Try alternative agent
   c. Report failure to user with explanation
5. User sees: "SEOmi tried to get keyword data but encountered an issue. 
              Here's what I can tell you without it..."
```

---

## Shared Context Store

### What is Shared Context?

A persistent store that all agents in a conversation can read from and write to.

### Context Structure

```
Thread Context (per conversation):
├── user_identity
│   ├── user_id
│   ├── org_id
│   └── tier
│
├── integrations
│   ├── connected: ["gsc", "twitter"]
│   └── tokens: { encrypted }
│
├── agent_outputs (accumulated during conversation)
│   ├── seomi.seo_audit: { score: 75, issues: [...] }
│   ├── seo_content.keywords: { keywords: [...] }
│   └── penn.blog_draft: { content: "..." }
│
├── workflow_state (if in a workflow)
│   ├── workflow_id: "content_campaign"
│   ├── current_step: 2
│   └── completed_steps: ["research", "brief"]
│
└── preferences
    ├── brand_voice: "professional"
    ├── target_audience: "developers"
    └── default_language: "en"
```

### Context Operations

| Operation | Description | Example |
|-----------|-------------|---------|
| **Read** | Agent reads existing context | "What keywords did we research?" |
| **Write** | Agent adds to context | Store SEO audit results |
| **Update** | Agent modifies existing entry | Update keyword list |
| **Subscribe** | Agent watches for changes | Alert when audit completes |

### Context Visibility

| Context Type | Visible To |
|--------------|------------|
| User identity | All agents |
| Integrations | Agents with permission |
| Agent outputs | All agents in thread |
| Workflow state | Agents in current workflow |
| Preferences | All agents |

---

## Production Patterns from Industry

### How Other Companies Handle This

| Company/Framework | Pattern | Notes |
|-------------------|---------|-------|
| **LangGraph** | Graph-based routing | Supervisor node decides next agent |
| **AutoGen (Microsoft)** | Group chat | Agents @mention each other |
| **CrewAI** | Task pipelines | Sequential or hierarchical |
| **OpenAI Swarm** | Handoff | Agent returns next agent to call |
| **Anthropic** | Single agent, many tools | Tool specialization vs agent specialization |

### Dooza's Approach

Dooza combines multiple patterns:

1. **Handoff** - Master → Domain Lead (like Swarm)
2. **Delegation** - Domain Lead → Specialist (like CrewAI)
3. **Shared Context** - All agents access common memory
4. **Workflows** - Pre-defined pipelines for routines

### Why This Hybrid Approach?

| Requirement | Solution |
|-------------|----------|
| User doesn't know which agent | Master with handoff |
| Domain expert needs helper | Delegation to specialist |
| Data needs to persist | Shared context |
| Automated recurring tasks | Workflow pipelines |
| Keep UX simple | Hide specialists, show only domain leads |

---

## Agent Hierarchy

### Level 0: Master Agent (Optional Entry Point)

The top-level router that can hand off to any domain.

| Agent | Slug | Role |
|-------|------|------|
| **Dooza** | `master` | General assistant, intent router, cross-domain coordinator |

### Level 1: Domain Orchestrators (User-Facing)

These are the agents users directly interact with. Users "hire" them to join their team.

| Agent | Slug | Domain | Description |
|-------|------|--------|-------------|
| **SEOmi** | `seomi` | SEO | SEO expert, handles audits, delegates to specialists |
| **Soshie** | `soshie` | Social Media | Social media manager, creates posts, schedules content |
| **Vidi** | `vidi` | Video | Video content strategist, scripts, thumbnails |
| **Imagi** | `imagi` | Image/Design | Image creation, design guidance |
| **Dexter** | `dexter` | Data/Analytics | Data analysis, reporting, visualization |
| **Pam** | `pam` | Reception | General assistant, routes to appropriate domain |
| **Cassie** | `cassie` | Support | Customer support specialist |
| **Penn** | `penn` | Content Writing | Copywriter (shared resource, can be delegated to) |

### Level 2: Specialist Agents (Hidden from Users)

Users never interact with these directly. Domain orchestrators delegate to them for complex tasks.

**SEO Specialists:**
| Specialist | Slug | Capabilities |
|------------|------|--------------|
| Technical SEO | `seo-tech` | Site crawling, Core Web Vitals, robots.txt, schema validation |
| Content SEO | `seo-content` | Keyword research, content gaps, content briefs |
| Analytics SEO | `seo-analytics` | GSC integration, rank tracking, competitor monitoring |

**Social Media Specialists:**
| Specialist | Slug | Capabilities |
|------------|------|--------------|
| Twitter Specialist | `social-twitter` | Twitter-optimized content, threads, engagement |
| Instagram Specialist | `social-insta` | Instagram captions, hashtags, image prompts |
| LinkedIn Specialist | `social-linkedin` | Professional content, LinkedIn formatting |

**Video Specialists:**
| Specialist | Slug | Capabilities |
|------------|------|--------------|
| Script Writer | `video-script` | Video scripts, hooks, CTAs |
| Thumbnail Creator | `video-thumb` | Thumbnail concepts, text overlays |

**Data Specialists:**
| Specialist | Slug | Capabilities |
|------------|------|--------------|
| Report Generator | `data-report` | Automated reports, summaries |
| Visualization | `data-visual` | Charts, graphs, dashboards |

---

## Delegation System

### How Delegation Works

1. User talks to a domain orchestrator (e.g., SEOmi)
2. Orchestrator determines if task needs specialist help
3. Orchestrator delegates to specialist with context
4. Specialist completes task and returns result
5. Orchestrator presents result to user with expert commentary

### Delegation Permissions

Each agent has a `can_delegate_to` list in its configuration. Agents can only delegate to agents in this list.

**Example - SEOmi's delegation permissions:**
```
can_delegate_to: ["seo-tech", "seo-content", "seo-analytics", "penn"]
```

**Delegation is NOT allowed to:**
- Agents not in the list
- Other domain orchestrators (SEOmi cannot delegate to Soshie)
- Self-delegation

### Delegation Flow

```
User: "Do a full technical audit of my site"
         │
         ▼
    ┌─────────┐
    │  SEOmi  │  "This needs a site-wide crawl. Let me get my tech specialist."
    └────┬────┘
         │ delegates
         ▼
    ┌──────────┐
    │ seo-tech │  Performs crawl, Core Web Vitals, schema check
    └────┬─────┘
         │ returns results
         ▼
    ┌─────────┐
    │  SEOmi  │  "Here's what we found..." (interprets results for user)
    └─────────┘
```

---

## Hire/Fire System

### Concept

Users build their AI team by "hiring" domain orchestrators. This is similar to a subscription or marketplace model.

### User Actions

| Action | Description |
|--------|-------------|
| **Hire** | Add an orchestrator to user's team, enables chat and routines |
| **Fire** | Remove orchestrator, pauses all routines, keeps history |
| **Pause** | Temporarily disable without losing configuration |
| **Customize** | Rename agent, add custom instructions |

### Business Rules

1. Users can only chat with agents they've hired
2. Firing an agent pauses all its routines
3. Re-hiring restores previous configuration
4. Some agents may require paid tiers
5. Specialists are never directly hired (they come with the orchestrator)

---

## Routines System

### What Are Routines?

Scheduled or manual workflows that an agent executes automatically.

### Routine Properties

| Property | Description |
|----------|-------------|
| Name | Display name for the routine |
| Agent | Which orchestrator runs this routine |
| Task Prompt | What to tell the agent to do |
| Schedule | Cron expression for automatic runs (optional) |
| Context Data | Variables to inject into the prompt |
| Active | Whether routine is currently enabled |

### Example Routines

**Daily SEO Blog (SEOmi):**
```
Schedule: Every day at 9 AM
Task: "Research trending topics, find a keyword opportunity, 
       create a content brief, and delegate to Penn to write 
       a 1500-word blog post."
Context: { niche: "AI tools", tone: "professional" }
```

**Weekly Site Audit (SEOmi):**
```
Schedule: Every Monday at 6 AM  
Task: "Delegate to seo-tech for a full site crawl. Then check 
       GSC for ranking changes. Compile a weekly health report."
Context: { site_url: "example.com" }
```

**Daily Social Posts (Soshie):**
```
Schedule: Every day at 8 AM
Task: "Create 3 Twitter posts, 1 LinkedIn post, and 1 Instagram 
       caption for today. Use our content calendar themes."
Context: { content_pillars: ["AI", "productivity", "tips"] }
```

### Routine Execution

1. Scheduler triggers routine at scheduled time
2. Orchestrator receives the task prompt with injected context
3. Orchestrator may delegate to specialists as needed
4. Results are stored in routine_runs table
5. User can view history and outputs

---

## Integrations System

### Shared Integration Model

Integrations are connected at the user/org level, not per-agent. This means:
- User connects Google Search Console once
- All relevant agents (SEOmi, seo-analytics) can use it
- User controls which agents can access which integrations

### Integration Categories

| Category | Integrations | Used By |
|----------|-------------|---------|
| **Google** | Search Console, Analytics, Drive | SEOmi, Dexter |
| **Social** | Twitter, Instagram, LinkedIn, Facebook | Soshie |
| **CMS** | WordPress, Webflow, Ghost | SEOmi, Penn |
| **Email** | Mailchimp, SendGrid | Marketing agents |
| **SEO Tools** | Ahrefs, SEMrush, DataForSEO | SEOmi specialists |
| **Media** | Canva, Unsplash, DALL-E | Imagi, Vidi |

### Integration Access Control

Each orchestrator has:
- `required_integrations`: Must be connected to use this agent
- `optional_integrations`: Enhanced features if connected

Example:
```
SEOmi:
  required_integrations: []  # Works without any
  optional_integrations: ["google_search_console", "google_analytics", "ahrefs"]
```

---

## UI Architecture

### Principle: Shared Core, Domain-Specific Data

| Component Type | Same/Different | Examples |
|----------------|---------------|----------|
| **Chat Window** | SAME | Message input, streaming response, agent avatar |
| **Routine Manager** | SAME | Create routine, schedule picker, history |
| **Settings** | SAME | Custom name, instructions, preferences |
| **Marketplace** | SAME | Browse agents, hire/fire buttons |
| **Data Visualizers** | DIFFERENT | SEO score gauge vs Social post preview |
| **Data Editors** | DIFFERENT | Meta tag editor vs Post editor |

### Domain Component Registry

Each domain registers its custom components:

```
SEO Domain:
  Visualizers:
    - seo_analyze_url → SEOResultCard (score gauges, issue lists)
    - seo_crawl_site → CrawlResults (site map, page list)
    - seo_keyword_research → KeywordTable (volume, difficulty)
  Editors:
    - seo_analyze_url → SEOEditor (edit meta tags, headings)
    - seo_content_brief → BriefEditor (edit keyword targets)

Social Domain:
  Visualizers:
    - social_create_post → PostPreview (platform mockups)
    - social_analytics → EngagementChart (likes, shares)
  Editors:
    - social_create_post → PostEditor (edit content, hashtags)
    - social_schedule → ScheduleEditor (pick date/time)
```

### User Flow: View → Edit → Save

1. User asks agent to perform task
2. Agent executes tool, returns structured data
3. Chat looks up domain-specific visualizer
4. Visualizer renders rich UI (gauges, previews, tables)
5. User clicks "Edit" button
6. Chat loads domain-specific editor
7. User modifies data in editor
8. User clicks "Save"
9. Edited data sent back to agent for processing

---

## File Structure

### Backend (apps/api)

```
apps/api/app/
├── agents/
│   ├── __init__.py
│   ├── base.py                 # DoozaAgent base class
│   ├── config.py               # AgentConfig dataclass
│   ├── events.py               # SSE event types
│   ├── orchestrator.py         # Multi-agent coordination
│   ├── context.py              # Shared context management
│   ├── router.py               # Intent detection & routing logic
│   │
│   │── # Master Agent (Top Level)
│   ├── master.py               # Master orchestrator / Dooza
│   │
│   │── # Domain Orchestrators
│   ├── seomi.py                # SEO Lead
│   ├── soshie.py               # Social Media Lead
│   ├── vidi.py                 # Video Lead
│   ├── imagi.py                # Image Lead
│   ├── dexter.py               # Data Lead
│   ├── pam.py                  # Reception
│   ├── cassie.py               # Support
│   ├── penn.py                 # Content Writer
│   │
│   │── # SEO Specialists
│   ├── seo_tech.py
│   ├── seo_content.py
│   ├── seo_analytics.py
│   │
│   │── # Social Specialists
│   ├── social_twitter.py
│   ├── social_insta.py
│   ├── social_linkedin.py
│   │
│   │── # Video Specialists
│   ├── video_script.py
│   ├── video_thumb.py
│   │
│   └── # Data Specialists
│       ├── data_report.py
│       └── data_visual.py
│
├── tools/
│   ├── __init__.py
│   ├── base.py                 # DoozaTool base class
│   ├── registry.py             # Tool registry
│   │
│   ├── seo/                    # SEO domain tools
│   │   ├── page_analysis.py    # Single page audit
│   │   ├── crawler.py          # Site-wide crawl
│   │   ├── technical.py        # robots, sitemap, schema
│   │   ├── pagespeed.py        # Core Web Vitals
│   │   └── keywords.py         # Keyword research
│   │
│   ├── social/                 # Social domain tools
│   │   ├── post_creator.py
│   │   ├── scheduler.py
│   │   └── analytics.py
│   │
│   ├── video/                  # Video domain tools
│   │   ├── script.py
│   │   └── thumbnail.py
│   │
│   ├── data/                   # Data domain tools
│   │   ├── query.py
│   │   ├── chart.py
│   │   └── report.py
│   │
│   ├── integrations/           # External API wrappers
│   │   ├── google_search_console.py
│   │   ├── google_analytics.py
│   │   ├── twitter.py
│   │   └── ahrefs.py
│   │
│   └── core/                   # Shared tools
│       └── delegation.py       # delegate_task tool
│
├── routers/
│   ├── chat.py                 # Chat endpoints
│   ├── workforce.py            # Hire/fire, team management
│   ├── routines.py             # Routine CRUD
│   └── integrations.py         # OAuth, connection management
│
├── routines/
│   ├── scheduler.py            # APScheduler integration
│   ├── runner.py               # Execute routines
│   └── templates.py            # Pre-built routine templates
│
└── schemas/
    ├── agents.py
    ├── routines.py
    └── integrations.py
```

### Frontend (apps/web)

```
apps/web/src/
├── components/
│   ├── shared/                 # SAME FOR ALL AGENTS
│   │   ├── ChatWindow.tsx
│   │   ├── ChatInput.tsx
│   │   ├── MessageList.tsx
│   │   ├── RoutineManager.tsx
│   │   ├── RoutineBuilder.tsx
│   │   ├── AgentSettings.tsx
│   │   └── AgentSelector.tsx
│   │
│   └── domains/                # DIFFERENT PER DOMAIN
│       ├── seo/
│       │   ├── SEOResultCard.tsx
│       │   ├── SEOEditor.tsx
│       │   ├── ScoreGauge.tsx
│       │   ├── IssuesList.tsx
│       │   ├── KeywordTable.tsx
│       │   ├── MetaTagEditor.tsx
│       │   └── CrawlMap.tsx
│       │
│       ├── social/
│       │   ├── PostPreview.tsx
│       │   ├── PostEditor.tsx
│       │   ├── ContentCalendar.tsx
│       │   └── EngagementChart.tsx
│       │
│       ├── video/
│       │   ├── ScriptViewer.tsx
│       │   ├── ScriptEditor.tsx
│       │   └── ThumbnailPreview.tsx
│       │
│       └── data/
│           ├── ChartRenderer.tsx
│           ├── TableViewer.tsx
│           └── ReportEditor.tsx
│
├── pages/
│   ├── Dashboard.tsx           # User's main view
│   ├── Marketplace.tsx         # Browse/hire agents
│   ├── Team.tsx                # Manage hired agents
│   ├── Integrations.tsx        # Connect services
│   └── agents/
│       └── [slug].tsx          # Universal agent page
│
└── lib/
    ├── domain-components.ts    # Registry mapping
    ├── workforce-api.ts        # API client
    └── chat-api.ts             # Chat streaming
```

---

## Database Schema

### Tables Overview

| Table | Purpose |
|-------|---------|
| `domain_orchestrators` | Available agents in marketplace |
| `user_agents` | User's hired team |
| `routines` | Scheduled/manual workflows |
| `routine_runs` | Execution history |
| `user_integrations` | Connected external services |
| `domain_ui_components` | UI configuration per domain |
| `conversation_threads` | Conversation state and history |
| `thread_context` | Shared context for inter-agent communication |
| `agent_handoffs` | Log of agent transfers/handoffs |

### Key Relationships

```
domain_orchestrators (marketplace)
         │
         │ user hires
         ▼
    user_agents (user's team)
         │
         │ has many
         ▼
      routines (scheduled tasks)
         │
         │ has many
         ▼
    routine_runs (execution history)


user_integrations (shared services)
         │
         │ used by
         ▼
    multiple agents (based on permissions)


conversation_threads (chat sessions)
         │
         ├── has many → messages (stored separately)
         │
         ├── has many → thread_context (shared data between agents)
         │
         └── has many → agent_handoffs (transfer log)
```

### Inter-Agent Data Flow

```
User starts conversation
         │
         ▼
conversation_threads created
         │
         ├──▶ Master routes to SEOmi
         │         │
         │         ▼
         │    SEOmi runs audit
         │         │
         │         ▼
         ├──▶ thread_context: { "seo_audit": {...} }
         │         │
         │         ▼
         │    SEOmi delegates to seo-content
         │         │
         │         ▼
         ├──▶ thread_context: { "seo_audit": {...}, "keywords": {...} }
         │         │
         │         ▼
         │    seo-content delegates to Penn
         │         │
         │         ▼
         └──▶ thread_context: { "seo_audit": {...}, "keywords": {...}, "blog_draft": {...} }

All agents can READ the full context
Each agent WRITES its own output to context
```

### Table Details

**domain_orchestrators:**
- slug (unique identifier)
- name, domain, description
- specialist_agents (JSON array of specialist slugs)
- required_integrations, optional_integrations
- UI configuration (avatar, gradient, accent color)
- pricing tier

**user_agents:**
- user_id, orchestrator_id
- status (active, paused, fired)
- custom_name, custom_instructions
- hired_at, fired_at

**routines:**
- user_id, orchestrator_id
- name, task_prompt, context_data
- schedule (cron), timezone
- is_active
- last_run_at, next_run_at

**routine_runs:**
- routine_id
- started_at, completed_at
- status (running, success, failed)
- output (JSON), error_message
- triggered_by (schedule, manual, api)

**user_integrations:**
- user_id, integration_slug, provider
- credentials (encrypted)
- status, scopes
- allowed_orchestrators (which agents can use)

**conversation_threads:**
- thread_id (unique identifier)
- user_id, org_id
- current_agent_slug (who is active)
- started_at, last_message_at
- status (active, archived)

**thread_context:**
- thread_id (foreign key)
- context_key (e.g., "seo_audit_result", "keyword_research")
- context_value (JSON)
- set_by_agent (which agent wrote this)
- created_at, updated_at

**agent_handoffs:**
- id, thread_id
- from_agent, to_agent
- reason (why handoff occurred)
- context_snapshot (state at handoff time)
- handoff_at

---

## Event System

### SSE Event Types

| Event | When | Data |
|-------|------|------|
| `token` | Streaming text | content string |
| `tool_start` | Tool execution begins | tool name, args |
| `tool_end` | Tool execution completes | tool name, output preview |
| `tool_data` | Structured tool result | full data for visualization |
| `delegation_start` | Agent delegates to another | from, to, task |
| `delegation_end` | Delegation completes | from, to |
| `handoff` | Agent transfers conversation | from, to, reason |
| `context_update` | Shared context changed | key, value |
| `workflow_step` | Workflow step status | workflow_id, step, status |
| `agent_thinking` | Agent is processing | agent_slug |
| `error` | Error occurred | error message, recoverable |
| `end` | Response complete | - |

### Frontend Event Handling

```
token → Append to message text
tool_start → Show "Using [tool]..." indicator
tool_data → Render domain-specific visualizer
delegation_start → Show "Delegating to [agent]..." 
delegation_end → Resume main agent display
handoff → Switch active agent in UI, show transition
context_update → Update local context cache
workflow_step → Update workflow progress indicator
agent_thinking → Show agent avatar with thinking state
end → Mark message complete
```

### Handoff vs Delegation Events

| Aspect | Delegation | Handoff |
|--------|------------|---------|
| **Event flow** | delegation_start → ... → delegation_end | handoff (single event) |
| **Original agent** | Stays active, waits for result | Exits completely |
| **User sees** | "Delegating to X for help..." | "Transferring you to X..." |
| **Frontend action** | Show sub-agent activity | Switch active agent |
| **When complete** | Original agent responds | New agent continues |

---

## Implementation Phases

### Phase 1: Foundation (Required First)

**Database:**
- Add domain_orchestrators table
- Add user_agents table  
- Add routines and routine_runs tables
- Add conversation_threads table
- Add thread_context table
- Add agent_handoffs table

**Backend:**
- Implement delegate() method in DoozaAgent
- Implement handoff() method in DoozaAgent
- Add delegation and handoff events
- Create shared context manager (context.py)
- Create workforce API routes

### Phase 1.5: Inter-Agent Communication

**Backend:**
- Create orchestrator.py (central coordination)
- Create router.py (intent detection)
- Implement context passing between agents
- Add delegation depth limiting
- Error handling for failed delegations

**Testing:**
- Verify SEOmi → specialist delegation works
- Verify context persists across agents
- Verify delegation depth limit is enforced

### Phase 2: Master Agent

**Backend:**
- Create master.py (Master/Dooza agent)
- Implement intent detection logic
- Implement handoff to domain leads
- Cross-domain workflow support

**Frontend:**
- Add Master as default entry point
- Handle handoff events in UI
- Show "Transferring to X..." transitions

### Phase 3: First Domain Complete (SEO)

**Backend:**
- Create seo_tech.py specialist
- Create seo_content.py specialist
- Create seo_analytics.py specialist
- Add site crawler tool
- Add PageSpeed tool
- Add GSC integration tool

**Frontend:**
- Domain component registry
- SEO visualizers (already partially done)
- SEO editors

### Phase 4: Routines

**Backend:**
- Scheduler service (APScheduler)
- Routine runner
- Routine templates

**Frontend:**
- Universal routine manager
- Routine builder with templates

### Phase 5: Additional Domains

Replicate the SEO pattern for:
- Social Media (Soshie + specialists)
- Video (Vidi + specialists)
- Data (Dexter + specialists)

### Phase 6: Cross-Domain Workflows

**Backend:**
- Define workflow templates (content campaigns, launches)
- Implement workflow executor
- Cross-domain context sharing

**Frontend:**
- Workflow builder UI
- Multi-agent progress tracking

### Phase 7: Polish

- Marketplace UI
- Usage tracking
- Billing integration (if applicable)
- Advanced routine features
- Context cleanup and optimization
- Performance monitoring for multi-agent flows

---

## Key Design Decisions

### 1. Flat File Structure for Agents

Agents are stored as individual files at the same level (not nested in domain folders).

**Why:** 
- Consistent with existing pattern
- Simple imports
- Easy to discover
- `seo_` prefix acts as namespace

### 2. Hidden Specialists

Users never see or interact with specialists directly.

**Why:**
- Simpler UX - users talk to one agent per domain
- Allows implementation changes without user impact
- Specialists are internal optimization, not user feature

### 3. Shared Integrations

Integrations connected once, used by all relevant agents.

**Why:**
- Users don't want to connect GSC separately for each agent
- Reduces friction
- Matches how real teams work (shared access to tools)

### 4. Same Chat UI, Different Visualizers

Chat interface identical for all agents, data rendering domain-specific.

**Why:**
- Familiar experience across agents
- Domain expertise shown in data presentation
- Easier maintenance

### 5. Database-Driven Agent Registry

Agents defined in database (with code fallbacks).

**Why:**
- Can add/modify agents without deployment
- A/B testing agent variations
- User-specific agent availability

### 6. Master Agent is Optional

Users can bypass Master and talk directly to domain leads.

**Why:**
- Power users know which agent they need
- Reduces latency (skip routing step)
- Master is for discovery, not gatekeeping

### 7. Handoff vs Delegation Distinction

Two different patterns for two different needs.

**Delegation:** Parent agent stays active, gets result back
**Handoff:** Parent agent exits, new agent takes over

**Why:**
- Handoff for routing (Master → SEOmi)
- Delegation for help (SEOmi → specialist)
- Clear mental model for users

### 8. Shared Context, Not Message Passing

Agents share a context store rather than passing messages to each other.

**Why:**
- Avoids message format compatibility issues
- Any agent can read any previous output
- Simpler than pub/sub for our use case
- Easier to debug (context is inspectable)

### 9. Delegation Depth Limit of 3

Maximum 3 levels of agent-to-agent calls.

**Why:**
- Prevents infinite loops
- Forces clear hierarchy design
- Keeps response times reasonable
- User → Domain Lead → Specialist → Shared = 3 levels (enough for all cases)

### 10. Context Scoped to Thread

Shared context lives within a conversation thread, not globally.

**Why:**
- Privacy: different conversations don't leak
- Cleanup: context deleted when thread archived
- Performance: context stays small
- Relevance: only current conversation data matters

---

## Success Criteria

### For MVP

- [ ] User can hire/fire domain orchestrators
- [ ] User can chat with any hired agent
- [ ] User can chat with Master agent (routes to domains)
- [ ] SEOmi can delegate to seo-tech for site crawl
- [ ] Basic routine scheduling works
- [ ] Domain-specific visualizers render in chat
- [ ] Shared context persists across agent interactions

### For Production

- [ ] All domain orchestrators implemented
- [ ] Full specialist coverage per domain
- [ ] Master agent with intent detection
- [ ] Handoff between Master and domain leads
- [ ] Cross-domain workflows (SEO + Social campaigns)
- [ ] Integration OAuth flow for major platforms
- [ ] Routine templates library
- [ ] Usage tracking and limits
- [ ] Error handling and recovery
- [ ] Delegation depth limits enforced
- [ ] Context cleanup for completed threads

---

## Glossary

| Term | Definition |
|------|------------|
| **Master Agent** | Top-level orchestrator that routes to domain leads based on user intent |
| **Domain Orchestrator** | User-facing agent that leads a domain (SEOmi, Soshie) |
| **Specialist** | Hidden agent that handles specific tasks within a domain |
| **Delegation** | When one agent passes a task to another agent and waits for result |
| **Handoff** | When one agent transfers the conversation completely to another agent |
| **Shared Context** | Persistent memory that all agents in a conversation can access |
| **Workflow** | Pre-defined sequence of agent tasks for automated pipelines |
| **Routine** | Scheduled or manual workflow executed by an agent |
| **Integration** | External service connection (GSC, Twitter, etc.) |
| **Visualizer** | Domain-specific UI component for displaying tool results |
| **Editor** | Domain-specific UI component for modifying tool results |
| **Hire** | User action to add an orchestrator to their team |
| **Fire** | User action to remove an orchestrator from their team |
| **Context Passing** | Transferring data and state between agents during communication |
| **Delegation Depth** | How many levels deep agent-to-agent calls can go (max 3) |
| **Intent Detection** | Master agent determining which domain a request belongs to |

---

## References

- `apps/api/app/agents/base.py` - DoozaAgent base class
- `apps/api/app/agents/config.py` - AgentConfig structure
- `apps/api/app/agents/seomi.py` - Example orchestrator
- `apps/api/app/tools/seo.py` - Example tool implementation
- `docs/agent-architecture-plan.md` - Previous architecture notes
