---
tags: [patterns, anti-patterns, best-practices, pitfalls]
complexity: advanced
prerequisites: [00_foundations]
---

# Patterns & Anti-Patterns

> Proven patterns that make agents reliable and common mistakes that make them fail. Distilled from production agent systems.

---

## Pattern (Universal)

Building agent systems involves recurring design decisions. This guide catalogs patterns that consistently work well and anti-patterns that consistently cause problems. Use it as a checklist when designing or reviewing agent architectures.

---

## Proven Patterns

### 1. Read-Before-Write

Always read the current state before modifying it. For files: read the file before editing. For configs: read the current value before updating. This prevents blind overwrites and ensures the agent has accurate context.

**Implementation**: Track reads in a map (`path → { content, mtime }`). Before any write, check that the target was recently read and hasn't changed since.

### 2. Graceful Degradation

When a tool call fails, the agent should adapt — not crash. Return structured error messages that the agent can reason about and retry or work around.

**Pattern**: Tool results always include success/failure status. On failure, include the error message, possible causes, and suggested fixes.

### 3. Idempotent Operations

Design tools so that running them twice with the same input produces the same result. This makes retries safe and simplifies error recovery.

**Example**: FileEdit with exact string matching — if the old string was already replaced, the operation fails safely ("string not found") rather than making duplicate changes.

### 4. Progressive Disclosure of Capability

Don't expose all 40+ tools to the agent at once. Start with a core set and let the agent discover more via `ToolSearchTool` or context-based filtering.

**Implementation**: Tool presets (`minimal`, `standard`, `full`) that can be selected based on task complexity. A `ToolSearchTool` that searches the full catalog by description.

### 5. Prompt-Cache-Friendly Ordering

When building the API request, keep the stable parts (system prompt, tool definitions) at the beginning. Dynamic content (conversation history, tool results) goes at the end. This maximizes prompt cache hit rates and reduces cost.

### 6. Structured Tool Results

Tool results should be structured data, not free-form strings. Include metadata (success/failure, affected files, line numbers) that the agent can parse and reason about.

### 7. Conversation Checkpointing

Periodically checkpoint the conversation state so you can recover from failures without losing progress. This is especially important for long-running agent sessions.

### 8. Layered Validation

Validate at multiple levels:
1. **Schema validation** — input types and required fields (via Zod/JSON Schema)
2. **Semantic validation** — does the input make sense? (e.g., file path exists)
3. **Permission validation** — is this operation allowed?
4. **Runtime validation** — did the operation succeed?

---

## Anti-Patterns

### 1. Unbounded Context Growth

**Problem**: Appending every tool result to context without limits. Context fills up, costs increase, and model performance degrades.

**Fix**: Implement token budgets, result size limits, and automatic compaction. Truncate large tool results (e.g., cap at 10K characters).

### 2. Permission Fatigue

**Problem**: Asking the user for approval on every operation. Users start auto-approving without reading, defeating the purpose of permissions.

**Fix**: Use tiered permissions. Auto-approve read-only operations. Remember approval decisions (ask-once). Group similar approvals.

### 3. Blind Writes

**Problem**: Writing to files the agent hasn't read. Results in overwrites, lost content, and incorrect assumptions.

**Fix**: Enforce read-before-write. Track which files have been read and their modification times. Reject writes to unread files.

### 4. Infinite Tool Loops

**Problem**: Agent keeps calling tools in a loop without making progress. Common when error handling causes retries of the same failing operation.

**Fix**: Implement stop conditions: max turns per query, max consecutive tool calls, budget limits. Detect repeated tool calls with identical inputs.

### 5. Monolithic System Prompt

**Problem**: Stuffing everything into one massive system prompt. Hard to maintain, wastes tokens on irrelevant instructions.

**Fix**: Modular system prompt assembly. Include base instructions always, add context-specific sections based on the current task/mode.

### 6. Serialized Tool Execution

**Problem**: Running all tools sequentially when many could run in parallel. Wastes time, especially for read-only operations.

**Fix**: Check tool concurrency safety. Run read-only, concurrency-safe tools in parallel. Serialize only tools that modify state.

### 7. Stateless Sub-Agents

**Problem**: Sub-agents that lose all context when they complete. Important findings, decisions, and context vanish.

**Fix**: Sub-agents should return structured summaries. Parent agents should capture and preserve key findings from sub-agent work.

### 8. Hardcoded Tool Sets

**Problem**: Agent can only use tools that were compiled in. No extensibility, no dynamic capabilities.

**Fix**: Support dynamic tool registration (via MCP or plugin system). Let tools be discovered at runtime.

---

## Error Handling Patterns

### Retry with Backoff
For transient failures (network errors, rate limits), implement exponential backoff with jitter:
- Start: 1 second
- Max: 60 seconds
- Jitter: +/- 50%
- Max retries: 3-5

