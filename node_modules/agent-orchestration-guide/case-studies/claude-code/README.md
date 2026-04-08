# Case Study: Claude Code

> An analysis of Claude Code's agent architecture, mapped to the universal patterns in this guide. Based on community analysis of the source code (March 2026).

---

## Overview

Claude Code is a terminal-based AI coding assistant built as a React application (Ink — a React reconciler for terminals) with 53+ tools, 95+ commands, multi-agent orchestration, and a 200K token context window with automatic compaction.

| Metric | Value |
|--------|-------|
| TypeScript/TSX files | ~1,900+ |
| Lines of code | ~519K+ |
| Tools | 53+ (including experimental) |
| Slash commands | 95+ |
| React hooks | 104 |
| Components | 389 files |
| Services | 130 files |
| Utilities | ~564 files |
| Context window | 200K tokens |

---

## The 11-Step Agent Loop

The community mapped the exact path from keypress to rendered response:

```
1.  Input         → TextInput.tsx captures keypress (Ink React component)
2.  Message       → createUserMessage() wraps text into Anthropic message format
3.  History       → Message pushed onto in-memory conversation array
4.  System Prompt → context.ts assembles CLAUDE.md + tool defs + memory + context
5.  API Call      → query.ts streams to Claude API via Anthropic SDK (SSE)
6.  Token Parse   → QueryEngine.ts parses tokens as they arrive, renders live
7.  Tool Check    → If tool_use blocks found: findToolByName() → canUseTool() → execute
8.  Tool Loop     → StreamingToolExecutor collects results, appends to history, loops back to step 5
9.  Render        → Ink renders markdown response in terminal with Yoga flexbox
10. Post Hooks    → Auto-compact if too long, extract memories, run dream mode
11. Await         → Back to REPL, waiting for next message
```

**Key source files:**
- `src/components/TextInput.tsx` — User input with voice waveform cursor
- `src/utils/messages.ts` — Message creation, normalization, tool result pairing (2000+ lines)
- `src/history.ts` — JSONL-based prompt history with paste store
- `src/context.ts` — System prompt assembly (CLAUDE.md + git status + memory)
- `src/query.ts` — The core async generator query loop
- `src/QueryEngine.ts` — Stateful wrapper for SDK/headless mode
- `src/tools.ts` — Tool registry and assembly
- `src/services/tools/StreamingToolExecutor.ts` — Concurrent tool execution

---

## Complete Tool Catalog (53+)

### File Operations (6)

| Tool | Description |
|------|-------------|
| FileRead | Read file contents with optional line range |
| FileEdit | Find-and-replace editing with uniqueness check |
| FileWrite | Create new files or overwrite existing |
| Glob | Find files by glob pattern (ripgrep-based) |
| Grep | Search file contents with regex (ripgrep) |
| NotebookEdit | Edit Jupyter notebook cells |

### Execution (3)

| Tool | Description |
|------|-------------|
| Bash | Shell command execution with timeout and background support |
| PowerShell | Windows PowerShell execution (conditional) |
| REPL | Interactive code execution in VM context |

### Search & Fetch (4)

| Tool | Description |
|------|-------------|
| WebBrowser | Full browser automation (experimental, locked) |
| WebFetch | Fetch URL, convert HTML to markdown |
| WebSearch | Web search with summarized results |
| ToolSearch | Meta-tool that searches the tool catalog by description |

### Agents & Tasks (11)

| Tool | Description |
|------|-------------|
| Agent | Spawn sub-agents with isolated context |
| SendMessage | Send messages to teammates via mailbox/UDS |
| TaskCreate | Create tasks with assignees and dependencies |
| TaskGet | Get task details by ID |
| TaskList | List all tasks with status |
| TaskUpdate | Update task status and output |
| TaskStop | Cancel a running background agent |
| TaskOutput | Read output from background agent terminal files |
| TeamCreate | Create multi-agent teams with roles |
| TeamDelete | Delete a team |
| ListPeers | List connected sessions via UDS (experimental) |

### Planning (5)

| Tool | Description |
|------|-------------|
| EnterPlanMode | Switch to read-only planning mode |
| ExitPlanMode | Exit plan mode with structured plan output |
| EnterWorktree | Create/enter a git worktree for isolated work |
| ExitWorktree | Return from worktree to main directory |
| VerifyPlanExecution | Verify plan items were completed (experimental) |

### MCP (4)

