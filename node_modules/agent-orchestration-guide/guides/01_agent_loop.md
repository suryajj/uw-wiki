---
tags: [agent-loop, query-engine, execution-cycle]
complexity: foundational
prerequisites: [00_foundations]
---

# The Agent Loop

> The query-execute-observe cycle that powers every agent system. How to build it, manage turns, handle streaming, and implement stop conditions.

---

## The Query-Execute-Observe Cycle

The agent loop is the core execution cycle of any agent system. It has three phases that repeat until a stop condition is met:

1. **Query** — Assemble context and call the LLM
2. **Execute** — Parse the response and run any tool calls
3. **Observe** — Feed tool results back into context and decide whether to continue

```
         ┌──────────────────────────────────┐
         │           USER INPUT              │
         └──────────────┬───────────────────┘
                        ▼
         ┌──────────────────────────────────┐
         │        ASSEMBLE CONTEXT           │
         │  System prompt + history + tools  │
         └──────────────┬───────────────────┘
                        ▼
         ┌──────────────────────────────────┐
    ┌───▶│          CALL LLM API            │
    │    │  Stream response tokens           │
    │    └──────────────┬───────────────────┘
    │                   ▼
    │    ┌──────────────────────────────────┐
    │    │        PARSE RESPONSE             │
    │    │                                   │
    │    │  ├── Text block → accumulate      │
    │    │  ├── Thinking block → log/display │
    │    │  └── Tool use block → execute     │
    │    └──────────────┬───────────────────┘
    │                   ▼
    │    ┌──────────────────────────────────┐
    │    │    TOOL EXECUTION (if needed)     │
    │    │                                   │
    │    │  1. Validate input                │
    │    │  2. Check permissions              │
    │    │  3. Execute tool                   │
    │    │  4. Format result                  │
    │    └──────────────┬───────────────────┘
    │                   ▼
    │    ┌──────────────────────────────────┐
    │    │       CHECK STOP CONDITIONS       │
    │    │                                   │
    │    │  ├── No tool calls → DONE         │
    │    │  ├── Budget exceeded → DONE       │
    │    │  ├── Max turns → DONE             │
    │    │  └── More tool calls → CONTINUE   │
    │    └──────────────┬───────────────────┘
    │                   │
    │         ┌─────────┴─────────┐
    │         │ CONTINUE          │ DONE
    └─────────┘                   ▼
                       ┌──────────────────┐
                       │  RETURN RESPONSE  │
                       └──────────────────┘
```

---

## Entry Points and Initialization

Before the loop runs, the system needs to bootstrap:

### Interactive Mode (REPL)
1. Parse CLI arguments and load configuration
2. Initialize the UI (terminal, IDE panel, web interface)
3. Load tools, agents, and MCP connections
4. Display the prompt and wait for user input
5. On input: enter the agent loop

### Headless Mode (Print/Script)
1. Parse arguments (prompt comes from `-p` flag or stdin)
2. Load tools (potentially a minimal set)
3. Run the agent loop once
4. Print the result and exit

### SDK/Programmatic Mode
1. Initialize the query engine with configuration
2. Call `query(prompt, options)` directly
3. Receive structured results

The key insight: **the agent loop itself is the same** regardless of how it's invoked. The entry point just determines how input arrives and output is presented.

---

## Building a Query Engine

The query engine is the stateful component that manages the agent loop. It holds configuration, conversation history, and the tool pool.

### Core Components

```
QueryEngine {
  // Configuration
  model: string                    // Which LLM to use
  systemPrompt: string             // Base instructions
  tools: Tool[]                    // Available tools
  maxTokens: number                // Context window size
  
  // State
  history: Message[]               // Conversation history
  tokenBudget: TokenBudget         // Usage tracking
  costTracker: CostTracker         // Financial tracking
  
  // Methods
  query(input: string): Response   // Run one agent loop
  addMessage(msg: Message): void   // Append to history
  compact(): void                  // Compress history
}
```

### The Query Method (Pseudocode)

