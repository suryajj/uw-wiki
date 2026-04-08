---
tags: [context-window, memory, compaction, token-budget]
complexity: intermediate
prerequisites: [00_foundations, 01_agent_loop]
---

# Context & Memory Management

> How to manage finite context windows, implement compaction strategies, and build long-term memory systems for agents.

---

## Pattern (Universal)

Every LLM-based agent operates within a fixed context window. As conversations grow, agents must decide what to keep, what to summarize, and what to store externally. This guide covers the three layers of agent memory: working memory (context window), session memory (within a conversation), and long-term memory (across conversations).

---

## Context Window Fundamentals

The context window is your agent's working memory. It holds the system prompt, conversation history, tool definitions, and tool results. Managing it well is the difference between an agent that works on toy examples and one that handles real-world tasks.

Key constraints:
- **Fixed size**: Models have hard token limits (e.g., 128K, 200K tokens)
- **Cost scales linearly**: More tokens = more cost per API call
- **Prompt caching**: Keeping a stable prefix improves latency and cost
- **Quality degrades**: Models perform worse when context is cluttered with irrelevant information

---

## Token Budget Tracking

Track token usage across all components of your context:

| Component | Typical Budget Share | Priority |
|-----------|---------------------|----------|
| System prompt | 5-15% | Fixed, always present |
| Tool definitions | 10-20% | Semi-fixed, can filter |
| Conversation history | 40-60% | Dynamic, compactable |
| Tool results | 10-30% | Dynamic, truncatable |
| Reserved for response | 5-10% | Must be preserved |

### Implementation Pattern

Maintain a token budget tracker that monitors usage before each API call. When the total exceeds a threshold (e.g., 80% of max), trigger compaction.

---

## Context Assembly

Building the API request context follows a priority order:

1. **System prompt** — always included, defines agent behavior
2. **Tool definitions** — filtered to relevant tools when possible
3. **Recent history** — most recent turns are highest priority
4. **Older history** — summarized or compacted versions of earlier turns
5. **Injected context** — memory, project files, relevant documentation

### Cache-Aware Prompt Splitting

Split the system prompt into two sections separated by an explicit cache boundary:

```
┌──────────────────────────────────────┐
│  STATIC SECTION (cacheable)          │  ← Rarely changes between turns
│  - Role & identity instructions      │
│  - Tool usage guidelines             │
│  - Style rules & constraints         │
│  - Domain-specific instructions      │
│                                      │
│  ─── cache boundary ───              │
│                                      │
│  DYNAMIC SECTION (per-request)       │  ← Changes every turn
│  - Project/session context files     │
│  - Environment info                  │
│  - Current state (e.g., git status)  │
│  - Memory / relevant prior context   │
│  - Current date/time                 │
└──────────────────────────────────────┘
```

The static section gets cached by the LLM API (typically 1-hour TTL). The dynamic section is rebuilt every turn. This dramatically reduces cost because the cached prefix doesn't get re-processed. Most agent products rebuild the entire system prompt every turn and pay full price every time — splitting saves significant money at scale.

**Key principle**: Put stable instructions first (cacheable). Put dynamic context after. Keep tool definitions sorted alphabetically for cache stability (consistent ordering means more cache hits).

---

## Compaction Strategies

### Full Compaction
Summarize the entire conversation history into a condensed form. Use when approaching context limits.

### Micro-Compaction
Selectively compress individual tool results or long messages without summarizing the whole conversation. More surgical, preserves more detail.

### Time-Based Compaction
Compress older messages more aggressively than recent ones. Recent context stays detailed; older context becomes summary.

### Grouped Compaction
Group related turns (e.g., a tool call and its result) and compress them together, preserving the logical structure.

---

## Conversation History Management

Maintain conversation history as a structured list of messages. Each message has a role (user, assistant, tool_result) and content. Key patterns:

- **Sliding window**: Keep the N most recent turns, discard older ones
- **Summary + recent**: Keep a running summary of older turns + full recent turns
- **Importance scoring**: Score each turn by relevance and keep the highest-scoring ones

---

## Session Memory

Within a single conversation, accumulate key facts, decisions, and context that the agent should remember:

- Files modified and their purposes
- User preferences discovered during the session
- Errors encountered and how they were resolved
- Architectural decisions made

Session memory can be injected into the system prompt or appended as context.

---

## Long-Term Memory Systems

### File-Based Memory
Store memories as markdown files in a well-known directory (e.g., `~/.agent/memory/`). Each memory is a file with metadata (timestamp, tags, relevance score). On session start, scan and inject relevant memories.

### Memory Consolidation
Periodically consolidate related memories into higher-level summaries. This prevents memory directories from growing unbounded while preserving key insights. Can be done as a background "dream" process during idle time.

