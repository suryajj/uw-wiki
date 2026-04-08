"""
Permission System — Python Template

Implements tiered permissions with rule-based access control,
permission dialogs, and mode-based filtering.
"""

from __future__ import annotations

import fnmatch
import json
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Awaitable


# --- Types ---


class PermissionTier(Enum):
    AUTO = "auto"
    ASK_ONCE = "ask-once"
    ASK_ALWAYS = "ask-always"
    DENY = "deny"


class PermissionMode(Enum):
    DEFAULT = "default"
    PLAN = "plan"
    AUTO_ACCEPT = "auto-accept"
    BYPASS = "bypass"


@dataclass
class PermissionRule:
    tool: str
    path: str | None = None
    action: str = "allow"  # allow | deny | ask


@dataclass
class PermissionContext:
    mode: PermissionMode = PermissionMode.DEFAULT
    allow_rules: list[PermissionRule] = field(default_factory=list)
    deny_rules: list[PermissionRule] = field(default_factory=list)
    session_approvals: set[str] = field(default_factory=set)


@dataclass
class PermissionDecision:
    behavior: str  # allow | ask | deny
    message: str = ""


@dataclass
class ToolPermissionInfo:
    name: str
    default_tier: PermissionTier
    is_read_only: bool
    get_path: Callable[[dict[str, Any]], str | None] | None = None


# --- Permission Checker ---


class PermissionChecker:
    def __init__(
        self,
        context: PermissionContext,
        request_approval: Callable[
            [str, str], Awaitable[str]
        ],  # returns: approve | approve-always | deny | deny-always
    ):
        self.context = context
        self.request_approval = request_approval

    def check(
        self,
        tool: ToolPermissionInfo,
        input: dict[str, Any],
    ) -> PermissionDecision:
        tool_path = tool.get_path(input) if tool.get_path else None
        match_key = f"{tool.name}:{tool_path}" if tool_path else tool.name

        # 1. Bypass mode
        if self.context.mode == PermissionMode.BYPASS:
            return PermissionDecision(behavior="allow")

        # 2. Plan mode — read-only only
        if (
            self.context.mode == PermissionMode.PLAN
            and not tool.is_read_only
        ):
            return PermissionDecision(
                behavior="deny",
                message="Write operations not allowed in plan mode",
            )

        # 3. Deny rules (highest priority)
        for rule in self.context.deny_rules:
            if _matches_rule(rule, tool.name, tool_path):
                return PermissionDecision(
                    behavior="deny",
                    message=f"Blocked by deny rule: {rule.tool}",
                )

        # 4. Allow rules
        for rule in self.context.allow_rules:
            if _matches_rule(rule, tool.name, tool_path):
                return PermissionDecision(behavior="allow")

        # 5. Auto-accept mode
        if self.context.mode == PermissionMode.AUTO_ACCEPT:
            return PermissionDecision(behavior="allow")

        # 6. Session approvals (ask-once)
        if match_key in self.context.session_approvals:
            return PermissionDecision(behavior="allow")

        # 7. Default tier
        if tool.default_tier == PermissionTier.AUTO:
            return PermissionDecision(behavior="allow")
        if tool.default_tier == PermissionTier.DENY:
            return PermissionDecision(
                behavior="deny",
                message=f"{tool.name} is denied by default",
            )
        action = "read" if tool.is_read_only else "modify"
        return PermissionDecision(
            behavior="ask",
            message=f"{tool.name} wants to {action}: {tool_path or 'unknown'}",
        )

    async def handle_ask(
        self,
        tool: ToolPermissionInfo,
        input: dict[str, Any],
        message: str,
    ) -> PermissionDecision:
        tool_path = tool.get_path(input) if tool.get_path else None
        match_key = f"{tool.name}:{tool_path}" if tool_path else tool.name

        decision = await self.request_approval(tool.name, message)

        if decision == "approve":
            if tool.default_tier == PermissionTier.ASK_ONCE:
                self.context.session_approvals.add(match_key)
            return PermissionDecision(behavior="allow")

        if decision == "approve-always":
            self.context.allow_rules.append(
                PermissionRule(tool=tool.name, path=tool_path, action="allow")
            )
            return PermissionDecision(behavior="allow")

        if decision == "deny-always":
            self.context.deny_rules.append(
                PermissionRule(tool=tool.name, path=tool_path, action="deny")
            )
            return PermissionDecision(
                behavior="deny",
                message="User permanently denied this operation",
            )

        return PermissionDecision(
            behavior="deny", message="User denied this operation"
        )


# --- Rule Matching ---


def _matches_rule(
    rule: PermissionRule, tool_name: str, path: str | None
) -> bool:
    if not fnmatch.fnmatch(tool_name, rule.tool):
        return False
    if rule.path and path and not fnmatch.fnmatch(path, rule.path):
        return False
    if rule.path and not path:
        return False
    return True


# --- Layered Settings ---


@dataclass
class PermissionSettings:
    allow_rules: list[PermissionRule] = field(default_factory=list)
    deny_rules: list[PermissionRule] = field(default_factory=list)


def merge_permission_settings(
    *layers: PermissionSettings,
) -> PermissionSettings:
    merged = PermissionSettings()
    for layer in layers:
        merged.allow_rules.extend(layer.allow_rules)
        merged.deny_rules.extend(layer.deny_rules)
    return merged


def load_permission_settings(paths: list[str]) -> PermissionSettings:
    layers = []
    for p in paths:
        try:
            data = json.loads(Path(p).read_text())
            layers.append(
                PermissionSettings(
                    allow_rules=[
                        PermissionRule(**r) for r in data.get("allowRules", [])
                    ],
                    deny_rules=[
                        PermissionRule(**r) for r in data.get("denyRules", [])
                    ],
                )
            )
        except (FileNotFoundError, json.JSONDecodeError):
            continue
    return merge_permission_settings(*layers)


# --- Example Usage ---


async def _example():
    context = PermissionContext(
        mode=PermissionMode.DEFAULT,
        allow_rules=[
            PermissionRule(tool="FileRead", action="allow"),
            PermissionRule(tool="Bash", path="npm test", action="allow"),
        ],
        deny_rules=[
            PermissionRule(tool="Bash", path="rm -rf *", action="deny"),
        ],
    )

    async def mock_approval(tool_name: str, message: str) -> str:
        print(f"[Permission] {tool_name}: {message}")
        return "approve"

    checker = PermissionChecker(context, mock_approval)

    file_read_info = ToolPermissionInfo(
        name="FileRead",
        default_tier=PermissionTier.AUTO,
        is_read_only=True,
        get_path=lambda inp: inp.get("path"),
    )

    decision = checker.check(file_read_info, {"path": "/src/index.ts"})
    print(decision)  # PermissionDecision(behavior='allow')


if __name__ == "__main__":
    import asyncio

    asyncio.run(_example())
