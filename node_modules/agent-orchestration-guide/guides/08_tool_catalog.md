---
tags: [tool-catalog, file-tools, shell, search, web]
complexity: intermediate
prerequisites: [02_tool_system]
---

# Tool Catalog

> Reference catalog of common tool patterns for agent systems. While the examples here focus on file, shell, search, and web tools (common in coding agents), the design patterns — schemas, permission models, concurrency flags, result handling — apply to any tool in any domain (CRM tools, database tools, API integration tools, etc.).

---

## Pattern (Universal)

Most agent systems need a common set of capabilities: reading and writing files, executing commands, searching codebases, and accessing the web. This catalog documents proven implementations for each tool category, covering input schemas, permission requirements, and edge cases.

---

## File Tools

### FileReadTool

Read file contents with optional line range selection.

| Property | Value |
|----------|-------|
| Permission | Read-only (auto-approve) |
| Concurrency | Safe |
| Key inputs | `path`, `offset?`, `limit?` |

Design considerations:
- Support partial reads (line offset + limit) for large files
- Return line numbers in output for precise referencing
- Handle binary files gracefully (detect and skip or convert)
- Normalize paths and resolve symlinks
- Track reads in a `readFileState` map for read-before-write enforcement

### FileWriteTool

Create new files or overwrite existing ones.

| Property | Value |
|----------|-------|
| Permission | Ask (creates/overwrites files) |
| Concurrency | Not safe |
| Key inputs | `path`, `contents` |

Design considerations:
- Require read-before-write for existing files
- Create parent directories automatically
- Validate path is within allowed directories
- Show diff preview in approval dialog

### FileEditTool

Make targeted edits to existing files using find-and-replace.

| Property | Value |
|----------|-------|
| Permission | Ask (modifies files) |
| Concurrency | Not safe |
| Key inputs | `path`, `old_string`, `new_string` |

Design considerations:
- Require `old_string` to uniquely match in the file (fail if ambiguous)
- Preserve indentation and line endings
- Support a `replace_all` flag for bulk replacements
- More surgical than FileWrite — doesn't require rewriting the whole file

---

## Shell Execution Tools

### BashTool

Execute shell commands and capture output.

| Property | Value |
|----------|-------|
| Permission | Ask-always (commands can be destructive) |
| Concurrency | Depends on command |
| Key inputs | `command`, `working_directory?`, `timeout?` |

Design considerations:
- Set timeouts to prevent hanging commands
- Capture both stdout and stderr
- Support background execution for long-running processes (dev servers, watchers)
- Maintain shell state (cwd, env vars) across sequential calls
- Sandbox: restrict filesystem access, network access, resource usage
- Parse commands for known-dangerous patterns (rm -rf, force push, etc.)

---

## Search Tools

### GlobTool

Find files by name pattern.

| Property | Value |
|----------|-------|
| Permission | Read-only (auto-approve) |
| Concurrency | Safe |
| Key inputs | `pattern`, `directory?` |

### GrepTool

Search file contents with regex.

| Property | Value |
|----------|-------|
| Permission | Read-only (auto-approve) |
| Concurrency | Safe |
| Key inputs | `pattern`, `path?`, `include?`, `context_lines?` |

Design considerations for both:
- Respect `.gitignore` patterns by default
- Limit result count to prevent overwhelming context
- Return enough surrounding context for results to be useful
- Support file type filtering

---

## Web Tools

### WebFetchTool

Fetch a URL and return its contents as readable text.

| Property | Value |
|----------|-------|
| Permission | Ask or allowlisted domains |
| Concurrency | Safe |
| Key inputs | `url` |

Design considerations:
- Convert HTML to markdown for readability
- Strip navigation, ads, scripts — extract main content
- Set reasonable size limits on response
- Handle redirects, timeouts, and error pages gracefully
- Domain allowlisting for automatic approval

### WebSearchTool

Search the web for information.

| Property | Value |
|----------|-------|
| Permission | Ask or auto-approve |
| Concurrency | Safe |
| Key inputs | `query` |

---

## Notebook and Specialized Tools

### NotebookEditTool
Edit Jupyter notebook cells. Handle the JSON structure internally, present cell contents to the agent.