| Tool | Description |
|------|-------------|
| MCPTool | Call dynamically registered MCP server tools |
| ListMcpResources | List resources from MCP servers |
| ReadMcpResource | Fetch a specific MCP resource |
| McpAuth | Handle MCP server OAuth authentication |

### System (11)

| Tool | Description |
|------|-------------|
| AskUserQuestion | Present structured multiple-choice questions |
| TodoWrite | Manage a flat todo list with status tracking |
| Skill | Invoke user-defined skill macros |
| Config | Read/write configuration (ant-only) |
| RemoteTrigger | Trigger remote agent actions (experimental) |
| CronCreate | Schedule recurring tasks (experimental) |
| CronDelete | Remove scheduled tasks (experimental) |
| CronList | List scheduled tasks (experimental) |
| Snip | Trim specific conversation segments (experimental) |
| Workflow | Run bundled workflow scripts (experimental) |
| TerminalCapture | Capture terminal state (experimental) |

### Experimental (8)

| Tool | Description |
|------|-------------|
| Sleep | Pause execution for specified duration |
| SendUserMessage (Brief) | Send user-facing messages during long operations |
| StructuredOutput | Enforce JSON schema on output (locked) |
| LSP | Language Server Protocol integration (locked) |
| SendUserFile | Send files to user (Kairos, locked) |
| PushNotification | Send push notifications (Kairos, locked) |
| Monitor | Monitor local shell tasks (locked) |
| SubscribePR | Subscribe to GitHub PR webhooks (locked) |

---

## Hidden / Unreleased Features

Discovered in the source but not yet shipped — feature-flagged or env-gated:

### Kairos (Persistent Mode)
Persistent agent mode with memory consolidation between sessions and autonomous background actions. Includes scheduled tasks, channel-based message ingestion, push notifications, and PR webhook subscriptions. The Sleep tool enables idle waiting for external events.

### UltraPlan
Long planning sessions on Opus-class models with up to 30-minute execution windows. Uses the `/ultraplan` slash command.

### Coordinator Mode
A lead agent breaks tasks apart, spawns parallel workers in isolated git worktrees, and collects results. Workers communicate via `SendMessage` through a shared mailbox. The coordinator has a restricted tool set focused on delegation.

### Daemon Mode
Run sessions in the background with `--bg`. Uses tmux under the hood. Managed via `claude ps`, `claude logs`, `claude attach`, `claude kill`.

### UDS Inbox
Sessions communicate over Unix Domain Sockets. Used by the Coordinator to dispatch work to parallel agents. The `ListPeers` tool discovers connected sessions. `SendMessage` routes through UDS when sessions are co-located.

### Auto-Dream
Between sessions, the AI reviews what happened and organizes what it learned. The `autoDream` service consolidates memories during idle, merging related memories and pruning stale ones. Uses a consolidation lock to prevent concurrent dreams.

### Bridge (Remote Control)
Control Claude Code from a phone or browser. Full remote session with permission approvals via WebSocket/SSE. Two variants: V1 (environment-based polling) and V2 (direct session creation, env-less).

### Buddy (Companion)
A virtual pet that lives in the terminal. Species, rarity, and stats are deterministically derived from user ID via seeded PRNG (mulberry32). Name and personality are AI-generated. Planned for April 1-7, 2026 launch window.

---

## Pattern Mapping (Detailed)

### Agent Loop (Guide 01)

| Component | Implementation | Source |
|-----------|----------------|--------|
| Core loop | Async generator with while(true), state carried in `State` object | `query.ts` |
| Query engine | Stateful class wrapping query loop for SDK/headless | `QueryEngine.ts` |
| Entry points | cli.tsx → main.tsx (fast-path dispatch) → replLauncher.tsx | `entrypoints/cli.tsx` |
| Streaming | Block-by-block SSE parsing: message_start → content_block_delta → message_stop | `query.ts` |
| Message normalization | 2000+ line pipeline: merge, reorder, smoosh, strip, sanitize | `utils/messages.ts` |
| Stop conditions | 7 levels: user cancel > cost budget > token budget > max turns > no tools > stop hooks > natural | `query.ts`, `query/stopHooks.ts` |
| Cost tracking | Per-model USD from token counts, budget enforcement | `cost-tracker.ts` |
| Error recovery | Max output tokens retry (up to 3x), reactive compact on 413, model fallback | `query.ts` |
| Streaming tool execution | `StreamingToolExecutor` runs concurrent-safe tools in parallel as they stream in | `services/tools/StreamingToolExecutor.ts` |
| Tool result pairing | `ensureToolResultPairing()` — repairs missing/orphaned tool results with synthetic blocks | `utils/messages.ts` |

