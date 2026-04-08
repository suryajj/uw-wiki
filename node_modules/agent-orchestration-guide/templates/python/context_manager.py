"""
Context Manager — Python Template

Manages the context window: token tracking, budget enforcement,
compaction, and history management.

Install: pip install anthropic
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import anthropic


# --- Token Estimation ---


def estimate_tokens(text: str) -> int:
    return len(text) // 4 + 1


def estimate_message_tokens(msg: dict[str, Any]) -> int:
    content = msg.get("content", "")
    if isinstance(content, str):
        return estimate_tokens(content)
    total = 0
    for block in content:
        if isinstance(block, dict):
            for key in ("text", "content"):
                if key in block and isinstance(block[key], str):
                    total += estimate_tokens(block[key])
    return total


# --- Context Manager ---


@dataclass
class TokenBudget:
    max_tokens: int
    system_prompt_tokens: int
    tool_definition_tokens: int
    reserved_for_response: int
    history_tokens: int


class ContextManager:
    def __init__(
        self,
        system_prompt: str,
        max_context_tokens: int = 200_000,
        compaction_threshold: float = 0.8,
    ):
        self.system_prompt = system_prompt
        self.max_context_tokens = max_context_tokens
        self.compaction_threshold = compaction_threshold
        self.history: list[dict[str, Any]] = []

    def add_message(self, message: dict[str, Any]) -> None:
        self.history.append(message)

    def get_history(self) -> list[dict[str, Any]]:
        return list(self.history)

    def get_token_budget(self) -> TokenBudget:
        system_tokens = estimate_tokens(self.system_prompt)
        reserved = int(self.max_context_tokens * 0.05)
        history_tokens = sum(
            estimate_message_tokens(m) for m in self.history
        )
        return TokenBudget(
            max_tokens=self.max_context_tokens,
            system_prompt_tokens=system_tokens,
            tool_definition_tokens=0,
            reserved_for_response=reserved,
            history_tokens=history_tokens,
        )

    @property
    def usage_ratio(self) -> float:
        budget = self.get_token_budget()
        used = (
            budget.system_prompt_tokens
            + budget.tool_definition_tokens
            + budget.history_tokens
            + budget.reserved_for_response
        )
        return used / budget.max_tokens

    def should_compact(self) -> bool:
        return self.usage_ratio >= self.compaction_threshold

    def micro_compact(self, max_result_chars: int = 10_000) -> int:
        """Truncate oversized tool results in-place."""
        truncated = 0
        for msg in self.history:
            content = msg.get("content")
            if not isinstance(content, list):
                continue
            for block in content:
                if (
                    isinstance(block, dict)
                    and block.get("type") == "tool_result"
                    and isinstance(block.get("content"), str)
                    and len(block["content"]) > max_result_chars
                ):
                    half = max_result_chars // 2
                    original_len = len(block["content"])
                    block["content"] = (
                        block["content"][:half]
                        + f"\n\n... [truncated {original_len - max_result_chars} chars] ...\n\n"
                        + block["content"][-half:]
                    )
                    truncated += 1
        return truncated

    def full_compact(
        self,
        client: anthropic.Anthropic,
        model: str,
        keep_recent_turns: int = 4,
    ) -> dict[str, int]:
        """Summarize older messages, keep recent ones."""
        original_count = len(self.history)

        if original_count <= keep_recent_turns * 2:
            return {
                "original_messages": original_count,
                "compacted_messages": original_count,
                "tokens_saved": 0,
            }

        old_messages = self.history[: -keep_recent_turns * 2]
        recent_messages = self.history[-keep_recent_turns * 2 :]

        old_tokens = sum(estimate_message_tokens(m) for m in old_messages)

        summary_text_parts = []
        for m in old_messages:
            content = m.get("content", "")
            if isinstance(content, str):
                summary_text_parts.append(f"[{m['role']}]: {content[:500]}")
            else:
                summary_text_parts.append(
                    f"[{m['role']}]: {json.dumps(content)[:500]}"
                )

        summary_prompt = (
            "Summarize the following conversation history concisely. "
            "Preserve: key decisions, files modified, errors encountered, current task state. "
            "Discard: verbose tool outputs, redundant information.\n\n"
            + "\n\n".join(summary_text_parts)
        )

        response = client.messages.create(
            model=model,
            max_tokens=2048,
            messages=[{"role": "user", "content": summary_prompt}],
        )

        summary = (
            response.content[0].text
            if response.content[0].type == "text"
            else ""
        )

        self.history = [
            {
                "role": "user",
                "content": f"[Conversation summary from earlier]\n\n{summary}",
            },
            {
                "role": "assistant",
                "content": "Understood. I have the context from the summary. Continuing.",
            },
            *recent_messages,
        ]

        return {
            "original_messages": original_count,
            "compacted_messages": len(self.history),
            "tokens_saved": old_tokens - estimate_tokens(summary),
        }

    def reset(self) -> None:
        self.history = []


# --- Session Memory ---


class SessionMemory:
    """Key facts persisted across compaction within a session."""

    def __init__(self):
        self._facts: dict[str, str] = {}

    def add_fact(self, key: str, value: str) -> None:
        self._facts[key] = value

    def remove_fact(self, key: str) -> None:
        self._facts.pop(key, None)

    def to_prompt_section(self) -> str:
        if not self._facts:
            return ""
        entries = "\n".join(
            f"- {k}: {v}" for k, v in self._facts.items()
        )
        return f"## Session Memory\n\n{entries}"


# --- Long-Term Memory ---


class LongTermMemory:
    """File-based memory that persists across sessions."""

    def __init__(self, memory_dir: str):
        self.memory_dir = Path(memory_dir)

    def save(
        self, key: str, content: str, tags: list[str] | None = None
    ) -> None:
        self.memory_dir.mkdir(parents=True, exist_ok=True)
        tags_str = ", ".join(tags or [])
        frontmatter = "\n".join(
            [
                "---",
                f"key: {key}",
                f"tags: [{tags_str}]",
                f"created: {time.strftime('%Y-%m-%dT%H:%M:%SZ')}",
                "---",
            ]
        )
        filepath = self.memory_dir / f"{key}.md"
        filepath.write_text(f"{frontmatter}\n\n{content}")

    def load(self, key: str) -> str | None:
        filepath = self.memory_dir / f"{key}.md"
        if not filepath.exists():
            return None
        content = filepath.read_text()
        body_start = content.find("---", 3)
        if body_start >= 0:
            return content[body_start + 3 :].strip()
        return content

    def list_all(self) -> list[str]:
        if not self.memory_dir.exists():
            return []
        return [
            f.stem
            for f in self.memory_dir.iterdir()
            if f.suffix == ".md"
        ]