```
function query(userInput):
  // 1. Add user message to history
  history.append({ role: "user", content: userInput })
  
  // 2. Assemble the API request
  request = {
    model: this.model,
    system: this.systemPrompt,
    messages: this.history,
    tools: this.tools.map(t => t.toAPISchema()),
    max_tokens: calculateResponseBudget(),
  }
  
  // 3. Call the LLM
  response = await llmClient.stream(request)
  
  // 4. Process the response
  assistantMessage = { role: "assistant", content: [] }
  toolResults = []
  
  for block in response:
    if block.type == "text":
      assistantMessage.content.append(block)
      
    if block.type == "tool_use":
      assistantMessage.content.append(block)
      result = await executeTool(block.name, block.input)
      toolResults.append({
        type: "tool_result",
        tool_use_id: block.id,
        content: result,
      })
  
  // 5. Add assistant message to history
  history.append(assistantMessage)
  
  // 6. If there were tool calls, feed results back and continue
  if toolResults.length > 0:
    history.append({ role: "user", content: toolResults })
    
    // Check stop conditions before recursing
    if not shouldStop():
      return query()  // Continue the loop (no new user input)
  
  // 7. Track cost
  costTracker.add(response.usage)
  
  // 8. Check if compaction is needed
  if tokenBudget.shouldCompact():
    compact()
  
  return response
```

---

## Streaming Response Handling

Production agents stream responses from the LLM rather than waiting for the full response. This provides real-time feedback and enables progressive rendering.

### Stream Processing Pipeline

```
LLM API → Stream Events → Parser → Renderer + Tool Executor
```

### Event Types

| Event | Action |
|-------|--------|
| `message_start` | Initialize response object, capture metadata |
| `content_block_start` | Begin accumulating a text, thinking, or tool_use block |
| `content_block_delta` | Append text deltas, update UI in real-time |
| `content_block_stop` | Finalize the block; if tool_use, queue for execution |
| `message_delta` | Capture stop reason, usage stats |
| `message_stop` | Response complete, process all queued tool calls |

### Streaming + Tool Execution

When the LLM streams a tool use block, you have two options:

1. **Wait for message completion** — collect all tool calls, then execute them (possibly in parallel). Simpler to implement.
2. **Execute as they arrive** — start executing tool calls as each block completes, while the LLM continues streaming. Lower latency, more complex.

Most systems use option 1 for simplicity. Option 2 is an optimization for latency-sensitive applications.

---

## Turn Management

A "turn" is one cycle of the agent loop: user input → LLM response → tool execution → result. Turns are how you track progress and enforce limits.

### Turn Counting

| What Counts as a Turn | What Doesn't |
|----------------------|--------------|
| Each LLM API call | UI rendering |
| Each tool execution | History reads |
| Each permission check | Internal calculations |

### Multi-Turn Conversations

In a multi-turn conversation, the agent loop runs once per user message. But each loop iteration may itself involve multiple "inner turns" (LLM calls tools, results fed back, LLM calls more tools, etc.).

```
User Turn 1: "Look up order #12345 and tell me its status"
  └── Inner Turn 1: LLM calls OrderLookup("12345")
  └── Inner Turn 2: LLM receives order data, responds with summary

User Turn 2: "Update the shipping address to 123 Main St"
  └── Inner Turn 1: LLM calls OrderLookup("12345")  [read before write]
  └── Inner Turn 2: LLM calls UpdateOrder("12345", {address: "123 Main St"})
  └── Inner Turn 3: LLM receives confirmation, responds with summary
```

The tools vary by domain (file tools for a coding agent, CRM tools for support, API tools for workflow automation), but the turn structure is identical.

---

## Stop Conditions and Turn Boundaries

The agent loop must have clear stop conditions to prevent runaway execution:

### Stop Condition Hierarchy

| Priority | Condition | Action |
|----------|-----------|--------|
| 1 (highest) | User cancels (Ctrl+C, abort signal) | Immediate stop |
| 2 | Cost budget exceeded | Stop after current tool completes |
| 3 | Token budget exceeded | Trigger compaction or stop |
| 4 | Max turns reached | Stop and return partial result |
| 5 | No more tool calls | Natural completion |
| 6 | Stop hook fires | Custom stop logic (e.g., test passed) |

### Implementing Stop Hooks

Stop hooks are custom functions that run after each turn to decide if the agent should stop. Useful for goal-directed agents:

```
stopHooks = [
  // Stop when all tests pass
  (turnResult) => turnResult.toolName == "Bash" 
    && turnResult.output.includes("All tests passed"),
    
  // Stop when a specific file exists
  (turnResult) => fs.existsSync("output/result.json"),
]
```

---

## Context Assembly

Before each LLM call, assemble the full context:

### Assembly Order (for prompt caching)

