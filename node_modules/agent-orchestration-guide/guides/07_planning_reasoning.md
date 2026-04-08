---
tags: [planning, reasoning, task-decomposition, todos]
complexity: intermediate
prerequisites: [00_foundations, 01_agent_loop]
---

# Planning & Reasoning

> How to implement plan modes, task decomposition, todo systems, and structured reasoning that make agents more reliable on complex tasks.

---

## Pattern (Universal)

Complex tasks fail when agents jump straight to execution. Planning patterns force agents to think before acting — decomposing tasks, considering alternatives, and creating structured execution plans. This dramatically improves success rates on multi-step tasks.

---

## Plan Mode Architecture

Plan mode is a restricted execution mode where the agent can research and plan but not make changes. This separates "thinking" from "doing."

### How It Works

```
Normal Mode                          Plan Mode
├── All tools available              ├── Read-only tools only
├── Can read + write + execute       ├── Can only read + search + analyze
├── Changes applied immediately      ├── Produces a plan document
└── Full autonomy                    └── User reviews before execution
```

### Implementation

1. Maintain a mode flag in session state (`plan` vs `execute`)
2. In plan mode, filter the tool set to read-only tools
3. Add plan-specific tools: `CreatePlan`, `ExitPlanMode`
4. The plan output becomes input for execution mode

### When to Enter Plan Mode

- User explicitly asks to plan first
- Task is complex (touches many files/systems)
- Task is ambiguous (multiple valid approaches)
- Previous attempt failed (re-plan before retrying)

---

## Task Decomposition

Break complex tasks into discrete, actionable sub-tasks:

### Decomposition Strategy

1. **Understand the goal** — what does "done" look like?
2. **Identify dependencies** — which steps must come before others?
3. **Estimate scope** — how big is each step?
4. **Parallelize** — which steps can run concurrently?
5. **Order** — sequence the steps respecting dependencies

### Task Granularity

Tasks should be:
- **Atomic** — each task does one thing
- **Verifiable** — you can check if it's done
- **Independent** — minimal coupling between tasks (when possible)
- **Sized right** — one tool call to a few tool calls per task

---

## Todo and Task Tracking

### Simple Todo System (V1)

A flat list of todos with status tracking:

```
Todo {
  id: string
  content: string
  status: pending | in_progress | completed | cancelled
}
```

Agents create todos at the start of a complex task, mark them as they progress, and check for completeness before finishing.

### Hierarchical Task System (V2)

For more complex orchestration:

```
Task {
  id: string
  description: string
  status: pending | in_progress | completed | failed | cancelled
  subtasks: Task[]
  assignee?: AgentId      # For multi-agent delegation
  output?: string         # Result of completed task
  dependencies: TaskId[]  # Must complete before this task starts
}
```

### Task Lifecycle

```
pending → in_progress → completed
                      → failed → (retry or escalate)
                      → cancelled
```

---

## Mode Switching

Support transitions between different execution modes:

| From | To | Trigger |
|------|----|---------|
| Execute → Plan | Agent encounters complexity or ambiguity | Agent calls `EnterPlanMode` |
| Plan → Execute | Plan is ready and user approves | Agent calls `ExitPlanMode` |
| Execute → Review | Task is done, needs verification | Agent completes all todos |
| Any → Error | Unrecoverable failure | Error handler |

### Implementation

Mode switching is a tool the agent can call. The `EnterPlanMode` tool:
1. Saves current state
2. Restricts available tools to read-only
3. Adds plan-mode-specific tools
4. Signals the UI to show plan mode indicator

The `ExitPlanMode` tool:
1. Validates a plan was created
2. Restores full tool access
3. Optionally attaches the plan as context for execution

---

## Structured Reasoning

Help agents think through problems systematically:

### Chain-of-Thought Planning
Prompt the agent to explain its reasoning before each action. This surfaces mistakes early and creates an audit trail.

### Pre-Action Checklist
Before executing a multi-step plan, verify:
- [ ] All files to be modified have been read
- [ ] Dependencies between steps are respected
- [ ] Rollback strategy exists for destructive operations
- [ ] User has approved the overall approach

### Post-Action Verification
After each step, verify the outcome:
- Did the tool call succeed?
- Did the output match expectations?
- Should the plan be adjusted based on new information?

---

## Case Study: Claude Code

Community analysis of the source revealed a sophisticated planning system with multiple workflows, specialized agents, and active A/B testing.

