---
tags: [foundations, mental-models, taxonomy]
complexity: foundational
prerequisites: []
---

# Foundations of Agent Systems

> What agents are, how they differ from simple LLM calls, and the mental models you need before building one.

---

## What Is an Agent?

An agent is a system where an LLM operates in a loop, using tools to take actions in the real world, observing results, and deciding what to do next — until a task is complete. The key distinction from a simple chatbot:

| Simple LLM Call | Agent |
|----------------|-------|
| One prompt → one response | Loop of prompts, actions, observations |
| No side effects | Executes tools (APIs, file I/O, shell, databases, etc.) |
| Stateless | Maintains context across turns |
| Human drives every step | Autonomous within boundaries |
| Fixed capabilities | Extensible via tools and plugins |

An agent is **an LLM with a loop and tools**. Everything else — multi-agent orchestration, memory, planning, permissions — builds on this foundation.

---

## The Universal Agent Loop

Every agent system, regardless of framework or language, implements this core loop:

```
┌─────────────────────────────────────────┐
│              AGENT LOOP                  │
│                                         │
│  1. Receive input (user or system)      │
│  2. Assemble context (prompt + history) │
│  3. Call LLM with context + tools       │
│  4. Parse response                      │
│       ├── Text → return to user         │
│       └── Tool call → execute tool      │
│            └── Feed result back → go to 3│
│  5. Check stop conditions               │
│       ├── No more tool calls → done     │
│       ├── Budget exceeded → done        │
│       └── Max turns reached → done      │
└─────────────────────────────────────────┘
```

This is the **query-execute-observe** cycle. The LLM queries its available tools, the system executes the chosen tool, the LLM observes the result, and the cycle repeats. This loop is the beating heart of every agent — get it right, and everything else follows.

For a deep dive, see [01_agent_loop.md](01_agent_loop.md).

---

## Agent Taxonomy

Not all agents are the same. Here's a taxonomy of common agent architectures, from simplest to most complex:

### Single-Turn Agent
- Receives input, makes one or more tool calls, returns a response
- No persistent state between invocations
- Examples: a CLI tool that answers a question using web search, an API endpoint that classifies a support ticket

### Conversational Agent
- Maintains conversation history across multiple turns
- User interacts back-and-forth with the agent
- Examples: a coding assistant, a customer support bot, a data analysis copilot

### Autonomous Agent
- Given a high-level goal, works independently until done
- Makes its own decisions about which tools to use and in what order
- May plan, decompose tasks, and self-correct
- Examples: "refactor this module," "resolve this support backlog," "generate this weekly report from our data sources"

### Multi-Agent System
- Multiple agents collaborating or coordinating
- A coordinator delegates tasks to specialist agents
- Agents may run in parallel (fan-out/fan-in) or sequentially (pipeline)
- Examples: one agent plans and another executes, one agent drafts content and another reviews it

### Orchestrated Swarm
- Many worker agents performing similar tasks in parallel
- A controller distributes work and aggregates results
- Examples: processing a batch of documents, running parallel analyses across datasets, applying the same transformation to many files

---

## Autonomy Spectrum

Agents sit on a spectrum from fully manual to fully autonomous:

```
Fully Manual                                           Fully Autonomous
     │                                                          │
     ▼                                                          ▼
  Chatbot → Copilot → Supervised Agent → Autonomous Agent → Swarm
  (suggests) (assists)  (acts with      (acts              (self-
                         approval)       independently)     organizing)
```

Most production agents sit in the **supervised agent** zone: they can act independently for safe operations but escalate to humans for anything risky. This is the sweet spot between capability and safety.

### Where to Start

Start at the "supervised agent" level. Build:
1. The core loop (query-execute-observe)
2. A tool system (give the agent capabilities)
3. A permission system (control what it can do)
4. Human-in-the-loop approval for risky operations

Then gradually expand toward more autonomy as you build confidence in the system.

---

## Key Abstractions

Every agent system needs these building blocks:

### 1. The Agent Loop (Query Engine)
The core execution cycle that sends context to the LLM, receives responses, executes tool calls, and manages turns. This is the foundation everything else builds on.

→ [01_agent_loop.md](01_agent_loop.md)

### 2. Tools
Discrete capabilities the agent can use — API calls, file operations, database queries, shell execution, web access, etc. Each tool has an input schema, execution logic, and a permission model. The specific tools depend on your domain (a coding agent uses file tools; a support agent uses CRM tools; a data agent uses query tools).

