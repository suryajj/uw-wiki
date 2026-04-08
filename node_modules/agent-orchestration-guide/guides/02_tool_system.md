---
tags: [tool-design, tool-registry, schemas, tool-execution]
complexity: foundational
prerequisites: [00_foundations, 01_agent_loop]
---

# The Tool System

> How to design tools, build a registry, validate inputs, handle permissions, and execute tool calls in an agent system.

---

## The Tool Abstraction

A tool is a discrete capability that an agent can invoke. It bridges the gap between what the LLM can reason about and what the system can execute. Every tool has:

| Component | Purpose | Example |
|-----------|---------|---------|
| **Name** | Unique identifier | `FileRead`, `Bash`, `WebSearch` |
| **Description** | What the tool does (shown to LLM) | "Read the contents of a file at the specified path" |
| **Input schema** | Structured definition of required inputs | `{ path: string, offset?: number }` |
| **Execution logic** | The actual implementation | Read file from disk, return contents |
| **Permission model** | Who can use it and when | Read-only → auto-approve |
| **Result format** | How output is structured for the LLM | `{ content: string, lineCount: number }` |

### The Tool Interface

Define a standard interface that all tools implement:

```
Tool {
  // Identity
  name: string
  description(): string           // Dynamic — can change based on context
  
  // Schema
  inputSchema: Schema             // JSON Schema or Zod schema for inputs
  
  // Capability flags
  isEnabled(): boolean            // Is this tool available right now?
  isReadOnly(input): boolean      // Does this tool only read (no side effects)?
  isConcurrencySafe(input): boolean  // Safe to run in parallel with other tools?
  isDestructive(input): boolean   // Can this tool cause irreversible damage?
  
  // Execution pipeline
  validateInput(input): ValidationResult
  checkPermissions(input, context): PermissionDecision
  call(input, context): ToolResult
  
  // Output
  mapResultToAPIFormat(output, toolUseId): ToolResultBlock
}
```

---

## The buildTool Pattern

Instead of requiring every tool to implement the full interface, provide a `buildTool()` factory that fills in safe defaults:

```
function buildTool(definition):
  return {
    // Apply defaults for anything not specified
    isEnabled: definition.isEnabled ?? () => true,
    isReadOnly: definition.isReadOnly ?? () => false,
    isConcurrencySafe: definition.isConcurrencySafe ?? () => false,
    isDestructive: definition.isDestructive ?? () => false,
    checkPermissions: definition.checkPermissions ?? () => { behavior: 'allow' },
    validateInput: definition.validateInput ?? schemaValidation(definition.inputSchema),
    
    // Required fields (no defaults)
    name: definition.name,
    description: definition.description,
    inputSchema: definition.inputSchema,
    call: definition.call,
    mapResultToAPIFormat: definition.mapResultToAPIFormat,
  }
```

This pattern means simple tools can be defined with just `name`, `inputSchema`, `description`, and `call` — everything else gets sensible defaults. Complex tools override what they need.

---

## Input Schemas and Validation

### Schema Definition

Use a schema validation library (Zod, JSON Schema, Pydantic) to define tool inputs:

```
// TypeScript with Zod
const FileReadInput = z.object({
  path: z.string().describe("Absolute path to the file to read"),
  offset: z.number().optional().describe("Line number to start reading from"),
  limit: z.number().optional().describe("Number of lines to read"),
})

// Python with Pydantic
class FileReadInput(BaseModel):
    path: str = Field(description="Absolute path to the file to read")
    offset: int | None = Field(default=None, description="Line number to start reading from")
    limit: int | None = Field(default=None, description="Number of lines to read")
```

### Validation Pipeline

```
Raw LLM output → JSON parse → Schema validation → Semantic validation → Execution
```

1. **JSON parse** — extract the tool input from the LLM response
2. **Schema validation** — check types, required fields, constraints
3. **Semantic validation** — tool-specific checks (file exists, path is within allowed directory, command is safe)
4. **Execution** — only proceeds if all validation passes

### Validation Results

```
ValidationResult = 
  | { valid: true }
  | { valid: false, message: string, errorCode?: number }
```

Return detailed error messages. These get fed back to the LLM, which can often self-correct.

---

## The Tool Registry

The registry is where all available tools are collected, filtered, and served to the agent loop.

### Registry Operations

```
ToolRegistry {
  // Registration
  registerTool(tool: Tool): void
  registerMCPTools(tools: Tool[]): void
  
  // Retrieval
  getAllTools(): Tool[]
  getToolByName(name: string): Tool | null
  getToolsForContext(context: PermissionContext): Tool[]
  
  // Filtering
  filterByPermission(tools, permissionContext): Tool[]
  filterByDenyRules(tools, denyRules): Tool[]
  
  // Search
  searchTools(query: string): Tool[]
}
```

