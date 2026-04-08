---
tags: [permissions, safety, sandboxing, trust]
complexity: intermediate
prerequisites: [00_foundations, 02_tool_system]
---

# Permissions & Safety

> How to build permission models, sandboxing, and trust boundaries that let agents act powerfully while keeping humans in control.

---

## Pattern (Universal)

Agents that can execute tools need a permission system. Without one, every tool call is either fully trusted (dangerous) or requires manual approval (unusable). The solution is a tiered permission model with configurable rules that balance autonomy with safety.

---

## The Permission Tier Model

Four tiers of permission, from most to least autonomous:

| Tier | Behavior | Use For |
|------|----------|---------|
| **Automatic** | Execute without asking | Read-only operations, safe queries |
| **Ask-Once** | Ask user once, remember for session | File writes to known directories |
| **Ask-Always** | Ask user every time | Shell commands, destructive operations |
| **Deny** | Block completely | Operations outside trust boundary |

### How Tiers Map to Tools

Each tool declares its default permission tier. The system can override this based on:
- Input patterns (e.g., `rm -rf` always asks)
- File paths (e.g., writes to `/etc/` denied)
- User-configured rules
- Current permission mode

---

## Permission Modes

Support multiple modes for different contexts:

| Mode | Behavior | Use Case |
|------|----------|----------|
| **Default** | Normal tier-based permissions | Interactive sessions |
| **Plan** | Read-only tools only, no writes | Planning/exploration phase |
| **Auto-accept** | Approve all edits automatically | Trusted automated workflows |
| **Bypass** | Skip all permission checks | Testing, CI/CD (use with caution) |

---

## Permission Rules

Rules are pattern-based matchers that override default tool permissions:

```
Rule = {
  tool: string | glob      # Which tool(s) this applies to
  path?: string | glob     # Optional path pattern
  action: allow | deny | ask
}
```

Rules are evaluated in priority order. First matching rule wins. If no rule matches, the tool's default permission applies.

### Rule Layering

Stack rules from multiple sources with clear precedence:

1. **Managed/Enterprise** (highest priority, read-only)
2. **Local project** (gitignored, per-developer)
3. **Project** (shared, checked into repo)
4. **Global user** (user-wide defaults)
5. **Tool defaults** (lowest priority)

---

## The Permission Race Pattern

When an agent needs permission for an action, there are often multiple sources that can provide an answer: the user (via a dialog), automated rules, an AI classifier, or an external approval system (e.g., a web UI or webhook). Rather than checking them sequentially, race them in parallel — first responder wins.

### How It Works

```
function resolvePermission(toolCall):
  // Race multiple resolvers in parallel
  result = raceFirst([
    userDialogResolver(toolCall),      // User clicks allow/deny
    ruleResolver(toolCall),            // Automated rules match
    classifierResolver(toolCall),       // AI safety classifier
    externalResolver(toolCall),         // Webhook/web UI approval
  ])
  
  // First resolver to respond wins
  return result  // { allow | deny | ask }
```

### The `resolveOnce` Pattern

Wrap the race in a one-shot resolution: once any resolver fires, cancel the others. This prevents double-execution and ensures the fastest safe path always wins.

```
function createResolveOnce(resolvers):
  resolved = false
  return race(resolvers.map(r => 
    r.then(result => {
      if (!resolved):
        resolved = true
        cancelOthers()
        return result
    })
  ))
```

### Why This Matters

- If automated rules can answer (e.g., "always allow reads"), the user is never bothered
- If an AI classifier can evaluate safety, the user only sees edge cases
- If the user is fast, they override automated decisions
- External approval systems (Slack bot, web dashboard) work seamlessly alongside local dialogs
- The system is always as fast as its fastest resolver

This is especially valuable in autonomous/auto-mode where the AI classifier handles most decisions and only escalates genuinely ambiguous cases to the user.

---

## Rule-Based Access Control

### Allow Rules
```
allow: Bash(npm test)        # Allow specific commands
allow: FileWrite(src/**)     # Allow writes to src/
allow: WebFetch(api.example.com/**)  # Allow specific domains
```

### Deny Rules
```
deny: Bash(rm -rf *)         # Block destructive commands
deny: FileWrite(/etc/**)     # Block system file writes
deny: FileRead(.env)         # Block secret file reads
```

---

## Sandboxing Strategies

### Process-Level Sandboxing
Run tool executions in isolated processes with restricted syscalls. Limit filesystem access, network access, and resource usage.

### Directory Scoping
Restrict file operations to the project directory and explicitly allowed additional directories. Any path traversal outside these boundaries is denied.

### Network Allowlisting
For tools that make network requests, maintain an allowlist of permitted domains. Block all other outbound traffic by default.

### Resource Limits
Set timeouts, memory limits, and output size caps on tool executions to prevent runaway processes.