### Tool System (Guide 02)

| Component | Implementation | Source |
|-----------|----------------|--------|
| Tool interface | Generic `Tool<Input, Output, Progress>` with ~20 fields | `Tool.ts` |
| Factory | `buildTool()` fills defaults for simple tool definitions | `Tool.ts` |
| Registry | `getAllBaseTools()` → `getTools()` → `assembleToolPool()` | `tools.ts` |
| Schema validation | Zod schemas for every tool input | Per-tool files |
| Streaming execution | `StreamingToolExecutor` — concurrent-safe tools run in parallel, results buffered in order | `services/tools/StreamingToolExecutor.ts` |
| Concurrency control | `isConcurrencySafe` flag per tool; concurrent-safe tools parallelize, others serialize | `StreamingToolExecutor.ts` |
| Sibling abort | If a Bash tool errors, `siblingAbortController` cancels parallel siblings immediately | `StreamingToolExecutor.ts` |
| Tool search/deferred | `ToolSearchTool` + `shouldDefer` flag for lazy-loaded tools beyond threshold | `tools.ts`, `utils/toolSearch.ts` |
| Permission check | Per-tool `checkPermissions()` + auto-mode classifier for automatic approval | Per-tool + `yoloClassifier.ts` |
| Result size limits | `maxResultSizeChars` per tool + `applyToolResultBudget()` for aggregate capping | `utils/toolResultStorage.ts` |
| REPL mode | When enabled, primitive tools (Bash, Read, Edit, etc.) are hidden — only accessible via REPL VM | `tools.ts` |
| Hook system | 25+ lifecycle events, 5 hook types (command, prompt, agent, HTTP, function), PreToolUse/PostToolUse | Hook pipeline |

### Multi-Agent (Guide 03)

| Component | Implementation | Source |
|-----------|----------------|--------|
| Sub-agents | `AgentTool` → `spawnMultiAgent()` — isolated instances with own context | `tools/AgentTool/` |
| Agent definitions | Markdown files with YAML frontmatter in `.claude/agents/` | `components/agents/` |
| Built-in agents | `EXPLORE_AGENT` (codebase research) and `PLAN_AGENT` (implementation design) | `tools/AgentTool/built-in/` |
| Coordinator mode | Lead agent delegates to workers in isolated git worktrees | `coordinator/coordinatorMode.ts` |
| Teams | `TeamCreateTool` + `SendMessageTool` — shared mailbox communication | `tools/TeamCreateTool/` |
| UDS Inbox | Inter-session communication via Unix Domain Sockets | `remote/`, `tools/SendMessageTool/` |
| Daemon mode | Background sessions via `--bg` + tmux | `entrypoints/cli.tsx` |
| Task management | Full CRUD: TaskCreate/Get/Update/List with status, assignees, dependencies | `tools/Task*Tool/` |
| Background agents | Output streams to terminal files, monitored via `TaskOutputTool` | `tools/TaskOutputTool/` |
| Worktrees | `EnterWorktreeTool` / `ExitWorktreeTool` — git worktree isolation | `tools/Enter/ExitWorktreeTool/` |

### Context & Memory (Guide 04)

| Component | Implementation | Source |
|-----------|----------------|--------|
| System prompt assembly | CLAUDE.md + tool definitions + git status + memory + date, cached per-session | `context.ts` |
| Token budget | Tracks all components, triggers compaction at ~80% capacity | `query/tokenBudget.ts` |
| Micro-compaction | Truncates oversized tool results in-place | `services/compact/microCompact.ts` |
| Auto-compaction | Full conversation summarization when budget exceeded | `services/compact/autoCompact.ts` |
| Reactive compaction | Emergency compaction on API 413 (prompt-too-long) — single-shot fallback | `services/compact/reactiveCompact.ts` |
| Context collapse | Progressive collapsing of older context segments with summary replacement | `services/contextCollapse/` |
| Snip compaction | Trim specific conversation segments by message ID | `services/compact/snipCompact.ts` |
| Session memory | Key facts persisted across compaction | `services/SessionMemory/` |
| Long-term memory (`memdir`) | Markdown files in `~/.claude/memory/` with YAML frontmatter | `memdir/` |
| Auto-Dream | Background memory consolidation during idle periods | `services/autoDream/` |
| Memory relevance | Prefetch + score memories against current task, inject above threshold | `utils/attachments.ts` |
| Tool result budget | Aggregate capping of tool results across messages, with content replacement | `utils/toolResultStorage.ts` |