1. **System prompt** (stable — cacheable)
2. **Tool definitions** (semi-stable — cacheable when sorted)
3. **Injected context** (project files, memory — changes per session)
4. **Conversation history** (changes every turn)
5. **Pending tool results** (latest turn only)

Keep the stable parts at the beginning of the request. This maximizes prompt cache hit rates and reduces cost and latency.

### Token Budget Allocation

```
Total budget: 200,000 tokens (example)

System prompt:   ~5,000 tokens   (2.5%)
Tool definitions: ~20,000 tokens (10%)
Reserved for response: ~10,000   (5%)
Available for history: ~165,000  (82.5%)
```

When history exceeds its allocation, trigger compaction (see [04_context_memory.md](04_context_memory.md)).

---

## Decouple Rendering from Agent Logic

The agent loop and the rendering layer should be completely separate. The agent loop produces a stream of events (text deltas, tool calls, results, status changes). The renderer consumes that stream and presents it to the user.

Why this matters:
- **Multiple interfaces from one core** — the same agent loop can power a terminal UI, a web interface, an IDE extension, and an SDK, all from the same event stream
- **Streaming-first rendering** — if your rendering layer handles streaming well, the UX difference is massive. Most agent products have janky streaming because they didn't invest in the rendering layer
- **Testability** — the agent loop can be tested without any UI

If your agent has a unique interaction pattern (streaming responses, tool outputs, multi-agent views), invest in the rendering layer. A custom renderer that handles streaming output, progressive tool results, and permission dialogs smoothly is a significant UX advantage.

---

## Interactive vs Headless Modes

### Interactive (REPL)
- User types input, agent responds, repeat
- Full UI with streaming output, permission dialogs, status indicators
- Session persists until user exits
- Supports commands (e.g., `/compact`, `/plan`, `/help`)

### Headless (Print/Script)
- Single prompt in, single result out
- No UI, no dialogs — all permissions must be pre-configured
- Used in CI/CD, automation scripts, batch processing
- May have `max_turns` limit for safety
- Output format configurable (text, JSON, streaming JSON)

### SDK (Programmatic)
- Library integration: your code calls the query engine directly
- Full control over lifecycle, tools, and event handling
- No terminal UI — your application provides the interface
- Typically used for building custom agent products

---

## Error Handling in the Loop

### API Errors
- **Rate limit** → exponential backoff with jitter, show countdown
- **Overloaded** → retry with longer delay
- **Auth failure** → re-authenticate, retry once
- **Invalid request** → log, report to user, don't retry

### Tool Execution Errors
- **Permission denied** → return structured error, let LLM decide next step
- **Timeout** → kill the process, return timeout error
- **Invalid input** → return validation error with details
- **Runtime error** → capture stack trace, return as tool result

### Recovery Strategy
Always feed errors back to the LLM as tool results. The LLM can often self-correct:
- Wrong file path → LLM searches for the right path
- Command fails → LLM reads the error and tries a different approach
- Permission denied → LLM tries a different tool or asks the user

---

## Cost Tracking

Track cost per session to enable budgeting and billing:

### What to Track

| Metric | Source |
|--------|--------|
| Input tokens | API response `usage.input_tokens` |
| Output tokens | API response `usage.output_tokens` |
| Cache read tokens | API response `usage.cache_read_input_tokens` |
| Cache creation tokens | API response `usage.cache_creation_input_tokens` |
| Cost in USD | Calculated from token counts × model pricing |
| API call count | Counter per model |
| API duration | Wall clock time per call |
| Tool duration | Wall clock time per tool execution |

### Budget Enforcement

Set a `max_budget_usd` and check after each API call. When exceeded, stop the loop and return the partial result with a budget warning.

---

## Case Study: Claude Code

Claude Code's agent loop was reverse-engineered by the community. It runs an **11-step cycle** from keypress to rendered response:

```
 1. Input         → TextInput.tsx captures keypress (Ink React component)
 2. Message       → createUserMessage() wraps into Anthropic message format
 3. History       → Message pushed onto in-memory conversation array
 4. System Prompt → context.ts assembles CLAUDE.md + tool defs + memory + git status
 5. API Call      → query.ts streams to Claude API via Anthropic SDK (SSE)
 6. Token Parse   → QueryEngine.ts parses tokens as they arrive, renders live
 7. Tool Check    → If tool_use blocks: findToolByName() → canUseTool() → execute
 8. Tool Loop     → StreamingToolExecutor collects results, appends, loops to step 5
 9. Render        → Ink renders markdown response in terminal (Yoga flexbox)
10. Post Hooks    → Auto-compact if too long, extract memories, run dream mode
11. Await         → Back to REPL, waiting for next message
```