---

## Trust Boundaries

Define clear boundaries between trusted and untrusted contexts:

- **Trusted**: Agent's own reasoning, system prompt, user input
- **Semi-trusted**: Tool results, file contents, web content (may contain injection attempts)
- **Untrusted**: External API responses, MCP server data, plugin output

Never let untrusted content influence permission decisions directly.

---

## Destructive Operation Handling

Flag operations that can't be undone:

- File deletion
- Git force push
- Database drops
- System configuration changes

For destructive operations:
1. Always require explicit user confirmation
2. Show a preview of what will change
3. Provide an undo path when possible
4. Log the operation for audit

---

## Read-Before-Write Enforcement

Require that an agent reads a file before editing it. This prevents blind overwrites and ensures the agent has current context.

Implementation: Maintain a `readFileState` map tracking which files have been read (and their modification times). When a write/edit is requested, check that the file was recently read. If the file changed since the read, require a re-read.

---

## Case Study: Claude Code

Claude Code implements a comprehensive, multi-layered permission system with an AI classifier for autonomous operation.

### Permission Modes

| Mode | Behavior |
|------|----------|
| `default` | Standard interactive: read-only auto-approves, writes ask for permission |
| `plan` | Read-only only: all writes blocked, only plan file editable |
| `auto` | Autonomous: AI classifier evaluates each tool call |
| `bypassPermissions` | Fully trusted (internal use) |
| `acceptEdits` | Auto-accept file edits |

### Permission Tiers

Every tool declares capability flags used for tiered permission decisions:
- `isReadOnly(input)` — read-only tools auto-approve
- `isDestructive(input)` — destructive tools always require confirmation
- `isConcurrencySafe(input)` — safe for parallel execution

### Auto-Mode Classifier (`yoloClassifier.ts`)

When auto mode is active, a separate LLM call (typically Haiku/fast model) classifies each tool call:

- **Allow** — tool executes without user prompt
- **Deny** — returns structured rejection with workaround guidance: "You may attempt to accomplish this action using other tools... But you should not attempt to work around this denial in malicious ways"
- **Unavailable** — classifier model overloaded, tells agent to "wait briefly and then try this action again"

The denial message explicitly tells the model it can try alternative approaches (e.g., `head` instead of `cat`) but should not maliciously bypass the intent. At session end, it recommends what permission rules to add for next time.

### Permission Race (createResolveOnce)

When a tool needs permission, Claude Code races multiple resolvers in parallel:
- **User dialog** — the approval prompt in the terminal
- **Hook classifier** — automated rules from settings
- **Bash security classifier** — LLM-based safety check for shell commands
- **Bridge/web UI** — external approval from IDE or web interface

First responder wins via the `createResolveOnce` pattern. This means automated rules resolve instantly without bothering the user, while edge cases still surface for human review.

### Don't-Ask Mode

When running non-interactively (no terminal), tools that would normally ask for permission are auto-denied with: "Permission has been denied because Claude Code is running in don't ask mode."

### Tool Filtering by Deny Rules

Before tools are even presented to the model, `filterToolsByDenyRules()` removes any tool with a blanket deny rule from the tool list. MCP server-prefix rules like `mcp__server` strip all tools from that server.

### Rule Configuration

Rules are stored in a layered settings hierarchy:
1. **Managed settings** (enterprise) — highest priority, user can't override
2. **Local project settings** (`.claude/settings.local.json`) — gitignored
3. **Project settings** (`.claude/settings.json`) — shared with team
4. **Global settings** (`~/.claude/settings.json`) — user defaults

### Permission Dialog Flow

When a tool needs approval, the dialog offers three options:
1. **Allow once** — one-time approval
2. **Allow always** — adds to session/project allow rules
3. **Deny** — returns rejection to model with correction hint for future memory

On denial, if auto-memory is enabled, a memory correction hint is appended: "The user's next message may contain a correction or preference. Pay close attention — if they explain what went wrong, consider saving that to memory."

---

## Code Template: TypeScript

See [templates/typescript/permission-system.ts](../templates/typescript/permission-system.ts) for a working implementation.

## Code Template: Python

See [templates/python/permission_system.py](../templates/python/permission_system.py) for a working implementation.

---

## Key Decisions & Trade-offs

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|----------------|
| Default stance | Allow by default | Deny by default | Deny by default — safer, add allow rules as needed |
| Rule format | Glob patterns | Regex | Globs — simpler, sufficient for most cases |
| Rule storage | Config file | Database | Config file — auditable, version-controllable |
| Sandboxing depth | Process isolation | Container | Process isolation for dev, containers for production |

---

## Tags

#permissions #safety #sandboxing #trust #access-control #allow-rules #deny-rules #permission-tiers #permission-modes #permission-race #resolveOnce #read-before-write #destructive-operations #trust-boundaries