### Permissions & Safety (Guide 05)

| Component | Implementation | Source |
|-----------|----------------|--------|
| Permission tiers | `isReadOnly()`, `isDestructive()` per tool | `Tool.ts` |
| Permission context | `ToolPermissionContext` — mode, allow/deny/ask rules, working dirs | `Tool.ts` |
| Permission modes | default, plan, auto, bypassPermissions, acceptEdits | `types/permissions.ts` |
| Auto-mode classifier | LLM-based classifier for automatic approval/denial in auto mode | `yoloClassifier.ts` |
| Classifier unavailable | Graceful fallback when classifier model is overloaded | `utils/messages.ts` |
| Rule configuration | Layered settings: managed > local project > project > global | Settings files |
| Read-before-write | `readFileState` map in `ToolUseContext` | `Tool.ts` |
| Permission race | `createResolveOnce` races user dialog, rules, classifier, bridge in parallel | Permission pipeline |
| Denial workaround guidance | Structured message guiding model to try alternative approaches | `utils/messages.ts` |
| Don't-ask mode | Denies tools automatically when running non-interactively | `utils/messages.ts` |

### Planning & Reasoning (Guide 07)

| Component | Implementation | Source |
|-----------|----------------|--------|
| Plan mode V2 | 5-phase workflow: Understand → Design → Review → Final Plan → Exit | `utils/messages.ts` |
| Interview mode | Iterative explore-question-update loop instead of fixed phases | `utils/messages.ts` |
| Explore agents | `EXPLORE_AGENT` — specialized for codebase research in plan mode | `tools/AgentTool/built-in/exploreAgent.ts` |
| Plan agents | `PLAN_AGENT` — specialized for implementation design | `tools/AgentTool/built-in/planAgent.ts` |
| Plan file | Written to disk, supports incremental edits, only editable file in plan mode | Plan mode attachment |
| UltraPlan | Long Opus-class planning sessions with extended execution windows | `/ultraplan` command |
| Plan brevity experiment | A/B testing plan verbosity: control vs trim vs cut vs cap (40-line hard limit) | `utils/planModeV2.ts` |
| Auto mode | Continuous autonomous execution with classifier-gated permissions | `utils/messages.ts` |
| Todo system | `TodoWriteTool` — flat list with pending/in_progress/completed/cancelled | `tools/TodoWriteTool/` |
| Task system (V2) | Hierarchical tasks with assignees, dependencies, CRUD operations | `tools/Task*Tool/` |
| Verify plan execution | Checks that all plan items were implemented correctly | `tools/VerifyPlanExecutionTool/` |

### Protocols (Guide 09)

| Component | Implementation | Source |
|-----------|----------------|--------|
| MCP client | Full MCP support with dynamic tool discovery, resource fetching, elicitation, OAuth | `tools/MCPTool/`, `services/mcp/` |
| MCP server mode | Agent exposed as MCP server via `entrypoints/mcp.ts` | `entrypoints/mcp.ts` |
| Bridge V1 | Environment-based polling with `GET .../work/poll` | `bridge/bridgeMain.ts` |
| Bridge V2 | Direct session creation, env-less, `tengu_bridge_repl_v2` flag | `bridge/remoteBridgeCore.ts` |
| IDE direct-connect | VS Code/JetBrains extensions via local server (`cc://` URLs) | `server/`, `bridge/` |
| UDS Inbox | Inter-process Unix Domain Socket messaging | `remote/` |
| Remote sessions | Cloud-hosted with crash recovery via bridge pointers | `bridge/bridgePointer.ts` |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      USER INTERFACE                          │
│  TextInput → BaseTextInput → Ink React → Yoga Layout         │
│  Voice waveform cursor · Clipboard image hints                │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                     MESSAGE PIPELINE                         │
│  createUserMessage → history.append → normalizeMessagesForAPI│
│  Tool result pairing · Smoosh · Strip · Sanitize              │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                     CONTEXT ASSEMBLY                         │
│  CLAUDE.md + tool defs + git status + memory + date          │
│  Prompt cache: stable prefix → dynamic suffix                 │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                     QUERY ENGINE                             │
│  query.ts: async generator while(true) loop                  │
│  State object: messages, toolUseContext, tracking, turnCount  │
│  Token budget → Snip → Microcompact → Context collapse        │
│  → Autocompact → API call → Stream → Tool execution → Loop   │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                     STREAMING TOOL EXECUTOR                  │
│  Concurrent-safe tools → parallel execution                  │
│  Non-concurrent tools → sequential with ordering             │
│  Sibling abort on Bash errors · Progress message streaming   │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                     TOOL SYSTEM (53+)                        │
│  Files (6) · Execution (3) · Search (4) · Agents (11)       │
│  Planning (5) · MCP (4) · System (11) · Experimental (8)    │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                     COMPACTION PIPELINE                      │
│  Snip → Microcompact → Context Collapse → Autocompact        │
│  → Reactive (on 413) · Memory extraction · Auto-Dream        │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                     TRANSPORT LAYER                          │
│  CLI (local) · Bridge V1/V2 (remote) · IDE Direct-Connect   │
│  UDS Inbox (inter-session) · Daemon (tmux background)        │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Implementation Details from Source

