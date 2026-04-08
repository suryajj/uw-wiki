"""
Sub-Agent — Python Template

Implements the AgentTool pattern: a tool that spawns an independent agent
instance with its own context, tools, and constraints.

Install: pip install anthropic
"""

from __future__ import annotations

import asyncio
import anthropic
from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable


# --- Types ---


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    execute: Callable[[dict[str, Any]], Awaitable[str]]


@dataclass
class AgentDefinition:
    name: str
    system_prompt: str
    tools: list[Tool]
    model: str = "claude-sonnet-4-6-20260320"
    max_turns: int = 10


@dataclass
class SubAgentResult:
    agent_name: str
    response: str
    tool_calls: int
    input_tokens: int
    output_tokens: int


# --- Sub-Agent Runner ---


async def run_sub_agent(
    definition: AgentDefinition, task: str
) -> SubAgentResult:
    client = anthropic.Anthropic()
    history: list[dict[str, Any]] = [{"role": "user", "content": task}]

    turn_count = 0
    total_tool_calls = 0
    total_input = 0
    total_output = 0
    last_text = ""

    while turn_count < definition.max_turns:
        turn_count += 1

        response = client.messages.create(
            model=definition.model,
            max_tokens=4096,
            system=definition.system_prompt,
            tools=[
                {
                    "name": t.name,
                    "description": t.description,
                    "input_schema": t.input_schema,
                }
                for t in definition.tools
            ],
            messages=history,
        )

        total_input += response.usage.input_tokens
        total_output += response.usage.output_tokens
        history.append({"role": "assistant", "content": response.content})

        tool_uses = [b for b in response.content if b.type == "tool_use"]
        for b in response.content:
            if b.type == "text":
                last_text = b.text

        if not tool_uses:
            break

        results = []
        for tu in tool_uses:
            total_tool_calls += 1
            tool = next(
                (t for t in definition.tools if t.name == tu.name), None
            )
            if tool is None:
                results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tu.id,
                        "content": f"Unknown tool: {tu.name}",
                        "is_error": True,
                    }
                )
                continue
            try:
                out = await tool.execute(tu.input)
                results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tu.id,
                        "content": out,
                    }
                )
            except Exception as e:
                results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tu.id,
                        "content": f"Error: {e}",
                        "is_error": True,
                    }
                )

        history.append({"role": "user", "content": results})

    return SubAgentResult(
        agent_name=definition.name,
        response=last_text,
        tool_calls=total_tool_calls,
        input_tokens=total_input,
        output_tokens=total_output,
    )


# --- Agent Tool (for parent agent to call) ---


def create_agent_tool(
    agents: dict[str, AgentDefinition],
) -> Tool:
    async def execute(input: dict[str, Any]) -> str:
        agent_type = input.get("agentType", "general")
        definition = agents.get(agent_type)
        if definition is None:
            available = ", ".join(agents.keys())
            raise ValueError(
                f'Unknown agent type: "{agent_type}". Available: {available}'
            )
        result = await run_sub_agent(definition, input["task"])
        return (
            f'[Sub-agent "{result.agent_name}" completed: '
            f"{result.tool_calls} tool calls]\n\n{result.response}"
        )

    return Tool(
        name="Agent",
        description=(
            "Spawn a sub-agent to handle a specific task. "
            "Use for tasks that benefit from focused context or parallel execution."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "task": {
                    "type": "string",
                    "description": "The task to delegate",
                },
                "agentType": {
                    "type": "string",
                    "description": "Which agent definition to use",
                },
            },
            "required": ["task"],
        },
        execute=execute,
    )


# --- Fan-Out / Fan-In Pattern ---


async def fan_out_fan_in(
    tasks: list[tuple[AgentDefinition, str]],
) -> list[SubAgentResult]:
    return await asyncio.gather(
        *[run_sub_agent(defn, task) for defn, task in tasks]
    )


# --- Example Usage ---


async def main():
    async def read_file(input: dict[str, Any]) -> str:
        with open(input["path"], "r") as f:
            return f.read()

    read_tool = Tool(
        name="read_file",
        description="Read file contents",
        input_schema={
            "type": "object",
            "properties": {"path": {"type": "string"}},
            "required": ["path"],
        },
        execute=read_file,
    )

    agents = {
        "researcher": AgentDefinition(
            name="researcher",
            system_prompt="You research codebases. Read files and report findings.",
            tools=[read_tool],
            max_turns=5,
        ),
        "general": AgentDefinition(
            name="general",
            system_prompt="You are a general-purpose coding assistant.",
            tools=[read_tool],
            max_turns=5,
        ),
    }

    agent_tool = create_agent_tool(agents)

    result = await agent_tool.execute(
        {
            "task": "Read package.json and summarize the dependencies",
            "agentType": "researcher",
        }
    )
    print(result)


if __name__ == "__main__":
    asyncio.run(main())