### LSPTool
Interface with Language Server Protocol for type checking, go-to-definition, diagnostics.

### REPLTool
Execute code in an interactive REPL session (Python, Node, etc.) with state persistence across calls.

---

## Extensible Tool Patterns

### SkillTool
User-defined macro commands that combine multiple tool calls into a single reusable action.

### MCPTool
Dynamically registered tools from external MCP servers. The agent discovers available tools at runtime.

### ToolSearchTool
Meta-tool that searches the available tool catalog for relevant capabilities. Useful when the agent has many tools and needs to find the right one.

---

## Case Study: Claude Code (53+ Tools)

Community analysis of the Claude Code source revealed 53+ tools organized into 8 categories. Many experimental tools are feature-flagged and not yet shipped.

### Full Tool Inventory

**File Operations (6):** FileRead, FileEdit, FileWrite, Glob, Grep, NotebookEdit

**Execution (3):** Bash, PowerShell (Windows), REPL (VM-based interactive execution)

**Search & Fetch (4):** WebBrowser (experimental, full browser automation), WebFetch (HTML→markdown), WebSearch, ToolSearch (meta-tool searching the tool catalog)

**Agents & Tasks (11):** Agent (sub-agent spawning), SendMessage (mailbox/UDS communication), TaskCreate/Get/List/Update (full task CRUD), TaskStop/TaskOutput (background agent management), TeamCreate/TeamDelete, ListPeers (UDS session discovery)

**Planning (5):** EnterPlanMode, ExitPlanMode, EnterWorktree (git worktree isolation), ExitWorktree, VerifyPlanExecution (plan completion check)

**MCP (4):** MCPTool (dynamic tool execution), ListMcpResources, ReadMcpResource, McpAuth (OAuth handling)

**System (11):** AskUserQuestion, TodoWrite, Skill (user macros), Config, RemoteTrigger, CronCreate/Delete/List (scheduled tasks), Snip (conversation trimming), Workflow (bundled scripts), TerminalCapture

**Experimental (8):** Sleep (idle wait for events), SendUserMessage (Brief), StructuredOutput (JSON schema enforcement), LSP (language server integration), SendUserFile, PushNotification, Monitor (local shell task tracking), SubscribePR (GitHub webhook)

### Streaming Tool Execution

Claude Code's `StreamingToolExecutor` manages concurrent execution as tools stream in:

- Each tool declares `isConcurrencySafe` — safe tools (Read, Grep, Glob) run in parallel
- Non-safe tools (Edit, Write, Bash) run sequentially with exclusive access
- If a Bash command errors, a `siblingAbortController` cancels all parallel siblings immediately
- Results are buffered and yielded in arrival order to maintain message sequence
- On user interrupt (Esc), pending tools receive synthetic REJECT_MESSAGE results

### Tool Assembly Pipeline

The registry assembles tools through a pipeline:
1. `getAllBaseTools()` — complete list with feature-flag filtering
2. `getTools(permissionContext)` — apply deny rules, REPL mode filtering
3. `assembleToolPool(permissionContext, mcpTools)` — merge built-in + MCP, deduplicate, sort for cache stability
4. Tool search deferred loading — when tool count exceeds threshold, some tools are lazy-loaded via `ToolSearchTool`

### REPL Mode

When enabled, primitive tools (Bash, FileRead, FileEdit, etc.) are hidden from direct use and only accessible through the REPL VM context. This provides a sandboxed execution environment.

---

## Key Decisions & Trade-offs

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|----------------|
| File edit approach | Full file rewrite | Find-and-replace | Find-and-replace — less error-prone for targeted changes |
| Shell state | Stateless per call | Stateful across calls | Stateful — matches human expectations |
| Search result limits | Hard cap | Dynamic based on context budget | Dynamic — adapts to available space |
| Web content processing | Raw HTML | Markdown conversion | Markdown — much more useful for LLMs |

---

## Tags

#tool-catalog #file-tools #shell #search #web #file-read #file-write #file-edit #bash #glob #grep #web-fetch #web-search #notebook #mcp-tool #skill-tool