### Message Normalization Pipeline

The `normalizeMessagesForAPI()` function in `utils/messages.ts` is one of the most complex pieces. It processes messages through multiple passes:

1. **Reorder attachments** — bubble up until hitting tool result or assistant
2. **Filter virtual messages** — strip display-only messages
3. **Strip unavailable tool references** — remove references to disconnected MCP servers
4. **Merge consecutive user messages** — Bedrock compatibility
5. **Smoosh system-reminder siblings** — fold `<system-reminder>` text into adjacent tool_results
6. **Relocate tool-reference siblings** — prevent anomalous two-consecutive-human-turns pattern
7. **Filter orphaned thinking-only messages** — prevent "thinking blocks cannot be modified" errors
8. **Filter trailing thinking** — API doesn't allow assistant messages to end with thinking blocks
9. **Filter whitespace-only assistants** — API rejects non-whitespace requirement
10. **Ensure non-empty assistant content** — placeholder for empty blocks
11. **Ensure tool result pairing** — synthetic error blocks for missing results
12. **Validate images** — check size limits before sending

### Streaming Tool Executor

The `StreamingToolExecutor` manages concurrent tool execution during streaming:

- Tools are added as their `tool_use` blocks arrive in the stream
- **Concurrent-safe tools** (FileRead, Grep, etc.) run in parallel
- **Non-concurrent tools** (FileEdit, Bash, etc.) run sequentially
- If a **Bash tool errors**, the `siblingAbortController` cancels all parallel siblings immediately
- Results are **buffered and yielded in order** to maintain message sequence
- Progress messages are yielded immediately (not buffered)
- On user interrupt, queued tools receive synthetic REJECT_MESSAGE results

### Context Compaction Pipeline

The query loop runs five compaction stages before each API call:

1. **Snip compaction** — trim specific message segments by ID (experimental)
2. **Microcompact** — truncate oversized tool results in-place, with cache-editing variant
3. **Context collapse** — progressive summarization of older context segments
4. **Autocompact** — full conversation summarization when token budget exceeded
5. **Reactive compact** — emergency single-shot on API 413 (prompt-too-long)

Plus two post-turn stages:
6. **Memory extraction** — save important facts to session memory
7. **Auto-Dream** — background consolidation of long-term memories

### Plan Mode V2 Workflow

The actual plan mode implementation supports two workflows:

**Standard (5-Phase):**
1. Initial Understanding — launch up to N explore agents in parallel
2. Design — launch plan agents to design implementation
3. Review — read critical files, verify alignment with user intent
4. Final Plan — write plan to file (the ONLY file editable in plan mode)
5. Exit — call ExitPlanModeV2Tool

**Interview (Iterative):**
1. Explore codebase with read-only tools
2. Update plan file incrementally with each discovery
3. Ask user questions via AskUserQuestion when hitting ambiguity
4. Loop until plan is complete
5. Exit when ready

Plan verbosity is actively A/B tested with four variants: control, trim, cut, and cap (40-line hard limit).

### Auto-Mode Classifier

When auto mode is active, a separate LLM classifier evaluates each tool call:
- **Allow** — tool executes without user approval
- **Deny** — returns structured rejection with workaround guidance
- **Unavailable** — classifier overloaded, tells agent to retry later