### Relevance Scoring
When injecting memories into context, score each memory against the current task/conversation. Only inject memories above a relevance threshold.

---

## Case Study: Claude Code

Claude Code manages a 200K token context window across long coding sessions with a **5-stage compaction pipeline** that runs before every API call.

### System Prompt Assembly (`context.ts`)

The system prompt is assembled once per session and cached:
1. **CLAUDE.md** — project instructions (walks up directory tree to find all CLAUDE.md files)
2. **Tool definitions** — sorted for prompt cache stability
3. **Git status** — branch, recent commits, working tree status
4. **Memory files** — relevant memories scored against current task
5. **Date** — current local date
6. **Injected context** — IDE context, diagnostic tracking

Additional context uses `<system-reminder>` XML tags to distinguish system-injected content from user input.

### Compaction Pipeline (5 Stages)

Each stage runs in sequence before the API call, ordered from cheapest to most expensive:

| Stage | Trigger | Strategy | Source |
|-------|---------|----------|--------|
| **1. Snip** | Manual or tool-invoked | Trim specific message segments by ID tag (`[id:xxx]`) | `services/compact/snipCompact.ts` |
| **2. Microcompact** | Always (automatic) | Truncate oversized tool results in-place; cache-editing variant deletes cached tokens without re-sending | `services/compact/microCompact.ts` |
| **3. Context Collapse** | Progressive | Summarize older context segments, replay collapsed summaries from a commit log | `services/contextCollapse/` |
| **4. Autocompact** | Token budget ~80% | Full conversation summarization, preserving a "protected tail" of recent messages | `services/compact/autoCompact.ts` |
| **5. Reactive Compact** | API 413 error | Emergency single-shot after prompt-too-long or media-size rejection; strips images/PDFs if needed | `services/compact/reactiveCompact.ts` |

Plus two **post-turn** stages:
- **Memory extraction** — save important facts to session memory after each response
- **Auto-Dream** — background memory consolidation during idle periods

### Token Budget Tracking

The `tokenBudget.ts` module tracks cumulative output tokens per turn and enables a **+500K auto-continue** feature: when the model hits its output limit but hasn't finished, the system injects a nudge message ("Resume directly — no apology, no recap") and continues. This is distinct from the API's `task_budget` which counts total context across an agentic turn.

### Snip Compaction (Experimental)

Messages are tagged with short IDs (e.g., `[id:a3f2k1]`) derived deterministically from their UUIDs. The `Snip` tool lets the model trim specific segments by referencing these IDs. The snip projection (`snipProjection.ts`) produces a "snipped view" of messages for the model while the REPL keeps full history for UI scrollback.

### Context Collapse

Unlike autocompact (which summarizes everything), context collapse works progressively:
- Groups older messages into collapsible segments
- Produces summaries and replaces segments with `<collapsed>` markers
- Stores commit log of collapses so they replay consistently across turns
- Can recover from overflow by draining staged collapses

### Long-Term Memory (`memdir`)

Stores memories as markdown files in `~/.claude/memory/` with YAML frontmatter. The `autoDream` service runs during idle time:
- **Consolidation** — merges related memories into higher-level summaries
- **Pruning** — removes stale or superseded memories
- **Lock** — uses a consolidation lock to prevent concurrent dream processes

### Memory Relevance Prefetch

At the start of each turn, a prefetch fires a side-query to score memories against the current task. Results are consumed when settled (non-blocking), injected as `relevant_memories` attachments above threshold. If unsettled by turn end, deferred to next iteration.

### Tool Result Budget

Aggregate tool result sizes are capped per message via `applyToolResultBudget()`. When results exceed the limit, content is replaced with a content-replacement record and the original is stored for resumption. Tools can opt out by setting `maxResultSizeChars` to Infinity.

---

## Code Template: TypeScript

See [templates/typescript/context-manager.ts](../templates/typescript/context-manager.ts) for a working implementation.

## Code Template: Python

See [templates/python/context_manager.py](../templates/python/context_manager.py) for a working implementation.

---

## Key Decisions & Trade-offs

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|----------------|
| When to compact | Fixed threshold (80%) | On-demand (when API rejects) | Fixed threshold — avoids failed requests |
| Compaction method | Full summarization | Sliding window | Summarization for long sessions, sliding window for short |
| Memory storage | Database | File system | Files for simplicity, DB for scale |
| Memory injection | Always inject all | Score and filter | Score and filter — keeps context relevant |

---

## Tags

#context-window #memory #compaction #token-budget #session-memory #long-term-memory #memory-consolidation #auto-compact #micro-compact #context-assembly #cache-aware #prompt-splitting #static-dynamic