### Error Classification
Classify errors to determine the right response:
- **Transient** → retry (network timeout, rate limit)
- **Input error** → fix input and retry (invalid path, wrong format)
- **Permission error** → escalate to user (insufficient permissions)
- **Fatal** → abort and report (unrecoverable state)

### Graceful Error Messages
When returning errors to the agent, include:
1. What happened (error type and message)
2. Why it might have happened (common causes)
3. What to try next (suggested fixes)

---

## System Prompt Design

### Do
- Be specific about the agent's role and capabilities
- Include examples of correct behavior
- Define what the agent should NOT do
- Set tone and style guidelines
- Include context about the environment (OS, project type, etc.)

### Don't
- Include instructions for every possible scenario (too long)
- Use vague language ("be helpful" — every LLM already tries this)
- Contradict yourself across sections
- Include dynamic content in the stable prompt prefix (breaks caching)

---

## Resilience Patterns

### Circuit Breaker
If a service fails repeatedly, stop calling it for a cooldown period. Prevents cascading failures.

### Timeout Everything
Every external call should have a timeout. Every tool execution should have a timeout. No operation should be allowed to hang indefinitely.

### Resource Limits
Set explicit limits on:
- Memory usage per tool execution
- Output size per tool result
- Number of concurrent operations
- Total cost per session

---

## Rate Limiting and Backoff

### API Rate Limiting
Track usage against provider rate limits. When approaching limits:
1. Show user a warning with wait time
2. Queue requests and drip-feed them
3. Fall back to a lower-cost model if available

### Self-Imposed Rate Limiting
Prevent your own agent from overwhelming external services:
- Limit concurrent web fetches
- Throttle file system operations in rapid succession
- Cap MCP calls per second

---

## Scaling Considerations

### Horizontal Scaling (Multiple Agent Sessions)
- Each session should be self-contained (no shared mutable state between sessions)
- Use unique session IDs for all logging and metrics
- Support concurrent sessions without interference

### Vertical Scaling (More Capable Sessions)
- Token budgets scale with model capability (larger models, larger context)
- Tool pools can grow with demand (dynamic registration)
- Background agents for parallelism within a session

### Cost Scaling
- Track per-session cost in real-time
- Support cost budgets and alerts
- Use model fallbacks (expensive model fails → try cheaper model)
- Cache and reuse results when possible

---

## Tool Idempotency

Design tools so that identical inputs produce identical results when called multiple times:

| Tool | Idempotent? | Notes |
|------|-------------|-------|
| FileRead | Yes | Same file → same content (if not modified) |
| FileWrite | Yes | Writing same content twice → same result |
| FileEdit | Conditional | First call succeeds, second fails ("not found") — safely idempotent |
| Bash | No | Side effects vary (rm, mkdir, etc.) |
| WebFetch | Mostly | Content may change between calls |
| Search | Yes | Same query → same results (if index unchanged) |

---

## Architecture Patterns for AI-Native Products

These are high-level architecture patterns observed in production agent systems. They apply to any AI product — coding agents, support bots, workflow tools, data pipelines, GTM automation, or any LLM-powered application.

### 1. Fast-Path Your Entry Points

Don't load everything upfront. Intercept simple commands (`--version`, `--help`, health checks) before the full application initializes. Users notice startup time more than you think.

- Fast-path routing: simple requests handled before full app loads
- Parallel prefetching: while parsing the command, prefetch auth, config, TLS, and API connections concurrently
- Memoized initialization: expensive setup operations run once and are cached

→ See [10_state_lifecycle.md §Bootstrap](10_state_lifecycle.md) for implementation details.

### 2. Invest in Your Streaming/Rendering Layer

If your AI product has streaming responses, tool outputs, or multi-agent views, the rendering layer is the UX. Decouple rendering from agent logic completely — the agent loop produces an event stream, the renderer consumes it.

- Separate the agent loop from the UI (same core powers terminal, web, IDE, SDK)
- Handle streaming tokens, progressive tool results, and permission dialogs smoothly
- Invest in this layer early — a custom renderer that handles streaming well is a massive UX advantage

→ See [01_agent_loop.md §Decouple Rendering](01_agent_loop.md) for more.

### 3. Async Generator State Machines for Agent Loops

The agent loop should be an async generator (or equivalent) that yields events as they occur. The `for await (event of query(...))` pattern cleanly separates "produce events" from "consume events." Keep the loop stages distinct:

1. Normalize context
2. Build system prompt
3. Call the model
4. Collect tool calls
5. Execute tools
6. Append results
7. Check stop conditions

Most agent products mash these together and end up with spaghetti. Separate them cleanly.

