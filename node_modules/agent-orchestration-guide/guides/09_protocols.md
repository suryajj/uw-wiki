---
tags: [protocols, mcp, bridge, transport, ide-integration]
complexity: advanced
prerequisites: [00_foundations, 02_tool_system]
---

# Protocols & Integration

> How to integrate agents with external systems using MCP (Model Context Protocol), bridge protocols, transport layers, and IDE connections.

---

## Pattern (Universal)

Agents rarely operate in isolation. They need to integrate with IDEs, external tool servers, cloud services, and other agents. Protocol design determines how extensible and interoperable your agent system becomes. The key protocols are MCP (for tool/resource extension) and bridge protocols (for remote control and IDE integration).

---

## Model Context Protocol (MCP)

MCP is a standard for connecting AI agents to external tool and resource servers. It allows agents to discover and use tools provided by external services without hardcoding integrations.

### Core Concepts

| Concept | Description |
|---------|-------------|
| **MCP Server** | An external process that provides tools and/or resources |
| **MCP Client** | The agent-side connection to an MCP server |
| **Tools** | Functions the agent can call via the MCP server |
| **Resources** | Read-only data the agent can fetch from the MCP server |
| **Elicitation** | MCP server requesting additional input from the user |

### Integration Pattern

1. **Discovery**: On startup, connect to configured MCP servers and fetch their tool/resource manifests
2. **Registration**: Register MCP tools alongside built-in tools in the tool registry
3. **Deduplication**: If an MCP tool has the same name as a built-in tool, built-in wins
4. **Execution**: When the agent calls an MCP tool, proxy the request to the MCP server
5. **Auth**: Support OAuth/token-based authentication for MCP servers that require it

### Running as an MCP Server

Your agent can also expose itself as an MCP server, allowing other agents or tools to use its capabilities.

---

## Dynamic Tool Registration via MCP

MCP tools are discovered at runtime, not compiled into the agent. Handle this by:

1. Fetching tool manifests from all configured MCP servers on startup
2. Converting MCP tool schemas to your internal tool format
3. Adding them to the tool pool alongside built-in tools
4. Sorting the combined pool for prompt-cache stability
5. Refreshing when MCP server configurations change

---

## MCP Resources

Resources are read-only data provided by MCP servers. Unlike tools (which perform actions), resources provide context:

- Project documentation
- API schemas
- Configuration data
- Live system state

Agents can list available resources and fetch specific ones by URI.

---

## Bridge Protocol Architecture

A bridge protocol enables remote control of an agent session. This is used for IDE integration (VSCode/JetBrains connecting to a running agent) and cloud-hosted sessions.

### Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Client     │ ◄─────► │   Transport   │ ◄─────► │   Agent     │
│ (IDE/Web UI) │         │  (WS/SSE/HTTP)│         │  (CLI/SDK)  │
└─────────────┘         └──────────────┘         └─────────────┘
```

### Key Design Decisions

- **Bidirectional**: Both sides can initiate messages
- **Authenticated**: JWT or token-based auth for session security
- **Reconnectable**: Handle network interruptions gracefully
- **Multi-transport**: Support WebSocket, SSE, and HTTP fallbacks

---

## Transport Layer Patterns

### WebSocket Transport
Full-duplex, low-latency. Best for interactive sessions.

### SSE (Server-Sent Events) Transport
Unidirectional server-to-client stream with HTTP POST for client-to-server. Better firewall compatibility than WebSocket.

### Hybrid Transport
Start with SSE for reliability, upgrade to WebSocket when available. Fall back gracefully.

### Transport Selection Criteria

| Factor | WebSocket | SSE | HTTP Polling |
|--------|-----------|-----|-------------|
| Latency | Lowest | Low | High |
| Firewall compat | Moderate | Best | Best |
| Complexity | Moderate | Low | Lowest |
| Bidirectional | Native | Simulated | Simulated |

---

## IDE Integration

Connect your agent to IDEs for a richer development experience:

### Capabilities
- **Live diff viewing**: Show file changes in the IDE's diff viewer
- **File selection sync**: IDE selection syncs to agent context
- **Status indicators**: Show agent status in IDE UI
- **Inline approvals**: Permission dialogs in the IDE instead of terminal

### Implementation via Direct Connect

1. IDE extension launches a local server
2. Agent discovers the server via well-known port or config
3. Bidirectional communication via the bridge protocol
4. IDE extension renders agent state and handles user interactions

---

## Remote Sessions

Enable agents to run on remote machines while being controlled locally or via web UI:

### Session Lifecycle
1. **Create**: Initialize a remote session with auth credentials
2. **Connect**: Establish transport connection (WS/SSE)
3. **Control**: Send messages and receive responses
4. **Persist**: Session state survives reconnections
5. **Terminate**: Clean shutdown with state persistence

### Crash Recovery
Persist session pointers (connection info, session IDs) to enable reconnection after crashes. The bridge pointer pattern writes recovery data to a well-known file location.

---

## Case Study: Claude Code

Community analysis of the source revealed a rich protocol layer with multiple transport mechanisms.

### MCP Integration

Full MCP client with:
- **Dynamic tool discovery** — MCP tools are merged with built-in tools via `assembleToolPool()`, sorted for prompt cache stability (built-ins as contiguous prefix), and deduplicated by name (built-ins win conflicts)
- **Resource fetching** — `ListMcpResources` and `ReadMcpResource` tools, with attachment-based content injection
- **Elicitation** — URL-based auth dialogs triggered by MCP tool `-32042` errors
- **OAuth** — `McpAuth` tool handles MCP server authentication flows
- **Server instructions** — injected as `mcp_instructions_delta` attachments when servers connect/disconnect
- **Unavailable tool stripping** — `stripUnavailableToolReferencesFromUserMessage()` removes references to disconnected MCP servers from tool_result content, preventing API rejections

### Bridge Protocol (V1 + V2)

Two-variant remote control system:

| Feature | V1 | V2 |
|---------|----|----|
| Setup | Environment-based (`BRIDGE_*` env vars) | Direct session creation, env-less |
| Polling | `GET .../work/poll` | Push-based with `tengu_bridge_repl_v2` flag |
| Session creation | Via environment | Programmatic |
| Recovery | Bridge pointer file | Same + improved state sync |

Supports WebSocket, SSE, and hybrid transports with JWT authentication.

### UDS Inbox (Experimental)

Inter-process messaging via Unix Domain Sockets:
- One Claude Code instance messages another through UDS files
- Used by the Coordinator to dispatch work to parallel agents
- `ListPeers` tool discovers other running sessions
- `SendMessage` routes via UDS when the target session is co-located
- Works automatically when multiple sessions are running (`src/remote/`)

### IDE Integration

Direct-connect bridge for VS Code and JetBrains:
- Extensions connect via local server (`cc://` URLs)
- Live diff viewing, file selection sync, status indicators
- The `--ide` flag enables IDE-specific behavior
- `installGithubApp` and `installSlackApp` commands for deeper integration

### Daemon Mode Transport

Background sessions via tmux:
- `--bg` flag starts a daemon session
- Communication via tmux pane I/O
- `claude ps` lists sessions, `claude attach` reconnects
- Task notifications route to the parent session when complete

---

## Key Decisions & Trade-offs

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|----------------|
| Primary transport | WebSocket | SSE | Start with SSE for compatibility, add WS for performance |
| MCP tool priority | MCP wins | Built-in wins | Built-in wins — prevents MCP servers from overriding core behavior |
| Auth mechanism | JWT | API key | JWT for sessions, API key for server-to-server |
| Session persistence | In-memory | Persistent | Persistent — enables crash recovery |

---

## Tags

#protocols #mcp #bridge #transport #ide-integration #websocket #sse #remote-sessions #direct-connect #model-context-protocol #mcp-resources #mcp-tools #jwt-auth
