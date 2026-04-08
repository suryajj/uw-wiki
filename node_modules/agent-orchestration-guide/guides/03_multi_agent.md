---
tags: [multi-agent, orchestration, sub-agents, delegation, coordination]
complexity: intermediate
prerequisites: [00_foundations, 01_agent_loop, 02_tool_system]
---

# Multi-Agent Orchestration

> How to spawn sub-agents, implement orchestration topologies, build coordinator patterns, and manage teams of agents working together.

---

## Why Multi-Agent?

A single agent has limits:
- **Context window** — one agent can only hold so much context
- **Specialization** — different tasks benefit from different prompts/tools/models
- **Parallelism** — sequential execution is slow for independent tasks
- **Isolation** — risky experiments shouldn't pollute the main agent's state

Multi-agent systems solve these by delegating work to specialized sub-agents that operate with their own context, tools, and constraints.

---

## Spawning Sub-Agents

A sub-agent is an independent agent instance spawned by a parent agent to handle a specific task.

### The AgentTool Pattern

Implement sub-agent spawning as a tool that the parent agent can call:

```
AgentTool {
  name: "Agent"
  input: {
    prompt: string              // Task description for the sub-agent
    agentType?: string          // Which agent definition to use
    allowedTools?: string[]     // Tool subset for the sub-agent
    model?: string              // Model override
    permissionMode?: string     // Permission restrictions
  }
  
  execution:
    1. Create a new agent loop instance
    2. Configure with specified tools, model, permissions
    3. Inject the prompt as user input
    4. Run the agent loop to completion
    5. Return the sub-agent's final response to the parent
}
```

### Sub-Agent Isolation

Sub-agents should be isolated from the parent:
- **Own context window** — starts fresh, doesn't inherit parent's full history
- **Own tool set** — can be restricted (e.g., read-only sub-agent)
- **Own permission mode** — can be more or less restrictive than parent
- **Shared filesystem** — operates on the same codebase
- **Cost tracking** — costs roll up to the parent session

### What to Pass to Sub-Agents

| Pass | Don't Pass |
|------|-----------|
| Task description | Full conversation history |
| Relevant context snippets | Unrelated context |
| File paths to work with | All session memory |
| Constraints and requirements | Parent's internal state |

The key insight: give sub-agents **focused context**. They perform better with a clear task and minimal noise than with the parent's full history.

---

## Orchestration Topologies

### 1. Hub-and-Spoke (Coordinator)

One central coordinator delegates to specialist agents:

```
                    ┌──────────────┐
                    │  Coordinator  │
                    └──────┬───────┘
               ┌───────────┼───────────┐
               ▼           ▼           ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │  Agent A  │ │  Agent B  │ │  Agent C  │
        │(specialist│ │(specialist│ │(specialist│
        │  domain 1)│ │  domain 2)│ │  domain 3)│
        └──────────┘ └──────────┘ └──────────┘
```

- Coordinator plans the work and delegates
- Each agent handles a specific domain
- Coordinator aggregates results
- Best for: heterogeneous tasks with clear domain boundaries

### 2. Pipeline (Sequential)

Agents process in sequence, each building on the previous:

```
Agent A → Agent B → Agent C → Result
(plan)    (implement)  (review)
```

- Each agent receives the output of the previous
- Best for: tasks with natural phases (plan → implement → test → review)
- Risk: errors compound through the pipeline

### 3. Fan-Out / Fan-In (Parallel)

Parent spawns multiple agents working in parallel on independent tasks:

```
              ┌──────────┐
              │  Parent   │
              └─────┬─────┘
         ┌──────────┼──────────┐
         ▼          ▼          ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │  Agent 1  │ │  Agent 2  │ │  Agent 3  │
   │ (file A)  │ │ (file B)  │ │ (file C)  │
   └──────┬───┘ └──────┬───┘ └──────┬───┘
         └──────────┼──────────┘
                    ▼
              ┌──────────┐
              │  Parent   │
              │ (merge)   │
              └──────────┘
```