The denial message includes guidance: the model may try alternative tools but should not maliciously bypass the intent of the denial.

### Permission Race Pattern

When a tool needs permission, Claude Code races multiple resolvers in parallel via a `createResolveOnce` pattern:
- **User dialog** — the terminal approval prompt
- **Hook classifier** — automated rules from settings/CLAUDE.md
- **Bash security classifier** — LLM-based safety evaluation for shell commands
- **Bridge/web UI** — external approval from IDE extension or web interface

First responder wins. If automated rules match, the user never sees a dialog. If the classifier can answer, it's instant. Edge cases bubble to the user.

### Hook System (25+ Lifecycle Events)

The architecture includes 25+ hook points across 5 types:
- **Command hooks** — shell commands triggered by lifecycle events
- **Prompt hooks** — LLM-based classifiers or evaluators
- **Agent hooks** — triggered on sub-agent spawn/complete
- **HTTP hooks** — webhook calls to external services
- **Function hooks** — in-process callbacks (SDK mode)

Key hook points:
- `PreToolUse` — can block or modify tool calls before execution
- `PostToolUse` — can transform results or trigger side effects
- `UserPromptSubmit` — can inject context into every user message
- Hooks can come from settings, plugins, agent frontmatter, or SDK callbacks

### Cache-Aware Architecture

The system prompt is split into two sections with an explicit cache boundary:
- **Static section** (cacheable, ~1 hour TTL): role instructions, tool guidelines, style rules
- **Dynamic section** (rebuilt per-turn): CLAUDE.md files, environment info, git status, memory, date

Tool definitions are sorted alphabetically for prompt-cache stability (consistent ordering = more cache hits). When sub-agents are forked, they receive byte-identical copies of the parent context prefix, sharing the same API cache. This means 5 parallel agents cost barely more than 1 sequential agent.

### Fast-Path Boot

Before loading the full React app, fast-path routing intercepts simple commands:
- `--version`, `--daemon`, and other simple subcommands are handled before importing the full application (zero unnecessary initialization)
- Parallel prefetching: while the CLI parses the command, settings, auth, TLS connections, and API pre-connections all start concurrently
- Memoized initialization: expensive setup operations run once and are cached

---

## Key Takeaways

1. **The query loop is an async generator** — `query()` yields stream events, messages, and control signals. The `while(true)` loop carries state in a `State` object with explicit continue transitions.

2. **Message normalization is the hardest part** — 12+ transformation passes handle edge cases from streaming interrupts, session resume, model quirks, and MCP server disconnections. Many passes are A/B tested independently.

3. **Tool execution streams in parallel** — The `StreamingToolExecutor` starts concurrent-safe tools as their blocks arrive, before the full response completes. This dramatically reduces latency for multi-tool turns.

4. **Five layers of compaction** — Snip, micro, collapse, auto, and reactive compaction work together to keep 200K context usable across long sessions. Each layer handles a different failure mode.

5. **Plan mode is deeply integrated** — Not just "read-only tools" but a full workflow with specialized agents (explore/plan), plan file management, interview mode, and verbosity experiments.

6. **Permissions have an AI classifier** — Auto mode doesn't just skip permissions; it uses a separate LLM call to classify each tool call as safe or unsafe, with graceful degradation when the classifier is unavailable.

7. **Everything is feature-flagged** — Major features use `feature()` compile-time gates (dead code elimination) and GrowthBook runtime gates. This enables incremental rollout and A/B testing of every architectural decision.

8. **Hooks turn the product into a platform** — 25+ lifecycle events with 5 hook types let users run custom logic before/after tool calls, messages, and sessions without modifying the core codebase.

9. **Permission race means fastest-safe-path wins** — Racing multiple permission resolvers (rules, classifiers, user dialog, external UI) via `createResolveOnce` ensures automation handles the common cases while edge cases escalate to humans.

10. **Cache-aware architecture saves money at scale** — Splitting system prompts into static/dynamic, sharing caches across sub-agents, and keeping tool definitions sorted for stability are cost optimizations baked into the architecture.

11. **Rendering is completely decoupled from logic** — The Ink React UI and the async generator agent loop are separate systems. This is why Claude Code can power terminal, IDE, web bridge, and SDK interfaces from the same core.

---

*Based on community analysis of the Claude Code source (March 31, 2026). Some details may be outdated as the codebase evolves.*
