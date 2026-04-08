# Agent Orchestration Guide — Index

> Keyword → file/section lookup for agents and humans.
> Grep this file to find where any concept is documented.

---

## Guide Files

| # | File | Tags | What's Inside |
|---|------|------|---------------|
| 00 | [guides/00_foundations.md](guides/00_foundations.md) | `#foundations` `#mental-models` `#taxonomy` | What agents are, agent taxonomy, the universal agent loop, key abstractions |
| 01 | [guides/01_agent_loop.md](guides/01_agent_loop.md) | `#agent-loop` `#query-engine` `#execution-cycle` | The query-execute-observe cycle, streaming, stop conditions, turn management |
| 02 | [guides/02_tool_system.md](guides/02_tool_system.md) | `#tool-design` `#tool-registry` `#schemas` `#tool-execution` `#hooks` | Tool abstraction, input schemas, registry patterns, execution pipeline, result handling, hook/lifecycle system |
| 03 | [guides/03_multi_agent.md](guides/03_multi_agent.md) | `#multi-agent` `#orchestration` `#sub-agents` `#delegation` `#coordination` `#cache-sharing` | Sub-agent spawning, orchestration topologies, cache-aware spawning, coordinator mode, swarm, team systems |
| 04 | [guides/04_context_memory.md](guides/04_context_memory.md) | `#context-window` `#memory` `#compaction` `#token-budget` `#cache-aware` | Context window management, token budgets, compaction strategies, cache-aware prompt splitting, long-term memory, memory consolidation |
| 05 | [guides/05_permissions_safety.md](guides/05_permissions_safety.md) | `#permissions` `#safety` `#sandboxing` `#trust` `#permission-race` | Permission tiers, permission race pattern (resolveOnce), rule-based access control, sandboxing, trust boundaries, deny rules |
| 06 | [guides/06_human_in_loop.md](guides/06_human_in_loop.md) | `#human-in-loop` `#approval` `#feedback` `#interactive` | Approval flows, permission dialogs, ask-once/ask-always, user feedback integration |
| 07 | [guides/07_planning_reasoning.md](guides/07_planning_reasoning.md) | `#planning` `#reasoning` `#task-decomposition` `#todos` | Plan mode, task management, todo systems, mode switching, structured reasoning |
| 08 | [guides/08_tool_catalog.md](guides/08_tool_catalog.md) | `#tool-catalog` `#file-tools` `#shell` `#search` `#web` | File read/write/edit, shell execution, glob/grep, web fetch/search, notebooks, code execution |
| 09 | [guides/09_protocols.md](guides/09_protocols.md) | `#protocols` `#mcp` `#bridge` `#transport` `#ide-integration` | Model Context Protocol, bridge protocols, WebSocket/SSE transports, IDE integration, remote sessions |
| 10 | [guides/10_state_lifecycle.md](guides/10_state_lifecycle.md) | `#state` `#lifecycle` `#config` `#bootstrap` `#settings` `#persistence` | Session state, bootstrap sequence (fast-path, parallel prefetch), configuration layers, settings hierarchy, migrations, persistence & resumability |
| 11 | [guides/11_patterns_antipatterns.md](guides/11_patterns_antipatterns.md) | `#patterns` `#anti-patterns` `#best-practices` `#pitfalls` `#architecture` | Proven patterns, common mistakes, 11 architecture patterns for AI-native products, scaling considerations |

---

## Keyword Lookup

### Agent Core

| Keyword | Guide | Section |
|---------|-------|---------|
| 11-step loop | 01 | §Case Study: Claude Code |
| agent loop | 01 | §The Query-Execute-Observe Cycle |
| agent taxonomy | 00 | §Agent Taxonomy |
| agentic system | 00 | §What Is an Agent? |
| async generator | 01 | §Case Study: Claude Code |
| autonomy levels | 00 | §Autonomy Spectrum |
| bootstrap | 10 | §Bootstrap Sequence |
| core loop | 01 | §The Universal Agent Loop |
| entry point | 01 | §Entry Points and Initialization |
| error recovery | 01 | §Case Study: Claude Code |
| execution cycle | 01 | §The Query-Execute-Observe Cycle |
| max output tokens recovery | 01 | §Case Study: Claude Code |
| message normalization | 01 | §Case Study: Claude Code |
| model fallback | 01 | §Case Study: Claude Code |
| query engine | 01 | §Building a Query Engine |
| REPL | 01 | §Interactive vs Headless Modes |
| stop conditions | 01 | §Stop Conditions and Turn Boundaries |
| streaming | 01 | §Streaming Response Handling |
| tool result pairing | 01 | §Case Study: Claude Code |
| turn management | 01 | §Turn Management |

