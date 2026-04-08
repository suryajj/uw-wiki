---
tags: [human-in-loop, approval, feedback, interactive]
complexity: intermediate
prerequisites: [00_foundations, 05_permissions_safety]
---

# Human-in-the-Loop Patterns

> How to design approval flows, feedback loops, and interactive patterns that keep humans informed and in control without creating friction.

---

## Pattern (Universal)

The best agent systems aren't fully autonomous or fully manual — they're collaborative. Human-in-the-loop (HITL) patterns let agents operate autonomously for safe operations while escalating to humans for decisions that require judgment, carry risk, or need confirmation.

---

## Approval Flow Architecture

An approval flow intercepts a tool call before execution and presents it to the user for review.

### Flow

```
Agent decides to use Tool X with Input Y
    │
    ├── Check permission rules
    │   ├── Auto-allow → Execute immediately
    │   ├── Auto-deny → Block, return error to agent
    │   └── Needs approval → Show approval dialog
    │
    └── Approval Dialog
        ├── User approves → Execute tool
        ├── User approves + "always allow" → Execute + add allow rule
        ├── User denies → Return denial to agent
        └── User denies + "always deny" → Block + add deny rule
```

### Design Principles

1. **Show what, not just what tool** — display the actual input (file path, command, URL), not just "BashTool wants to run"
2. **Batch when possible** — if multiple similar operations are pending, let users approve them as a group
3. **Remember decisions** — ask-once means ask once per session, not once per identical input
4. **Provide context** — show why the agent wants to do this (the reasoning leading up to the tool call)

---

## Ask-Always vs Ask-Once

| Pattern | When to Use | Example |
|---------|-------------|---------|
| **Ask-Always** | High-risk, variable operations | Shell commands, file deletion |
| **Ask-Once** | Repeated similar operations | Writes to a specific directory |
| **Never Ask** | Read-only, safe operations | File read, search, listing |

### Ask-Once Implementation

Maintain a session-scoped set of approved patterns. When a tool call matches an approved pattern, auto-approve. Patterns can be:
- Exact match: "allow `npm test` in bash"
- Glob match: "allow writes to `src/**`"
- Tool-level: "allow all FileRead calls"

---

## Permission Dialogs

Design permission dialogs to be:

1. **Scannable** — user should understand the request in under 2 seconds
2. **Actionable** — clear yes/no/always/never options
3. **Informative** — show tool name, key input parameters, and risk level
4. **Non-blocking** — for batch operations, queue approvals rather than blocking each one

### Dialog Content Template

```
[Tool Name] wants to [action description]
  [Key input details]
  
  [Y] Allow  [A] Always allow  [N] Deny  [D] Always deny
```

---

## Initial Trust Establishment

On first run, establish a trust relationship with the user:

1. Explain what the agent can do
2. Show the permission model (what requires approval)
3. Let the user configure their comfort level
4. Persist the trust decision

This prevents the "wall of permission dialogs" experience on first use.

---

## Feedback Integration

### Explicit Feedback
User directly corrects or guides the agent:
- "No, use the v2 API endpoint instead"
- "That's the wrong customer — I meant account #4567"
- Thumbs up/down on responses

### Implicit Feedback
Infer from user behavior:
- User modifies agent's output → the output was close but not right
- User re-asks the same question differently → the answer was wrong
- User approves quickly → the approach is correct

### Feedback Loops
Use feedback to improve future behavior within a session:
- Track corrections and avoid repeating mistakes
- Adjust tool selection based on what worked
- Update session memory with user preferences

---

## Interactive Patterns

### Structured Questions
When the agent needs user input, use structured questions with predefined options rather than open-ended prompts:

```
Which database do you want to use?
  [1] PostgreSQL
  [2] SQLite
  [3] MySQL
```

### Progressive Disclosure
Start with autonomous operation. Escalate to human involvement only when:
- Confidence is low
- The operation is destructive
- Multiple valid approaches exist
- A previous attempt failed

### Mode Switching
Let users switch between autonomy levels:
- **Auto mode** — agent operates freely, asks only for high-risk operations
- **Supervised mode** — agent shows plan before executing, asks for each step
- **Manual mode** — agent suggests but doesn't execute

---

## Case Study: Claude Code

Claude Code's HITL implementation includes:

**Permission Dialog System**: Every tool call passes through `checkPermissions()`. The UI renders a rich permission dialog showing the tool name, input parameters, and a human-readable description. Users can approve, deny, or set permanent rules.

**Ask-Once Patterns**: Permission decisions are remembered per-session. If you approve "npm test", subsequent "npm test" calls auto-approve without asking.

**Trust Dialog**: On first run, shows a trust dialog explaining capabilities and risks. The user must accept before the agent can operate.

**Plan Mode**: A read-only mode where the agent can explore and plan but not make changes. Users switch to execute mode when ready to apply changes.

**Structured Questions**: The `AskUserQuestionTool` presents structured multiple-choice questions when the agent needs user input for decision-making.

---

## Key Decisions & Trade-offs

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|----------------|
| Default autonomy | High (auto-approve most) | Low (ask for most) | Start low, let users increase |
| Approval persistence | Session only | Permanent | Session default, permanent opt-in |
| Batch approvals | Individual | Grouped | Group similar operations |
| Feedback storage | Session memory | Persistent | Both — session for immediate, persistent for patterns |

---

## Tags

#human-in-loop #approval #feedback #interactive #permission-dialogs #ask-once #ask-always #trust-dialog #mode-switching #structured-questions #progressive-disclosure