### Assembly Pipeline

```
Built-in tools + MCP tools → Deduplicate → Filter by deny rules → Sort for cache stability → Tool pool
```

Key steps:
1. **Collect** all built-in tools from `getAllBaseTools()`
2. **Add** dynamically registered MCP tools
3. **Deduplicate** — built-in tools take precedence over MCP tools with the same name
4. **Filter** — remove tools that match deny rules in the permission context
5. **Sort** — sort by name for prompt-cache stability (consistent tool ordering)

### Tool Presets

Define presets for different use cases:

| Preset | Example Tools | Use Case |
|--------|---------------|----------|
| `minimal` | 2-3 core domain tools | Simple tasks, low token overhead |
| `standard` | All primary domain tools | Typical tasks |
| `full` | Everything including MCP/plugin tools | Complex tasks needing all capabilities |

A coding agent's standard set includes file and shell tools. A support agent's standard set includes ticket, knowledge base, and CRM tools. The preset pattern applies regardless of domain.

---

## Tool Execution Pipeline

When the agent loop receives a tool_use block from the LLM, this pipeline runs:

```
┌──────────────────────────────────────────────────┐
│              TOOL EXECUTION PIPELINE              │
│                                                    │
│  1. Find tool by name in registry                 │
│     └── Not found → return error to LLM           │
│                                                    │
│  2. Validate input against schema                  │
│     └── Invalid → return validation error to LLM   │
│                                                    │
│  3. Check permissions                              │
│     ├── Allow → proceed                            │
│     ├── Ask → show approval dialog, wait           │
│     │   ├── Approved → proceed                     │
│     │   └── Denied → return denial to LLM          │
│     └── Deny → return denial to LLM               │
│                                                    │
│  4. Execute tool (call the implementation)         │
│     └── Error → capture and return error to LLM    │
│                                                    │
│  5. Format result                                  │
│     ├── Truncate if over size limit                │
│     └── Map to API format (tool_result block)      │
│                                                    │
│  6. Track metrics (duration, success/failure)      │
└──────────────────────────────────────────────────┘
```

### Execution Context

Every tool receives a context object with everything it might need:

```
ToolUseContext {
  // Configuration
  tools: Tool[]              // All available tools
  model: string              // Current model
  
  // Abort
  abortController: AbortController
  
  // State
  getAppState(): AppState
  setAppState(fn): void
  readFileState: Map<path, { content, mtime }>  // For read-before-write
  
  // Permissions
  permissionContext: PermissionContext
  onPermissionRequest(req): Promise<PermissionDecision>
  
  // Agent context
  agentId?: string           // If this is a sub-agent
  isSubagent?: boolean
  
  // Callbacks
  onToolCallStart(name, input): void
  onToolCallEnd(name, result): void
}
```

---

## Tool-Level Permissions

Each tool declares its permission requirements. The permission system checks these against configured rules:

### Permission Decision Types

```
PermissionDecision =
  | { behavior: 'allow', updatedInput: Input }   // Proceed (input may be modified)
  | { behavior: 'ask', message: string }          // Show dialog to user
  | { behavior: 'deny', message: string }         // Block execution
  | { behavior: 'passthrough' }                   // Always ask (no cached decision)
```

### Permission Check Flow

```
function checkPermissions(tool, input, context):
  // 1. Check deny rules first
  if matchesDenyRule(tool, input, context.denyRules):
    return { behavior: 'deny', message: "Blocked by deny rule" }
  
  // 2. Check allow rules
  if matchesAllowRule(tool, input, context.allowRules):
    return { behavior: 'allow', updatedInput: input }
  
  // 3. Check permission mode
  if context.mode == 'bypass':
    return { behavior: 'allow', updatedInput: input }
  if context.mode == 'plan' and not tool.isReadOnly(input):
    return { behavior: 'deny', message: "Write operations not allowed in plan mode" }
  
  // 4. Check tool's own permission logic
  return tool.checkPermissions(input, context)
```

---

## Concurrency and Safety Flags

Tools declare whether they're safe to run concurrently:

| Flag | Meaning | Example |
|------|---------|---------|
| `isReadOnly` | No side effects | FileRead, Grep, Glob |
| `isConcurrencySafe` | Safe to run in parallel | FileRead (yes), FileEdit (no) |
| `isDestructive` | Can cause irreversible damage | `rm -rf`, git force push |

### Parallel Execution Rules

When the LLM requests multiple tool calls in a single response:
1. Separate read-only + concurrency-safe tools from the rest
2. Run the safe tools in parallel
3. Run the unsafe tools sequentially
4. Collect all results and feed back to the LLM

---

## Result Handling and Output Mapping

### ToolResult Structure

```
ToolResult {
  data: any                 // The actual output (file contents, command output, etc.)
}
```

### Mapping to API Format