### Tools

| Keyword | Guide | Section |
|---------|-------|---------|
| bash / shell tool | 08 | §Shell Execution Tools |
| buildTool | 02 | §The buildTool Pattern |
| code execution | 08 | §Code Execution Tools |
| concurrency safety | 02 | §Concurrency and Safety Flags |
| hook system / lifecycle hooks | 02 | §Hook and Lifecycle System |
| PreToolUse / PostToolUse | 02 | §Hook and Lifecycle System |
| file edit | 08 | §File Tools |
| file read | 08 | §File Tools |
| file write | 08 | §File Tools |
| glob | 08 | §Search Tools |
| grep | 08 | §Search Tools |
| input schema | 02 | §Input Schemas and Validation |
| MCP tool | 09 | §Dynamic Tool Registration via MCP |
| notebook tool | 08 | §Notebook and Specialized Tools |
| REPL tool | 08 | §Case Study: Claude Code |
| search tools | 08 | §Search Tools |
| sibling abort | 08 | §Case Study: Claude Code |
| skill tool | 08 | §Extensible Tool Patterns |
| streaming tool executor | 08 | §Case Study: Claude Code |
| tool assembly pipeline | 08 | §Case Study: Claude Code |
| tool catalog | 08 | §(entire file) |
| tool deferred loading | 08 | §Case Study: Claude Code |
| tool definition | 02 | §The Tool Abstraction |
| tool execution | 02 | §Tool Execution Pipeline |
| tool framework | 02 | §(entire file) |
| tool permission | 02 | §Tool-Level Permissions |
| tool presets | 02 | §Tool Presets and Filtering |
| tool registry | 02 | §The Tool Registry |
| tool result | 02 | §Result Handling and Output Mapping |
| tool result budget | 08 | §Case Study: Claude Code |
| tool search | 02 | §Tool Discovery |
| tool validation | 02 | §Input Schemas and Validation |
| web browser tool | 08 | §Case Study: Claude Code |
| web fetch | 08 | §Web Tools |
| web search | 08 | §Web Tools |

### Multi-Agent

| Keyword | Guide | Section |
|---------|-------|---------|
| agent delegation | 03 | §Delegation Strategies |
| agent definitions | 03 | §Case Study: Claude Code |
| agent spawning | 03 | §Spawning Sub-Agents |
| background agents | 03 | §Background and Async Agents |
| built-in agents | 03 | §Case Study: Claude Code |
| cache-aware spawning | 03 | §Cache-Aware Sub-Agent Spawning |
| file-based communication | 03 | §Cache-Aware Sub-Agent Spawning |
| coordinator mode | 03 | §Case Study: Claude Code |
| daemon mode | 03 | §Case Study: Claude Code |
| explore agent | 03 | §Case Study: Claude Code |
| fan-out / fan-in | 03 | §Orchestration Topologies |
| message routing | 03 | §Case Study: Claude Code |
| multi-agent | 03 | §(entire file) |
| orchestration | 03 | §Orchestration Topologies |
| parallel agents | 03 | §Parallel Execution |
| plan agent | 03 | §Case Study: Claude Code |
| sub-agent | 03 | §Spawning Sub-Agents |
| swarm mode | 03 | §Swarm Pattern |
| task management | 03 | §Task-Based Orchestration |
| team system | 03 | §Team-Based Collaboration |
| teammate mailbox | 03 | §Case Study: Claude Code |
| UDS inbox | 03 | §Case Study: Claude Code |
| worker pool | 03 | §Swarm Pattern |
| worktree | 03 | §Case Study: Claude Code |

### Context & Memory

