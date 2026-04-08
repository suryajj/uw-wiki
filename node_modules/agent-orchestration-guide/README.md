# Agent Orchestration Guide

A comprehensive knowledge base for building AI agent orchestration systems. Contains universal patterns, real-world case studies, and code templates in TypeScript and Python — designed to be read by both humans and AI coding agents as foundational guidance.

## What This Is

This is a **knowledge package**, not a code library. It contains structured markdown guides, code templates, and case studies that teach you (or your AI coding agent) how to build robust agent orchestration systems from scratch.

The patterns are extracted from production agent architectures and distilled into reusable, framework-agnostic building blocks.

## Install

### Option A: npm

```bash
npm install agent-orchestration-guide
```

Then reference guides from `node_modules/agent-orchestration-guide/guides/`.

### Option B: Skills / Rules Folder

Copy the contents into your agent's reference directory:

```bash
# For Cursor
cp -r ./guides .cursor/skills/agent-orchestration-guide/

# Or clone directly
git clone <repo-url> .cursor/skills/agent-orchestration-guide
```

### Option C: Direct Reference

Clone or download the repo and point your agent at the `guides/` directory.

## Guide Structure

| Guide | Topic | Complexity |
|-------|-------|------------|
| [00 Foundations](guides/00_foundations.md) | Agent mental models, taxonomy, core loop concept | Foundational |
| [01 Agent Loop](guides/01_agent_loop.md) | The query-execute-observe cycle | Foundational |
| [02 Tool System](guides/02_tool_system.md) | Tool design, schemas, registry, execution | Foundational |
| [03 Multi-Agent](guides/03_multi_agent.md) | Sub-agents, orchestration, delegation, coordination | Intermediate |
| [04 Context & Memory](guides/04_context_memory.md) | Context window management, compaction, long-term memory | Intermediate |
| [05 Permissions & Safety](guides/05_permissions_safety.md) | Permission models, sandboxing, trust boundaries | Intermediate |
| [06 Human-in-the-Loop](guides/06_human_in_loop.md) | Approval flows, feedback, interactive patterns | Intermediate |
| [07 Planning & Reasoning](guides/07_planning_reasoning.md) | Plan mode, task decomposition, todo systems | Intermediate |
| [08 Tool Catalog](guides/08_tool_catalog.md) | Common tools: file I/O, shell, search, web, code execution | Intermediate |
| [09 Protocols](guides/09_protocols.md) | MCP, bridge protocols, transport layers, IDE integration | Advanced |
| [10 State & Lifecycle](guides/10_state_lifecycle.md) | Session state, config, bootstrap, settings layers | Advanced |
| [11 Patterns & Anti-patterns](guides/11_patterns_antipatterns.md) | Proven patterns and common pitfalls | Advanced |

## Finding What You Need

- **[INDEX.md](INDEX.md)** — Keyword lookup table mapping concepts to files and sections
- **[DECISION_TREE.md](DECISION_TREE.md)** — "What are you building?" routing guide
- **Semantic tags** — Every guide has YAML frontmatter tags and inline `#tags` for grep-based discovery

## Code Templates

Starter implementations for core patterns in both TypeScript and Python:

```
templates/
├── typescript/
│   ├── agent-loop.ts
│   ├── tool-registry.ts
│   ├── sub-agent.ts
│   ├── context-manager.ts
│   └── permission-system.ts
└── python/
    ├── agent_loop.py
    ├── tool_registry.py
    ├── sub_agent.py
    ├── context_manager.py
    └── permission_system.py
```

## Case Studies

Real-world agent architectures analyzed and mapped to the universal patterns:

- **[Claude Code](case-studies/claude-code/README.md)** — Terminal-based agentic coding assistant with 40+ tools, multi-agent orchestration, and 200K context management

## Contributing

To add a new technique:

1. Create `guides/XX_topic.md` following the guide template (see any existing guide for structure)
2. Add entries to `INDEX.md` and `DECISION_TREE.md`
3. Optionally add code templates to `templates/`
4. Submit a PR

## License

MIT