- All agents work simultaneously
- Parent waits for all to complete, then merges results
- Best for: independent tasks (editing different files, running different tests)
- Risk: merge conflicts if agents touch overlapping areas

### 4. Swarm (Worker Pool)

Many identical worker agents process a queue of similar tasks:

```
                    ┌──────────────┐
                    │  Controller   │
                    │  (task queue) │
                    └──────┬───────┘
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌──────────┐     ┌──────────┐     ┌──────────┐
   │ Worker 1  │     │ Worker 2  │     │ Worker 3  │
   │ (task X)  │     │ (task Y)  │     │ (task Z)  │
   └──────────┘     └──────────┘     └──────────┘
```

- Controller distributes homogeneous tasks to a pool of workers
- Workers are identical (same tools, model, prompt)
- Best for: batch processing (e.g., apply the same refactor across many files)

---

## The Coordinator Pattern

A coordinator is a specialized agent whose primary job is to plan and delegate, not to execute directly.

### Coordinator Design

```
CoordinatorAgent {
  systemPrompt: "You are a coordinator. Your job is to:
    1. Understand the user's request
    2. Break it into sub-tasks
    3. Delegate each sub-task to an appropriate agent
    4. Monitor progress
    5. Aggregate results
    You should NOT execute tasks directly — delegate to specialists."
  
  tools: [
    AgentTool,        // Spawn sub-agents
    TaskCreateTool,   // Track sub-tasks
    TaskGetTool,      // Check task status
    FileReadTool,     // Read for planning context
    GrepTool,         // Search for planning context
  ]
  
  // Restricted — no write tools
}
```

### When to Use a Coordinator

- Task spans multiple files or systems
- Task benefits from parallel execution
- Different parts need different specializations
- The overall context would exceed a single agent's window

### When NOT to Use a Coordinator

- Task is simple and fits in one agent's context
- The overhead of coordination exceeds the benefit
- Tasks are tightly coupled (agents would conflict)

---

## Delegation Strategies

### By Domain

Delegate based on what part of the system or workflow the task touches:

| Sub-Task Domain | Delegate To |
|----------------|-------------|
| Domain-specific logic | Specialist agent for that domain |
| Data retrieval/research | Research agent with search tools |
| Content generation | Generation agent with write tools |
| Verification/review | Review agent with read-only tools |

The domains depend on your application. A coding agent might split by backend/frontend/tests. A GTM agent might split by outreach/content/analytics. A support agent might split by triage/resolution/escalation.

### By Capability

Delegate based on what skills are needed:

| Capability Needed | Agent Configuration |
|-------------------|-------------------|
| Creation/generation | Full write tool access, task-specific prompt |
| Review/analysis | Read-only tools, review-focused prompt |
| Research/discovery | Search + retrieval tools only |
| Execution/verification | Execution tools, verification-focused prompt |

### By Risk Level

Delegate risky operations to agents with appropriate restrictions:

| Risk Level | Agent Configuration |
|------------|-------------------|
| Low (read-only) | Auto-approve all, no restrictions |
| Medium (writes) | Ask-once permission mode |
| High (shell, destructive) | Ask-always, restricted tools |

---

## Background and Async Agents

Some tasks are long-running and shouldn't block the main agent:

### Background Agent Pattern

```
function spawnBackgroundAgent(task):
  agent = createAgent(task)
  outputFile = createTemporaryFile()
  
  // Run in background — output streams to file
  runInBackground(agent, outputFile)
  
  return {
    agentId: agent.id,
    outputFile: outputFile.path,
    status: "running",
  }
```

### Monitoring Background Agents

The parent agent can check on background agents:
- **TaskOutputTool** — read the current output of a background agent
- **TaskStopTool** — cancel a background agent
- **Polling** — periodically check if the agent has completed

### Output Streaming

Background agents write their output to a file that can be tailed:
- Header: agent ID, PID, start time
- Body: agent output as it streams
- Footer: exit code, elapsed time (when complete)

---

## Task-Based Orchestration

For complex multi-agent work, use a task management system:

### Task Lifecycle