### Plan Mode V2 — Standard Workflow (5 Phases)

When plan mode is active, the system injects detailed phase instructions as `<system-reminder>` attachments:

**Phase 1: Initial Understanding** — Launch up to N `EXPLORE_AGENT` sub-agents in parallel (single message, multiple tool calls) to efficiently explore the codebase. Guidance: "Use 1 agent when the task is isolated to known files... Use multiple agents when the scope is uncertain." Quality over quantity.

**Phase 2: Design** — Launch `PLAN_AGENT` sub-agents to design the implementation. Can launch multiple agents in parallel for complex tasks. Each agent receives comprehensive background from Phase 1 exploration including filenames and code path traces.

**Phase 3: Review** — Read critical files identified by agents. Ensure plans align with user's original request. Use `AskUserQuestion` to clarify remaining ambiguities.

**Phase 4: Final Plan** — Write the plan to a dedicated plan file (the only file editable in plan mode). Must include: context section (why this change), file paths to modify, existing functions to reuse, and a verification section.

**Phase 5: Exit** — Call `ExitPlanModeV2Tool`. The turn should only end with `AskUserQuestion` (for clarification) or `ExitPlanModeV2Tool` (for approval). Asking "Is this plan okay?" via text instead of the tool is explicitly prohibited.

### Plan Mode V2 — Interview Workflow (Iterative)

An alternative workflow gated by `isPlanModeInterviewPhaseEnabled()`:

Instead of fixed phases, the model pair-plans with the user:
1. **Explore** — use read-only tools to build context
2. **Update plan file** — immediately capture discoveries (don't wait until the end)
3. **Ask the user** — when hitting ambiguity, use `AskUserQuestion`, then loop back

Key principles:
- "Never ask what you could find out by reading the code"
- "Batch related questions together"
- "Scale depth to the task — a vague feature request needs many rounds; a focused bug fix may need one or none"
- Start by scanning key files, write a skeleton plan, ask first questions — don't explore exhaustively before engaging

### Plan Verbosity A/B Testing

The Final Plan section is actively A/B tested with four variants via GrowthBook:

| Variant | Key Change |
|---------|-----------|
| **Control** | Full plan with Context section, alternatives, verification procedures |
| **Trim** | One-line Context, single verification command |
| **Cut** | NO Context section ("The user just told you what they want"), one line per file |
| **Cap** | Same as cut + "Hard limit: 40 lines. If the plan is longer, delete prose — not file paths." |

### UltraPlan (Experimental)

Long planning sessions on Opus-class models with up to 30-minute execution windows. Accessed via the `/ultraplan` slash command. Uses the `tengu_ultraplan` feature flag.

### Auto Mode

Continuous autonomous execution where the agent minimizes interruptions:
- "Prefer making reasonable assumptions over asking questions for routine decisions"
- "Prefer action over planning — do not enter plan mode unless the user explicitly asks"
- An AI classifier (`yoloClassifier.ts`) evaluates each tool call for safety without user involvement
- Classifier denial messages include workaround guidance and suggest permission rules for the future

### Plan Re-entry

When returning to plan mode after previously exiting, the system injects a `plan_mode_reentry` attachment instructing the model to evaluate whether the existing plan is relevant or should be overwritten. The plan file must always be edited before calling `ExitPlanModeV2Tool`.

### Todo System

`TodoWriteTool` maintains a flat list with `pending | in_progress | completed | cancelled` states. A `todo_reminder` attachment is injected when the tool hasn't been used recently, gently nudging the model to track progress. The reminder is never shown to the user.

### Verify Plan Execution (Experimental)

After plan implementation completes, a `verify_plan_reminder` attachment triggers the model to call `VerifyPlanExecution` to check that all plan items were correctly implemented.

---

## Key Decisions & Trade-offs

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|----------------|
| Plan enforcement | Always plan first | Agent decides | Agent decides — mandatory planning adds overhead for simple tasks |
| Todo persistence | Session only | Across sessions | Session — todos are contextual to the current task |
| Task granularity | One task per tool call | Logical grouping | Logical grouping — too granular creates noise |
| Plan format | Free-form text | Structured template | Structured for agent consumption, free-form for human review |

---

## Tags

#planning #reasoning #task-decomposition #todos #plan-mode #mode-switching #task-management #structured-reasoning #chain-of-thought #verification