→ See [01_agent_loop.md](01_agent_loop.md) for the full pattern.

### 4. Partition Tool Execution: Parallel Reads, Serial Writes

When the model returns multiple tool calls, partition them by safety:
- **Concurrent batch** — read-only, concurrency-safe tools run in parallel
- **Serial batch** — mutating tools run sequentially

Each tool goes through: input validation → pre-hooks → permission check → execution → post-hooks → result truncation. Most agent products run everything serially and it's unnecessarily slow.

→ See [02_tool_system.md §Concurrency](02_tool_system.md) for details.

### 5. Race Multiple Permission Resolvers

Don't just ask the user every time. Race multiple resolvers in parallel: user dialog, automated rules, AI classifier, external approval system. First safe answer wins. This means the fastest safe path always wins.

→ See [05_permissions_safety.md §Permission Race Pattern](05_permissions_safety.md) for the `resolveOnce` implementation.

### 6. Tiered Context Compression, Not Just Truncation

Most products just truncate from the top when context fills up. That's the least intelligent approach. Build tiered compression ordered from least lossy to most lossy:

1. Micro-compact (truncate oversized tool results)
2. Selective compression (summarize specific segments)
3. Session memory extraction (save key facts externally)
4. Full compaction (summarize entire history)
5. Last-resort truncation (drop oldest messages)

The difference between a product that "loses context" and one that "remembers everything" is this engineering.

→ See [04_context_memory.md §Compaction Strategies](04_context_memory.md) for the full pipeline.

### 7. Split System Prompts: Static (Cached) + Dynamic (Per-Turn)

If you're sending system prompts to an LLM API, split them in two. Stable instructions first (cacheable, rarely changes). Dynamic context after (rebuilt every turn). Put an explicit cache boundary between them. This dramatically reduces API costs because the cached prefix doesn't get re-processed.

→ See [04_context_memory.md §Cache-Aware Prompt Splitting](04_context_memory.md) for the pattern.

### 8. Design Sub-Agent Spawning Around Cache Sharing

If you're building a multi-agent system, think about cache topology. Sub-agents that share the same system prompt prefix (role + tools + project context) share the same API cache. Design your agent spawning to maximize cache hits — 5 parallel agents with shared prefixes cost barely more than 1 sequential agent.

→ See [03_multi_agent.md §Cache-Aware Sub-Agent Spawning](03_multi_agent.md) for details.

### 9. Build Hooks From Day One

Even if you don't use them immediately, the ability to run custom logic before/after every tool call, every message, every session is what turns a product into a platform. Your power users will build things on top of your hooks that you never imagined. Hooks > plugins > hardcoded features.

→ See [02_tool_system.md §Hook and Lifecycle System](02_tool_system.md) for the pattern.

### 10. Persist Everything, Make Sessions Resumable

Persist conversations, tool results, and agent state. Make it resumable. The cost of storage is nothing compared to the cost of lost context. Most AI products treat every session as ephemeral and it kills the user experience for long-running tasks.

→ See [10_state_lifecycle.md §Persistence and Resumability](10_state_lifecycle.md) for implementation.

### 11. Make Permissions Configurable, Not Binary

A 5-level rule cascade with auto-classifiers is way more sophisticated than "allow all" or "ask every time." Your users have different risk tolerances. Let them configure it. Layer rules from enterprise policy (highest priority) down to user defaults (lowest).

→ See [05_permissions_safety.md](05_permissions_safety.md) for the full tier model.

---

## Case Study: Claude Code

Claude Code embodies many of these patterns:

**Read-Before-Write**: The `readFileState` map enforces that files are read before editing. FileEditTool checks the map and rejects edits to unread files.

**Graceful Degradation**: All tool calls return structured `ToolResult` objects with typed data. Errors include descriptions and are fed back to the model for reasoning.

**Prompt Caching**: Tool definitions and system prompts are ordered for stability. The `assembleToolPool()` function sorts tools by name for consistent prompt prefix.

**Progressive Disclosure**: `ToolSearchTool` lets the agent discover tools by description when the full set isn't loaded. `TOOL_PRESETS` provide `minimal`, `standard`, and `full` sets.

**Error Handling**: The `withRetry()` utility implements exponential backoff with jitter. Error classification drives the retry strategy. Rate limit errors show countdown timers.

**Resilience**: Every API call has a timeout. Tool executions have per-tool timeouts. The token budget system prevents context overflow.

---

## Tags

#patterns #anti-patterns #best-practices #pitfalls #error-handling #retry #rate-limiting #idempotency #system-prompt #resilience #scaling #read-before-write #graceful-degradation #progressive-disclosure #prompt-caching #architecture-patterns #fast-path #cache-aware #hooks-as-platform #parallel-reads-serial-writes #tiered-compression #decoupled-rendering #persistence