```
Task {
  id: string
  description: string
  status: pending | in_progress | completed | failed | cancelled
  assignee?: AgentId
  result?: string
  dependencies: TaskId[]
}
```

### Orchestration Flow

1. Coordinator creates tasks with dependencies
2. Tasks with no dependencies are assigned to agents
3. Agents work on their tasks and update status
4. When a task completes, check if dependent tasks can start
5. When all tasks complete, coordinator aggregates results

---

## Team-Based Collaboration

For agents that need to communicate directly with each other (not just through a coordinator):

### Team Model

```
Team {
  id: string
  name: string
  members: AgentId[]
  mailbox: Message[]       // Shared message queue
}
```

### Inter-Agent Communication

```
SendMessageTool {
  input: { teamId: string, message: string }
  // Delivers message to team mailbox
  // Other agents on the team can read it
}
```

### When to Use Teams

- Agents working on tightly coupled tasks
- Need to share discoveries without going through coordinator
- Real-time coordination (e.g., one agent writes code, another writes tests simultaneously)

---

## Cache-Aware Sub-Agent Spawning

When spawning sub-agents, design for prompt cache sharing. If multiple sub-agents share the same system prompt prefix (role instructions, tool definitions, project context), they can share the same API cache — meaning 5 parallel agents cost barely more than 1 sequential agent.

### How It Works

1. **Byte-identical prefix** — when forking a sub-agent, create a copy of the parent's context that is byte-identical up to the cache boundary
2. **Same tool ordering** — sort tools alphabetically so every agent has the same tool definitions in the same order
3. **Same static prompt** — sub-agents inherit the parent's stable system prompt without modification
4. **Diverge only in task** — the sub-agent's unique task description goes in the dynamic section (after the cache boundary)

### Three Execution Models

| Model | Process | Cache | Isolation | Communication | Best For |
|-------|---------|-------|-----------|---------------|----------|
| **Fork** | Same process | Shared with parent | Low (shared memory) | Direct return value | Quick subtasks, cache-optimized parallel work |
| **Teammate** | Separate process/pane | Shared prefix | Medium (own process) | File-based mailbox | Tightly coupled collaboration |
| **Worktree** | Separate process | Shared prefix | High (own working copy) | File-based + merge | Independent tasks that might conflict |

### File-Based Inter-Agent Communication

For agents running as separate processes, file-based communication is simple and robust. Each agent writes to a JSON file in a known directory. Other agents poll or watch for messages. This avoids the complexity of message queues while being reliable and debuggable. The mailbox pattern:

```
~/.agent/mailbox/
  agent-001.json    ← messages for agent 001
  agent-002.json    ← messages for agent 002
  team-lead.json    ← messages for coordinator
```

---

## Parallel Execution

### Identifying Parallelizable Work

Tasks are parallelizable when they:
- Touch different files
- Have no data dependencies
- Don't conflict in their effects

### Conflict Prevention

When running agents in parallel on the same codebase:
1. **Git worktrees** — each agent gets its own branch/worktree
2. **File locking** — track which files each agent is modifying
3. **Merge strategy** — reconcile changes after parallel work completes
4. **Conflict detection** — check for overlapping modifications before merging

### Worktree Pattern

```
function parallelWithWorktrees(tasks):
  for task in tasks:
    branch = createBranch(task.name)
    worktree = git.worktree.add(branch)
    agent = createAgent(task, cwd=worktree.path)
    agents.append(agent)
  
  // Run all agents in parallel
  results = await Promise.all(agents.map(a => a.run()))
  
  // Merge results back
  for result in results:
    git.merge(result.branch)
```

---

## Case Study: Claude Code

Claude Code implements a comprehensive multi-agent system with 11 agent/task tools and several experimental features discovered in the source.

### AgentTool and Built-in Agent Types

`AgentTool` spawns sub-agents via `spawnMultiAgent()`. Each sub-agent gets isolated context, tools, and permissions. Two built-in agent types are used by plan mode:

- **`EXPLORE_AGENT`** — specialized for codebase research; launched in parallel during plan mode Phase 1
- **`PLAN_AGENT`** — specialized for implementation design; produces structured plans in Phase 2

Custom agents are defined as markdown files with YAML frontmatter in `.claude/agents/`:
```yaml
---
agentType: "backend-specialist"
description: "Handles backend API changes"
tools: ["FileRead", "FileEdit", "Bash", "Grep"]
model: "claude-sonnet-4-6"
permissionMode: "default"
---
System prompt content here...
```

### Coordinator Mode (Experimental)

A lead agent breaks tasks apart and spawns parallel workers in isolated git worktrees (`coordinator/coordinatorMode.ts`). Key characteristics:
- The coordinator has a **restricted tool set** — primarily Agent, TaskStop, SendMessage
- Workers get full tool access (Bash, Read, Edit, etc.) but within their worktree
- Communication via `SendMessage` through a shared teammate mailbox (`utils/teammateMailbox.ts`)
- The coordinator injects team context: team name, agent name, task list path, team config path
- Workers are told to message "team-lead" by name, never by UUID

### Daemon Mode (Experimental)

Run sessions in the background with `--bg`. Uses tmux under the hood:
- Sessions persist as tmux panes
- Managed via `claude ps` (list), `claude logs` (view output), `claude attach` (resume), `claude kill` (stop)
- The `BG_SESSIONS` feature flag gates this functionality
- Background sessions generate periodic task summaries for `claude ps` display

### UDS Inbox (Experimental)

Unix Domain Socket-based inter-session communication:
- One Claude Code instance can message another through UDS
- Used by the Coordinator to dispatch work to parallel agents
- `ListPeers` tool discovers connected sessions
- `SendMessage` routes through UDS when sessions are co-located
- Works automatically when multiple sessions are running

### Team System

`TeamCreateTool` + `TeamDeleteTool` + `SendMessageTool` — create multi-agent teams:
- Teams have a lead coordinator and specialized workers
- Each member gets a defined role and agent type
- Communication uses a shared mailbox with message buffering
- The `isAgentSwarmsEnabled()` flag gates team tools

### Task Management (V2)

Full CRUD via `TaskCreate/Get/Update/List` tools with:
- Status tracking (pending, running, completed, failed, killed)
- Agent assignment (tasks addressed to specific agentIds)
- Dependency tracking between tasks
- Background task output via terminal files (`TaskOutputTool`)
- The `isTodoV2Enabled()` flag distinguishes V2 tasks from the flat TodoWrite system

### Message Routing

The message queue (`utils/messageQueueManager.ts`) routes mid-turn messages:
- Main thread drains only messages with `agentId === undefined`
- Sub-agents drain only task-notifications with their own agentId
- Slash commands are excluded from mid-turn drain (processed post-turn)
- The Sleep tool triggers drain of lower-priority notifications

---

## Code Template: TypeScript

See [templates/typescript/sub-agent.ts](../templates/typescript/sub-agent.ts) for a working implementation.

## Code Template: Python

See [templates/python/sub_agent.py](../templates/python/sub_agent.py) for a working implementation.

---

## Key Decisions & Trade-offs

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|----------------|
| Sub-agent context | Inherit parent history | Start fresh | Start fresh — cleaner context, better focus |
| Agent isolation | Process-level | Thread-level | Process — true isolation, but higher overhead |
| Coordination | Centralized coordinator | Peer-to-peer teams | Coordinator for most cases, teams for tightly coupled work |
| Parallel merge | Auto-merge | Human review | Auto-merge with conflict detection, human review for conflicts |
| Agent definitions | Hardcoded | File-based (YAML/MD) | File-based — extensible, user-configurable |
| Cost tracking | Per-agent | Roll up to parent | Both — per-agent for debugging, rolled up for billing |

---

## Tags

#multi-agent #orchestration #sub-agents #delegation #coordination #coordinator #swarm #fan-out #fan-in #pipeline #team #background-agents #parallel-execution #worktree #task-management #agent-definitions #agent-tool #cache-sharing #file-based-communication #fork-teammate-worktree