→ [02_tool_system.md](02_tool_system.md)

### 3. Context Window
The agent's working memory — a fixed-size window that holds the system prompt, conversation history, tool definitions, and tool results. Managing it well is critical.

→ [04_context_memory.md](04_context_memory.md)

### 4. Permissions
Rules that control what the agent can and can't do. Tiers from auto-approve to always-deny, with human-in-the-loop approval for gray areas.

→ [05_permissions_safety.md](05_permissions_safety.md)

### 5. System Prompt
The instructions that define the agent's identity, behavior, and constraints. Assembled from multiple sources (base instructions, project context, tool descriptions, memory).

→ [04_context_memory.md §Context Assembly](04_context_memory.md)

### 6. State
Session data, configuration, user preferences, and metrics. Managed as a singleton with accessor functions.

→ [10_state_lifecycle.md](10_state_lifecycle.md)

---

## Architecture of a Minimal Agent

Here is the minimum viable architecture for a useful agent:

```
┌──────────────────────────────────────────────────────┐
│                    YOUR APPLICATION                    │
│                                                        │
│  ┌──────────────┐    ┌───────────────┐                │
│  │  User Input   │───▶│  Agent Loop    │               │
│  └──────────────┘    │               │                │
│                      │  1. Context   │    ┌──────────┐│
│                      │  2. LLM Call  │───▶│  LLM API ││
│                      │  3. Parse     │◀───│          ││
│                      │  4. Execute   │    └──────────┘│
│                      │  5. Loop      │                │
│                      └───────┬───────┘                │
│                              │                        │
│                      ┌───────▼───────┐                │
│                      │  Tool System   │               │
│                      │               │                │
│                      │  [Your domain │                │
│                      │   tools here] │                │
│                      │               │                │
│                      │  e.g. Read,   │                │
│                      │  Write, Query,│                │
│                      │  Search, API  │                │
│                      └───────────────┘                │
│                                                        │
│  ┌──────────────┐    ┌───────────────┐                │
│  │  Permissions  │    │  Session State │               │
│  └──────────────┘    └───────────────┘                │
└──────────────────────────────────────────────────────┘
```

### Build Order

1. **Agent loop** — the core query-execute-observe cycle ([01_agent_loop.md](01_agent_loop.md))
2. **2-3 basic tools** — whatever your domain needs: file tools for a coding agent, API tools for a support agent, query tools for a data agent ([02_tool_system.md](02_tool_system.md))
3. **Simple permissions** — read-only auto-approve, mutations require approval ([05_permissions_safety.md](05_permissions_safety.md))
4. **Context management** — token tracking, basic compaction ([04_context_memory.md](04_context_memory.md))

This gets you a working agent in any domain. Everything else is incremental improvement.

---

## Mental Models

### The Agent as an Intern
Think of your agent as a capable intern: it can do the work, but needs clear instructions, appropriate tools, and guardrails. Give it too much freedom and things break. Give it too little and it's useless.

### Tools as the Agent's Hands
The LLM is the brain. Tools are the hands. Without tools, the agent can only talk. With tools, it can act. The quality of your tool implementations directly determines the quality of your agent.

### Context Window as Working Memory
Humans can hold about 7 items in working memory. An LLM's context window is its working memory — larger than ours, but still finite. Everything in the context affects the agent's performance. Irrelevant context is noise. Missing context is a blind spot.

### Permissions as Guardrails, Not Walls
Good guardrails keep you on the road without preventing you from driving. Similarly, permissions should enable the agent to work efficiently while preventing catastrophic mistakes. If permissions create too much friction, users disable them.

---

## How to Read This Guide

This guide is organized in learning order for building from scratch, but each file is self-contained. Use the approach that works for you:

**Sequential** — Read 00 → 01 → 02 → 03 → ... for a complete education.

**Problem-driven** — Check the [DECISION_TREE.md](../DECISION_TREE.md) to find the guide for your specific problem.

**Keyword search** — Grep [INDEX.md](../INDEX.md) for the concept you need.

**Template-first** — Start from a code template in `templates/` and read the corresponding guide when you need to understand a design decision.

---

## Tags

#foundations #mental-models #taxonomy #agent-loop #autonomy #architecture #building-blocks #minimal-agent #query-execute-observe
