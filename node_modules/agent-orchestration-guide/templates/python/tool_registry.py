"""
Tool Registry — Python Template

A type-safe tool registry with schema validation, permission checking,
and the build_tool factory pattern.

Install: pip install pydantic
"""

from __future__ import annotations

import fnmatch
import json
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Awaitable, TypeVar, Generic
from pydantic import BaseModel, Field


# --- Core Types ---


class PermissionBehavior(Enum):
    ALLOW = "allow"
    ASK = "ask"
    DENY = "deny"


@dataclass
class PermissionDecision:
    behavior: PermissionBehavior
    message: str = ""


@dataclass
class ToolContext:
    permission_mode: str = "default"  # default | plan | auto | bypass
    allow_rules: list[str] = field(default_factory=list)
    deny_rules: list[str] = field(default_factory=list)
    read_file_state: dict[str, dict[str, Any]] = field(default_factory=dict)


@dataclass
class ToolResult:
    data: Any


# --- Tool Definition ---


@dataclass
class ToolDefinition:
    name: str
    description: str
    input_model: type[BaseModel]
    execute: Callable[[BaseModel, ToolContext], Awaitable[ToolResult]]
    is_read_only: Callable[[Any], bool] = lambda _: False
    is_concurrency_safe: Callable[[Any], bool] = lambda _: False
    is_destructive: Callable[[Any], bool] = lambda _: False
    check_permissions: (
        Callable[[Any, ToolContext], PermissionDecision] | None
    ) = None
    max_result_size: int = 30_000


# --- Tool (built) ---


class Tool:
    def __init__(self, definition: ToolDefinition):
        self._def = definition

    @property
    def name(self) -> str:
        return self._def.name

    @property
    def description(self) -> str:
        return self._def.description

    def is_read_only(self, input: Any = None) -> bool:
        return self._def.is_read_only(input)

    def is_concurrency_safe(self, input: Any = None) -> bool:
        return self._def.is_concurrency_safe(input)

    def is_destructive(self, input: Any = None) -> bool:
        return self._def.is_destructive(input)

    def validate_input(
        self, raw: dict[str, Any]
    ) -> tuple[bool, BaseModel | str]:
        try:
            parsed = self._def.input_model.model_validate(raw)
            return True, parsed
        except Exception as e:
            return False, str(e)

    def check_permissions(
        self, input: Any, ctx: ToolContext
    ) -> PermissionDecision:
        if self._def.check_permissions:
            return self._def.check_permissions(input, ctx)
        return PermissionDecision(behavior=PermissionBehavior.ALLOW)

    async def execute(
        self, input: BaseModel, ctx: ToolContext
    ) -> ToolResult:
        return await self._def.execute(input, ctx)

    def to_api_schema(self) -> dict[str, Any]:
        return {
            "name": self._def.name,
            "description": self._def.description,
            "input_schema": self._def.input_model.model_json_schema(),
        }


def build_tool(definition: ToolDefinition) -> Tool:
    return Tool(definition)


# --- Tool Registry ---


class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        self._tools[tool.name] = tool

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def get_all(self) -> list[Tool]:
        return list(self._tools.values())

    def get_filtered(self, ctx: ToolContext) -> list[Tool]:
        result = []
        for tool in self.get_all():
            if any(
                fnmatch.fnmatch(tool.name, rule)
                for rule in ctx.deny_rules
            ):
                continue
            if ctx.permission_mode == "plan" and not tool.is_read_only():
                continue
            result.append(tool)
        return result

    def get_api_schemas(self, ctx: ToolContext) -> list[dict[str, Any]]:
        tools = sorted(self.get_filtered(ctx), key=lambda t: t.name)
        return [t.to_api_schema() for t in tools]

    def search(self, query: str) -> list[Tool]:
        q = query.lower()
        return [
            t
            for t in self.get_all()
            if q in t.name.lower() or q in t.description.lower()
        ]


# --- Example Tools ---


class FileReadInput(BaseModel):
    path: str = Field(description="Absolute path to the file")
    offset: int | None = Field(
        default=None, description="Line number to start from"
    )
    limit: int | None = Field(
        default=None, description="Number of lines to read"
    )


async def file_read_execute(
    input: FileReadInput, ctx: ToolContext
) -> ToolResult:
    with open(input.path, "r") as f:
        content = f.read()

    ctx.read_file_state[input.path] = {
        "content": content,
        "mtime": __import__("time").time(),
    }

    lines = content.split("\n")
    start = (input.offset or 1) - 1
    end = start + input.limit if input.limit else len(lines)
    selected = lines[start:end]

    numbered = "\n".join(
        f"{str(start + i + 1).rjust(6)}|{line}"
        for i, line in enumerate(selected)
    )
    return ToolResult(data=numbered)


FileReadTool = build_tool(
    ToolDefinition(
        name="FileRead",
        description="Read the contents of a file at the specified path",
        input_model=FileReadInput,
        execute=file_read_execute,
        is_read_only=lambda _: True,
        is_concurrency_safe=lambda _: True,
    )
)


class FileEditInput(BaseModel):
    path: str = Field(description="Absolute path to the file")
    old_string: str = Field(description="The exact string to find and replace")
    new_string: str = Field(description="The replacement string")


async def file_edit_execute(
    input: FileEditInput, ctx: ToolContext
) -> ToolResult:
    with open(input.path, "r") as f:
        content = f.read()

    count = content.count(input.old_string)
    if count == 0:
        raise ValueError("old_string not found in file")
    if count > 1:
        raise ValueError(
            f"old_string found {count} times — must be unique"
        )

    updated = content.replace(input.old_string, input.new_string, 1)
    with open(input.path, "w") as f:
        f.write(updated)

    return ToolResult(data="File edited successfully")


def file_edit_check_permissions(
    input: Any, ctx: ToolContext
) -> PermissionDecision:
    if isinstance(input, FileEditInput):
        if input.path not in ctx.read_file_state:
            return PermissionDecision(
                behavior=PermissionBehavior.DENY,
                message="File must be read before editing",
            )
    if ctx.permission_mode == "plan":
        return PermissionDecision(
            behavior=PermissionBehavior.DENY,
            message="Edits not allowed in plan mode",
        )
    return PermissionDecision(
        behavior=PermissionBehavior.ASK,
        message=f"Edit {input.path}?",
    )


FileEditTool = build_tool(
    ToolDefinition(
        name="FileEdit",
        description="Edit a file by replacing an exact string match",
        input_model=FileEditInput,
        execute=file_edit_execute,
        check_permissions=file_edit_check_permissions,
    )
)


# --- Build Default Registry ---


def create_default_registry() -> ToolRegistry:
    registry = ToolRegistry()
    registry.register(FileReadTool)
    registry.register(FileEditTool)
    return registry
