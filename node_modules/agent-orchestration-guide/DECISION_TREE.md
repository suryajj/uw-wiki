# Agent Orchestration Guide — Decision Tree

> "What are you building?" — Use this to find the right guide for your task.

---

## Starting From Scratch?

```
Are you building an agent system from scratch?
│
├── YES → Read guides/00_foundations.md first
│         Then → guides/01_agent_loop.md (core execution cycle)
│         Then → guides/02_tool_system.md (give your agent capabilities)
│
└── NO → Adding to an existing agent? Jump to the relevant section below.
```

---

## What Are You Working On?

### I need my agent to DO things (tools / capabilities)

```
What kind of capability?
│
├── File operations (read, write, edit)
│   └── guides/08_tool_catalog.md §File Tools
│
├── Shell / command execution
│   └── guides/08_tool_catalog.md §Shell Execution Tools
│
├── Search (files, code, content)
│   └── guides/08_tool_catalog.md §Search Tools
│
├── Web access (fetch pages, search the web)
│   └── guides/08_tool_catalog.md §Web Tools
│
├── Custom / domain-specific tools
│   └── guides/02_tool_system.md (full tool design guide)
│
└── Dynamic tools from external servers (MCP)
    └── guides/09_protocols.md §Model Context Protocol
```

### I need multiple agents working together

```
What kind of multi-agent setup?
│
├── One main agent delegating tasks to sub-agents
│   └── guides/03_multi_agent.md §Spawning Sub-Agents
│
├── A coordinator directing multiple specialists
│   └── guides/03_multi_agent.md §The Coordinator Pattern
│
├── Parallel workers doing the same kind of task
│   └── guides/03_multi_agent.md §Swarm Pattern
│
├── Agents communicating with each other (teams)
│   └── guides/03_multi_agent.md §Team-Based Collaboration
│
└── Background / async agent execution
    └── guides/03_multi_agent.md §Background and Async Agents
```

### I need to manage context / memory

```
What's the challenge?
│
├── Running out of context window space
│   └── guides/04_context_memory.md §Compaction Strategies
│
├── Need to track token usage / budget
│   └── guides/04_context_memory.md §Token Budget Tracking
│
├── Need long-term memory across sessions
│   └── guides/04_context_memory.md §Long-Term Memory Systems
│
├── Need to build the system prompt / context assembly
│   └── guides/04_context_memory.md §Context Assembly
│
└── Need to summarize / compress conversation history
    └── guides/04_context_memory.md §Compaction Strategies
```

### I need safety / permission controls

```
What's the concern?
│
├── Users should approve dangerous operations
│   └── guides/05_permissions_safety.md §The Permission Tier Model
│   └── guides/06_human_in_loop.md §Approval Flow Architecture
│
├── Need to sandbox tool execution
│   └── guides/05_permissions_safety.md §Sandboxing Strategies
│
├── Need rule-based access control (allow/deny)
│   └── guides/05_permissions_safety.md §Permission Rules
│
├── Need to prevent destructive operations
│   └── guides/05_permissions_safety.md §Destructive Operation Handling
│
└── Need initial trust / onboarding flow
    └── guides/06_human_in_loop.md §Initial Trust Establishment
```

### I need planning / task management

```
What's the need?
│
├── Agent should plan before executing
│   └── guides/07_planning_reasoning.md §Plan Mode Architecture
│
├── Need task decomposition (break big tasks into steps)
│   └── guides/07_planning_reasoning.md §Task Decomposition
│
├── Need a todo / task tracking system
│   └── guides/07_planning_reasoning.md §Todo and Task Tracking
│
└── Need to switch between modes (plan vs execute)
    └── guides/07_planning_reasoning.md §Mode Switching
```

### I need to integrate with external systems

```
What kind of integration?
│
├── IDE integration (VS Code, JetBrains, etc.)
│   └── guides/09_protocols.md §IDE Integration
│
├── MCP (Model Context Protocol) server/client
│   └── guides/09_protocols.md §Model Context Protocol
│
├── Remote / cloud sessions
│   └── guides/09_protocols.md §Remote Sessions
│
└── Custom transport protocol (WebSocket, SSE, HTTP)
    └── guides/09_protocols.md §Transport Layer Patterns
```

### I need to manage state / configuration

```
What specifically?
│
├── Session state management
│   └── guides/10_state_lifecycle.md §Session State Singleton
│
├── Layered configuration (global → project → local)
│   └── guides/10_state_lifecycle.md §Configuration Hierarchy
│
├── Bootstrap / startup sequence
│   └── guides/10_state_lifecycle.md §Bootstrap Sequence
│
└── Settings migration between versions
    └── guides/10_state_lifecycle.md §Settings Migrations
```

### I need extensibility / hooks

```
What kind of extensibility?
│
├── Run custom logic before/after tool calls
│   └── guides/02_tool_system.md §Hook and Lifecycle System
│
├── Let users/plugins extend the system
│   └── guides/02_tool_system.md §Hook and Lifecycle System
│
└── Intercept and transform tool results
    └── guides/02_tool_system.md §PreToolUse / PostToolUse Pattern
```

### I need to optimize cost / performance

```
What's the bottleneck?
│
├── API costs too high
│   └── guides/04_context_memory.md §Cache-Aware Prompt Splitting
│   └── guides/03_multi_agent.md §Cache-Aware Sub-Agent Spawning
│
├── Startup too slow
│   └── guides/10_state_lifecycle.md §Fast-Path Optimization
│
├── Tool execution too slow
│   └── guides/02_tool_system.md §Concurrency and Safety Flags
│
└── Context growing too large
    └── guides/04_context_memory.md §Compaction Strategies
```

### I want general best practices

```
guides/11_patterns_antipatterns.md
├── §Proven Patterns — what works
├── §Anti-Patterns — what to avoid
├── §Architecture Patterns for AI-Native Products — 11 key patterns
├── §Error Handling — resilience strategies
├── §System Prompt Design — prompt engineering for agents
└── §Scaling Considerations — growing your agent system
```

---

## Quick Combos (Common Architectures)

### Minimal Agent (read + execute + respond)
1. `guides/00_foundations.md` — understand the model
2. `guides/01_agent_loop.md` — build the loop
3. `guides/02_tool_system.md` — add basic tools
4. `templates/typescript/agent-loop.ts` or `templates/python/agent_loop.py`

### Domain-Specific Agent (coding, support, data, workflow, etc.)
1. All of the above, plus:
2. `guides/08_tool_catalog.md` — tool catalog patterns (adapt to your domain)
3. `guides/05_permissions_safety.md` — safe tool execution
4. `guides/06_human_in_loop.md` — user approval for risky operations

### Multi-Agent System (coordinator + workers)
1. All of Minimal Agent, plus:
2. `guides/03_multi_agent.md` — orchestration patterns, cache-aware spawning
3. `guides/04_context_memory.md` — shared context strategies
4. `guides/07_planning_reasoning.md` — task decomposition

### Production Agent (full featured)
1. Read all guides in order (00–11)
2. Reference `case-studies/claude-code/` for a real-world example
3. Read `guides/11_patterns_antipatterns.md §Architecture Patterns` for key production patterns
4. Use templates as starting points

---

*Use this tree to navigate the guide. For keyword-based lookup, see [INDEX.md](INDEX.md).*