### The `query()` Async Generator

The core loop in `query.ts` is an **async generator** — a `while(true)` loop that yields stream events, messages, and control signals. State is carried in a mutable `State` object that's reassigned at each `continue` site:

```typescript
type State = {
  messages: Message[]
  toolUseContext: ToolUseContext
  autoCompactTracking: AutoCompactTrackingState | undefined
  maxOutputTokensRecoveryCount: number
  hasAttemptedReactiveCompact: boolean
  turnCount: number
  transition: Continue | undefined  // Why the previous iteration continued
}
```

Each iteration runs a **5-stage compaction pipeline** before the API call:
1. **Snip** — trim specific message segments by ID
2. **Microcompact** — truncate oversized tool results in-place
3. **Context collapse** — progressively summarize older context
4. **Autocompact** — full conversation summarization
5. **Reactive compact** — emergency single-shot on API 413

### Streaming Tool Execution

Claude Code uses a `StreamingToolExecutor` that starts tools **as their blocks arrive** in the stream, before the response completes:

- **Concurrent-safe tools** (FileRead, Grep, etc.) run in parallel
- **Non-concurrent tools** (FileEdit, Bash) run sequentially
- If a **Bash errors**, the `siblingAbortController` cancels all parallel siblings
- Results are **buffered and yielded in order** to maintain message sequence
- Progress messages stream immediately (not buffered)

### Message Normalization

Before each API call, `normalizeMessagesForAPI()` runs 12+ transformation passes:
1. Reorder attachments (bubble up to nearest tool result)
2. Filter virtual messages (display-only)
3. Strip unavailable MCP tool references
4. Merge consecutive user messages (API requirement)
5. Smoosh system-reminder text into adjacent tool_results
6. Relocate tool-reference siblings (prevent model stop-sequence imprinting)
7. Filter orphaned thinking-only messages
8. Filter trailing thinking blocks
9. Filter whitespace-only assistant messages
10. Ensure non-empty assistant content
11. Ensure tool_use/tool_result pairing (synthetic repairs)
12. Validate images for API size limits

### Error Recovery

Claude Code has multi-layered recovery:
- **Max output tokens** — retry up to 3 times with "resume directly" instructions, plus a one-shot escalation from 8K to 64K output tokens
- **Prompt too long (413)** — drain context collapses, then reactive compact, then surface error
- **Model fallback** — on capacity errors, switch to fallback model with tombstone cleanup of orphaned messages
- **Media size errors** — strip oversized images/PDFs via reactive compact

### Stop Conditions (7 levels)

| Priority | Condition | Action |
|----------|-----------|--------|
| 1 (highest) | User cancels (abort signal) | Immediate stop, synthetic REJECT_MESSAGE for pending tools |
| 2 | Cost budget exceeded (`--max-budget-usd`) | Stop after current tool completes |
| 3 | Token budget exceeded | Auto-continue with nudge message (up to limit) |
| 4 | Max turns reached (`--max-turns`) | Stop and return partial result |
| 5 | No more tool calls | Natural completion |
| 6 | Stop hooks fire | Custom logic (hook can prevent continuation) |
| 7 | Stop hook blocking errors | Feed errors back, continue |

---

## Code Template: TypeScript

See [templates/typescript/agent-loop.ts](../templates/typescript/agent-loop.ts) for a working implementation.

## Code Template: Python

See [templates/python/agent_loop.py](../templates/python/agent_loop.py) for a working implementation.

---

## Key Decisions & Trade-offs

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|----------------|
| Loop control | Recursive function calls | While loop with state | While loop — avoids stack overflow on long sessions |
| Tool execution timing | After message completes | As tool blocks stream in | After message — simpler, group parallel-safe tools |
| Context assembly | Rebuild every turn | Incremental append | Rebuild — ensures consistency, enables compaction |
| Error handling | Throw and catch | Return error as tool result | Return as tool result — LLM can self-correct |
| Streaming | Always stream | Batch for headless | Always stream — consistent code path, better UX |

---

## Tags

#agent-loop #query-engine #execution-cycle #streaming #stop-conditions #turn-management #context-assembly #cost-tracking #error-handling #interactive #headless #sdk #decoupled-rendering #event-stream
