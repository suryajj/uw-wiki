# Agent Orchestration Guide — Skill Entry Point

## When to Use

Reference this guide whenever you are:
- Building an agent system or tool-use framework
- Implementing multi-agent orchestration or sub-agent delegation
- Designing a tool registry, permission model, or context management strategy
- Adding planning/reasoning modes, human-in-the-loop approval, or memory systems
- Working with MCP (Model Context Protocol) or bridge/transport protocols

## How to Use

1. **Start with the decision tree** — read `DECISION_TREE.md` to find the right guide for what you're building
2. **Use the index for specific lookups** — grep `INDEX.md` for keywords to find exact sections
3. **Read the relevant guide** — each guide in `guides/` is self-contained with universal patterns, case studies, and code templates
4. **Use templates as starting points** — grab starter code from `templates/typescript/` or `templates/python/`

## Quick Reference

| Building... | Read |
|---|---|
| An agent from scratch | `guides/00_foundations.md` then `guides/01_agent_loop.md` |
| A tool system | `guides/02_tool_system.md` |
| Multi-agent orchestration | `guides/03_multi_agent.md` |
| Context/memory management | `guides/04_context_memory.md` |
| Permission/safety layer | `guides/05_permissions_safety.md` |
| User approval flows | `guides/06_human_in_loop.md` |
| Planning/task decomposition | `guides/07_planning_reasoning.md` |
| Specific tool implementations | `guides/08_tool_catalog.md` |
| Protocol integrations (MCP, etc.) | `guides/09_protocols.md` |
| Session state management | `guides/10_state_lifecycle.md` |
| General best practices | `guides/11_patterns_antipatterns.md` |

## File Layout

```
INDEX.md                    # Keyword → file/section lookup
DECISION_TREE.md            # "What are you building?" router
guides/                     # Core knowledge (self-contained chapters)
templates/typescript/       # TypeScript starter code
templates/python/           # Python starter code
case-studies/claude-code/   # Real-world architecture analysis
```

## Tags

Search across guides using semantic tags in frontmatter or inline:

```bash
grep -r "tags:.*orchestration" guides/
grep -r "#tool-design" guides/
```
