"""
Agent Loop — Python Template

A minimal but production-ready implementation of the query-execute-observe
agent loop. Uses the Anthropic Claude API.

Install: pip install anthropic
"""

from __future__ import annotations

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
class AgentConfig:
    model: str
    system_prompt: str
    tools: list[Tool]
    max_turns: int = 10
    max_budget_usd: float | None = None


@dataclass
class TurnResult:
    response: str
    tool_calls: int
    input_tokens: int
    output_tokens: int


# --- Agent Loop ---


class AgentLoop:
    def __init__(self, config: AgentConfig):
        self.client = anthropic.Anthropic()
        self.config = config
        self.history: list[dict[str, Any]] = []
        self.total_input_tokens = 0
        self.total_output_tokens = 0

    async def run(self, user_input: str) -> TurnResult:
        self.history.append({"role": "user", "content": user_input})

        turn_count = 0
        total_tool_calls = 0
        last_text_response = ""

        while turn_count < self.config.max_turns:
            turn_count += 1

            response = self.client.messages.create(
                model=self.config.model,
                max_tokens=4096,
                system=self.config.system_prompt,
                tools=[
                    {
                        "name": t.name,
                        "description": t.description,
                        "input_schema": t.input_schema,
                    }
                    for t in self.config.tools
                ],
                messages=self.history,
            )

            self.total_input_tokens += response.usage.input_tokens
            self.total_output_tokens += response.usage.output_tokens

            self.history.append(
                {"role": "assistant", "content": response.content}
            )

            tool_use_blocks = [
                b for b in response.content if b.type == "tool_use"
            ]
            for block in response.content:
                if block.type == "text":
                    last_text_response = block.text

            if not tool_use_blocks:
                break

            tool_results = []
            for tool_use in tool_use_blocks:
                total_tool_calls += 1
                tool = next(
                    (t for t in self.config.tools if t.name == tool_use.name),
                    None,
                )

                if tool is None:
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": tool_use.id,
                            "content": f'Error: Unknown tool "{tool_use.name}"',
                            "is_error": True,
                        }
                    )
                    continue

                try:
                    result = await tool.execute(tool_use.input)
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": tool_use.id,
                            "content": result,
                        }
                    )
                except Exception as e:
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": tool_use.id,
                            "content": f"Error: {e}",
                            "is_error": True,
                        }
                    )

            self.history.append({"role": "user", "content": tool_results})

            if response.stop_reason == "end_turn":
                break

        return TurnResult(
            response=last_text_response,
            tool_calls=total_tool_calls,
            input_tokens=self.total_input_tokens,
            output_tokens=self.total_output_tokens,
        )

    @property
    def cost_estimate_usd(self) -> float:
        input_cost_per_1m = 3.0
        output_cost_per_1m = 15.0
        return (
            (self.total_input_tokens / 1_000_000) * input_cost_per_1m
            + (self.total_output_tokens / 1_000_000) * output_cost_per_1m
        )


# --- Example Usage ---


async def main():
    async def read_file(input: dict[str, Any]) -> str:
        path = input["path"]
        with open(path, "r") as f:
            return f.read()

    read_file_tool = Tool(
        name="read_file",
        description="Read the contents of a file at the specified path",
        input_schema={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Path to the file"}
            },
            "required": ["path"],
        },
        execute=read_file,
    )

    agent = AgentLoop(
        AgentConfig(
            model="claude-sonnet-4-6-20260320",
            system_prompt="You are a helpful coding assistant. Use tools to help the user.",
            tools=[read_file_tool],
            max_turns=10,
        )
    )

    result = await agent.run("Read the README.md and summarize it")
    print(result.response)
    print(f"Cost: ${agent.cost_estimate_usd:.4f}")


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