| Keyword | Guide | Section |
|---------|-------|---------|
| auto-compact | 04 | §Automatic Compaction |
| auto-dream | 04 | §Case Study: Claude Code |
| cache-aware prompt splitting | 04 | §Cache-Aware Prompt Splitting |
| CLAUDE.md | 04 | §Case Study: Claude Code |
| compaction | 04 | §Compaction Strategies |
| compaction pipeline | 04 | §Case Study: Claude Code |
| context collapse | 04 | §Case Study: Claude Code |
| context injection | 04 | §Context Assembly |
| context window | 04 | §Context Window Fundamentals |
| conversation history | 04 | §Conversation History Management |
| long-term memory | 04 | §Long-Term Memory Systems |
| memdir | 04 | §Case Study: Claude Code |
| memory consolidation | 04 | §Memory Consolidation |
| memory directory | 04 | §File-Based Memory |
| memory relevance prefetch | 04 | §Case Study: Claude Code |
| micro-compact | 04 | §Micro-Compaction |
| reactive compact | 04 | §Case Study: Claude Code |
| session memory | 04 | §Session Memory |
| snip compaction | 04 | §Case Study: Claude Code |
| system prompt assembly | 04 | §Case Study: Claude Code |
| system-reminder tags | 04 | §Case Study: Claude Code |
| system prompt | 04 | §Context Assembly |
| token budget | 04 | §Token Budget Tracking |
| token estimation | 04 | §Token Counting and Estimation |
| tool result budget | 04 | §Case Study: Claude Code |

### Permissions & Safety

| Keyword | Guide | Section |
|---------|-------|---------|
| access control | 05 | §Rule-Based Access Control |
| allow / deny rules | 05 | §Permission Rules |
| auto-approve | 05 | §Automatic Approval |
| auto-mode classifier | 05, 07 | §Case Study: Claude Code |
| permission race / resolveOnce | 05 | §The Permission Race Pattern |
| dangerous operations | 05 | §Destructive Operation Handling |
| denial workaround | 05 | §Case Study: Claude Code |
| deny rules | 05 | §Permission Rules |
| don't-ask mode | 05 | §Case Study: Claude Code |
| permission dialog | 06 | §Permission Dialogs |
| permission mode | 05 | §Permission Modes |
| permission tiers | 05 | §The Permission Tier Model |
| read-before-write | 05 | §Read-Before-Write Enforcement |
| sandboxing | 05 | §Sandboxing Strategies |
| trust boundary | 05 | §Trust Boundaries |
| trust dialog | 06 | §Initial Trust Establishment |
| yolo classifier | 05 | §Case Study: Claude Code |

### Human-in-the-Loop

| Keyword | Guide | Section |
|---------|-------|---------|
| approval flow | 06 | §Approval Flow Architecture |
| ask-always | 06 | §Ask-Always vs Ask-Once |
| ask-once | 06 | §Ask-Always vs Ask-Once |
| feedback loop | 06 | §Feedback Integration |
| interactive mode | 06 | §Interactive Patterns |
| user confirmation | 06 | §Approval Flow Architecture |

### Planning & Reasoning

| Keyword | Guide | Section |
|---------|-------|---------|
| auto mode | 07 | §Case Study: Claude Code |
| explore agent | 07 | §Case Study: Claude Code |
| interview workflow | 07 | §Case Study: Claude Code |
| mode switching | 07 | §Mode Switching |
| plan agent | 07 | §Case Study: Claude Code |
| plan brevity | 07 | §Case Study: Claude Code |
| plan mode | 07 | §Plan Mode Architecture |
| plan mode V2 | 07 | §Case Study: Claude Code |
| plan re-entry | 07 | §Case Study: Claude Code |
| task creation | 07 | §Task Management Systems |
| task decomposition | 07 | §Task Decomposition |
| todo reminder | 07 | §Case Study: Claude Code |
| todo system | 07 | §Todo and Task Tracking |
| UltraPlan | 07 | §Case Study: Claude Code |
| structured output | 07 | §Structured Reasoning |
| verify plan execution | 07 | §Case Study: Claude Code |

### Protocols & Integration

| Keyword | Guide | Section |
|---------|-------|---------|
| bridge protocol | 09 | §Bridge Protocol Architecture |
| bridge V1 / V2 | 09 | §Case Study: Claude Code |
| direct connect | 09 | §IDE Integration |
| HTTP transport | 09 | §Transport Layer Patterns |
| IDE integration | 09 | §IDE Integration |
| MCP (Model Context Protocol) | 09 | §Model Context Protocol |
| MCP auth / OAuth | 09 | §Case Study: Claude Code |
| MCP resources | 09 | §MCP Resources |
| MCP server | 09 | §Running as an MCP Server |
| remote session | 09 | §Remote Sessions |
| SSE transport | 09 | §Transport Layer Patterns |
| UDS inbox | 09 | §Case Study: Claude Code |
| WebSocket transport | 09 | §Transport Layer Patterns |