Each tool maps its result to the format the LLM API expects:

```
function mapResultToAPIFormat(output, toolUseId):
  return {
    type: "tool_result",
    tool_use_id: toolUseId,
    content: formatForLLM(output),  // String or structured content blocks
  }
```

### Result Size Limits

Set a maximum size for tool results (e.g., `maxResultSizeChars = 30000`). If a result exceeds this, truncate intelligently:
- For file contents: truncate with a "... N more lines ..." indicator
- For command output: keep the first and last N lines
- For search results: limit the number of matches

---

## Tool Discovery

When the tool set is large, not every tool needs to be in the active prompt. Implement a discovery mechanism:

### ToolSearchTool
A meta-tool that searches the available tool catalog by description/capability:

```
Input: { query: "I need to search for files by name" }
Output: "GlobTool — Find files matching a glob pattern. Use for finding files by name."
```

### Deferred Loading
Mark some tools as `shouldDefer = true`. These tools are not included in the initial tool list sent to the LLM. They become available when the agent explicitly searches for them or when context suggests they're needed.

---

## Tool Presets and Filtering

### Filtering by Deny Rules

Remove tools that match blanket deny rules before sending to the LLM:

```
function filterToolsByDenyRules(tools, permissionContext):
  return tools.filter(tool => 
    not permissionContext.alwaysDeny.some(rule => 
      matchesRule(rule, tool.name)))
```

### CLI Overrides

Support allowlists and denylists from the command line:
- `--allowedTools "FileRead,FileEdit,Bash"` — only these tools available
- `--disallowedTools "WebFetch,WebSearch"` — exclude these tools

---

## Hook and Lifecycle System

Hooks are the mechanism that turns an agent product into an agent platform. By exposing lifecycle events that custom logic can intercept, you let users extend the system without modifying the core.

### Lifecycle Events

Define hook points at every critical juncture in the agent's execution:

| Hook Point | When It Fires | What It Can Do |
|------------|---------------|----------------|
| **PreToolUse** | Before a tool executes | Block, modify input, inject context, redirect to a different tool |
| **PostToolUse** | After a tool returns | Transform results, trigger side effects, log analytics |
| **UserPromptSubmit** | When user submits a message | Inject context into every message, validate input, route |
| **AgentSpawn** | When a sub-agent is created | Modify sub-agent config, inject instructions, restrict tools |
| **SessionStart** / **SessionEnd** | Session lifecycle boundaries | Initialize resources, persist state, clean up |

### Hook Types

Support multiple hook sources so different integration levels can participate:

| Hook Type | Source | Use Case |
|-----------|--------|----------|
| **Command hooks** | Shell commands triggered by events | Run linters, formatters, external scripts |
| **Function hooks** | In-process callbacks (SDK integration) | Low-latency, typed responses |
| **HTTP hooks** | Webhook calls to external services | External approval systems, logging services |
| **Prompt hooks** | LLM-based classifiers or evaluators | Content filtering, safety checks |
| **Plugin hooks** | Registered from plugin/MCP manifests | Third-party extensions |

### Hook Design Principles

1. **Hooks should be non-blocking by default** — if a hook fails, the operation should continue unless the hook explicitly requests a block
2. **Hooks should be chainable** — multiple hooks at the same lifecycle point run in priority order
3. **Hooks should be discoverable** — the system should report which hooks are active and what they do
4. **Build hooks from day one** — even if you don't use them immediately, the ability to run custom logic before/after every tool call, every message, every session is what turns a product into a platform

### PreToolUse / PostToolUse Pattern

These are the most powerful hooks for tool execution:

```
PreToolUse(toolName, input, context):
  // Return: { action: 'allow' } — proceed normally
  //         { action: 'block', reason: string } — prevent execution
  //         { action: 'modify', newInput: {...} } — rewrite the input
  //         { action: 'redirect', toolName: string, input: {...} } — use a different tool

PostToolUse(toolName, input, result, context):
  // Return: { result: transformedResult } — modify what the LLM sees
  //         { sideEffects: [...] } — trigger additional actions
```

This pattern lets users inject domain-specific validation, enforce organizational policies, add logging/analytics, and integrate with external systems — all without touching the core agent loop.

---

## Case Study: Claude Code

Community analysis of the source revealed 53+ tools and a sophisticated execution pipeline.

### Tool Assembly Pipeline

Tools are assembled through a 4-step pipeline:

1. **`getAllBaseTools()`** — returns all tools with feature-flag filtering (`feature()` compile-time gates + `process.env` checks). Must stay in sync with Statsig global caching config for prompt cache stability.
2. **`getTools(permissionContext)`** — applies deny rules via `filterToolsByDenyRules()`. Supports `CLAUDE_CODE_SIMPLE` mode (just Bash, FileRead, FileEdit). When REPL mode is enabled, hides primitive tools.
3. **`assembleToolPool(permissionContext, mcpTools)`** — merges built-in + MCP tools. Built-ins sorted as contiguous prefix for cache stability, MCP tools sorted after. `uniqBy('name')` ensures built-ins win on conflict.
4. **Tool search deferred loading** — when `isToolSearchEnabledOptimistic()` is true, some tools get `shouldDefer` flag and are loaded only when `ToolSearchTool` finds them relevant.

### 53+ Tools by Category

- **File (6)**: FileRead, FileWrite, FileEdit, Glob, Grep, NotebookEdit
- **Execution (3)**: Bash, PowerShell (Windows), REPL (VM context)
- **Search & Fetch (4)**: WebBrowser (experimental), WebFetch, WebSearch, ToolSearch
- **Agents & Tasks (11)**: Agent, SendMessage, TaskCreate/Get/List/Update, TaskStop, TaskOutput, TeamCreate/Delete, ListPeers
- **Planning (5)**: EnterPlanMode, ExitPlanModeV2, EnterWorktree, ExitWorktree, VerifyPlanExecution
- **MCP (4)**: MCPTool, ListMcpResources, ReadMcpResource, McpAuth
- **System (11)**: AskUserQuestion, TodoWrite, Skill, Config, RemoteTrigger, CronCreate/Delete/List, Snip, Workflow, TerminalCapture
- **Experimental (8)**: Sleep, Brief (SendUserMessage), StructuredOutput, LSP, SendUserFile, PushNotification, Monitor, SubscribePR

### Streaming Tool Executor

The `StreamingToolExecutor` class (`services/tools/StreamingToolExecutor.ts`) manages concurrent tool execution as tools arrive during streaming:

- Tools are added via `addTool()` as `tool_use` blocks arrive in the stream
- Each tool declares `isConcurrencySafe` — parsed from its Zod schema at add time
- Concurrent-safe tools (FileRead, Grep, etc.) execute in parallel via `Promise.all`
- Non-concurrent tools (FileEdit, Bash) execute sequentially with exclusive access
- If a Bash tool errors, `siblingAbortController` fires — canceling all in-flight sibling subprocesses immediately
- Results are **buffered and yielded in order** via `getCompletedResults()` (synchronous) and `getRemainingResults()` (async generator)
- Progress messages bypass the buffer and yield immediately
- On discard (streaming fallback), all pending tools receive synthetic error results

### Hook System (25+ Lifecycle Events)

Claude Code implements hooks at 25+ lifecycle points with 5 hook types (command, prompt, agent, HTTP, function). Hooks can come from settings, plugins, agent frontmatter, or SDK callbacks:

- **PreToolUse** — can block or modify tool calls before execution. Used for custom validation, security policies, and organizational rules
- **PostToolUse** — can transform tool results. Used for logging, analytics, and result processing
- **UserPromptSubmit** — can inject context into every user message. Used for adding project-specific context
- Hook sources: settings files, plugin manifests, agent frontmatter (YAML), and SDK callbacks
- Hooks are chainable — multiple hooks at the same lifecycle point run in priority order

### Tool Input Normalization

The `normalizeToolInput()` function corrects model output quirks:
- Parses stringified JSON from streaming (recursive parsing for nested stringification)
- Tool-specific corrections via `backfillObservableInput()`
- Legacy tool name mapping via `normalizeLegacyToolName()`
- Logs diagnostic telemetry on JSON parse failures

### Tool Result Budget

`applyToolResultBudget()` caps aggregate tool result sizes across messages:
- Per-tool limit via `maxResultSizeChars` (tools can opt out with Infinity)
- Content replaced with replacement records; originals stored for session resume
- Runs before microcompact — cache editing is invisible to it

---

## Code Template: TypeScript

See [templates/typescript/tool-registry.ts](../templates/typescript/tool-registry.ts) for a working implementation.

## Code Template: Python

See [templates/python/tool_registry.py](../templates/python/tool_registry.py) for a working implementation.

---

## Key Decisions & Trade-offs

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|----------------|
| Schema library | JSON Schema | Zod/Pydantic | Zod (TS) or Pydantic (Python) — better DX and type safety |
| Tool loading | All upfront | Lazy/deferred | Upfront for core tools, deferred for specialized tools |
| Result format | Plain string | Structured object | Structured — enables downstream processing and size tracking |
| Tool ordering | Alphabetical | By category | Alphabetical — simpler, prompt-cache-stable |
| MCP integration | Separate pool | Merged with built-in | Merged — single pool simplifies the agent loop |

---

## Tags

#tool-design #tool-registry #schemas #tool-execution #input-validation #permission-check #tool-result #concurrency-safety #tool-discovery #tool-presets #buildTool #tool-context #mcp-tools #hooks #lifecycle-events #PreToolUse #PostToolUse