### State & Configuration

| Keyword | Guide | Section |
|---------|-------|---------|
| bootstrap state | 10 | §Bootstrap Sequence |
| config layers | 10 | §Configuration Hierarchy |
| fast-path boot | 10 | §Fast-Path Optimization |
| global state | 10 | §Session State Singleton |
| memoized initialization | 10 | §Fast-Path Optimization |
| migration | 10 | §Settings Migrations |
| parallel prefetching | 10 | §Fast-Path Optimization |
| persistence / resumability | 10 | §Persistence and Resumability |
| session lifecycle | 10 | §Session Lifecycle |
| session resume / fork / replay | 10 | §Persistence and Resumability |
| session state | 10 | §Session State Singleton |
| settings hierarchy | 10 | §Configuration Hierarchy |

### Patterns

| Keyword | Guide | Section |
|---------|-------|---------|
| A/B testing | 11, Case Study | §Feature Flags |
| anti-patterns | 11 | §Anti-Patterns |
| architecture patterns for AI products | 11 | §Architecture Patterns for AI-Native Products |
| best practices | 11 | §(entire file) |
| cache-aware architecture | 11 | §Architecture Patterns (7, 8) |
| decoupled rendering | 01, 11 | §Decouple Rendering, §Architecture Patterns (2) |
| error handling | 11 | §Error Handling Patterns |
| feature flags | 11, Case Study | §Key Takeaways |
| graceful degradation | 11 | §Resilience Patterns |
| hooks as platform pattern | 11 | §Architecture Patterns (9) |
| idempotency | 11 | §Tool Idempotency |
| parallel reads / serial writes | 11 | §Architecture Patterns (4) |
| prompt engineering | 11 | §System Prompt Design |
| rate limiting | 11 | §Rate Limiting and Backoff |
| retry logic | 11 | §Resilience Patterns |
| scaling | 11 | §Scaling Considerations |
| tiered context compression | 11 | §Architecture Patterns (6) |

### Hidden / Experimental Features (Case Study)

| Keyword | Location |
|---------|----------|
| auto-dream | Case Study §Hidden Features, Guide 04 §Case Study |
| bridge (remote control) | Case Study §Hidden Features, Guide 09 §Case Study |
| buddy (companion) | Case Study §Hidden Features |
| coordinator mode | Case Study §Hidden Features, Guide 03 §Case Study |
| daemon mode | Case Study §Hidden Features, Guide 03 §Case Study |
| Kairos (persistent mode) | Case Study §Hidden Features |
| UDS inbox | Case Study §Hidden Features, Guide 03 §Case Study |
| UltraPlan | Case Study §Hidden Features, Guide 07 §Case Study |

---

## Code Templates

| Template | Language | Path |
|----------|----------|------|
| Agent Loop | TypeScript | [templates/typescript/agent-loop.ts](templates/typescript/agent-loop.ts) |
| Agent Loop | Python | [templates/python/agent_loop.py](templates/python/agent_loop.py) |
| Tool Registry | TypeScript | [templates/typescript/tool-registry.ts](templates/typescript/tool-registry.ts) |
| Tool Registry | Python | [templates/python/tool_registry.py](templates/python/tool_registry.py) |
| Sub-Agent | TypeScript | [templates/typescript/sub-agent.ts](templates/typescript/sub-agent.ts) |
| Sub-Agent | Python | [templates/python/sub_agent.py](templates/python/sub_agent.py) |
| Context Manager | TypeScript | [templates/typescript/context-manager.ts](templates/typescript/context-manager.ts) |
| Context Manager | Python | [templates/python/context_manager.py](templates/python/context_manager.py) |
| Permission System | TypeScript | [templates/typescript/permission-system.ts](templates/typescript/permission-system.ts) |
| Permission System | Python | [templates/python/permission_system.py](templates/python/permission_system.py) |

---

## Case Studies

| System | Path | Key Patterns |
|--------|------|-------------|
| Claude Code | [case-studies/claude-code/](case-studies/claude-code/README.md) | 11-step agent loop, 53+ tools, streaming executor, multi-agent (coordinator/daemon/UDS), 5-stage compaction, auto-mode classifier, plan mode V2 |

---

*This index is kept in sync with guide content. When adding new guides, update this file.*
