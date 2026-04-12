"""
SessionManager: maintains conversation history across turns with a sliding window.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path


class SessionManager:
    def __init__(self, max_turns: int = 20) -> None:
        self._messages: list[dict] = []
        self.max_turns = max_turns
        self.started_at = datetime.now()

    # ------------------------------------------------------------------
    # Message management
    # ------------------------------------------------------------------

    def add_user_message(self, content: str) -> None:
        self._messages.append({"role": "user", "content": content})
        self._trim()

    def replace_messages(self, updated: list[dict]) -> None:
        """Replace the full message list after an orchestrator turn completes.

        The orchestrator builds up the message list (with tool_use / tool_result
        pairs) internally and hands it back here so the session stays in sync.
        """
        self._messages = updated
        self._trim()

    def reset(self) -> None:
        self._messages = []
        self.started_at = datetime.now()

    # ------------------------------------------------------------------
    # Read access
    # ------------------------------------------------------------------

    @property
    def messages(self) -> list[dict]:
        return list(self._messages)

    def get_summary(self) -> str:
        """Return a human-readable conversation summary for the escalation agent."""
        lines: list[str] = []
        for msg in self._messages:
            role = msg["role"].upper()
            content = msg["content"]
            if isinstance(content, str):
                lines.append(f"{role}: {content}")
            elif isinstance(content, list):
                for block in content:
                    if isinstance(block, dict):
                        if block.get("type") == "text":
                            lines.append(f"{role}: {block['text']}")
                        elif block.get("type") == "tool_use":
                            lines.append(
                                f"{role} [called {block['name']}]: "
                                f"{json.dumps(block.get('input', {}))}"
                            )
                        elif block.get("type") == "tool_result":
                            lines.append(
                                f"TOOL RESULT [{block.get('tool_use_id', '')}]: "
                                f"{block.get('content', '')}"
                            )
                    elif hasattr(block, "type"):
                        # SDK object
                        if block.type == "text":
                            lines.append(f"{role}: {block.text}")
                        elif block.type == "tool_use":
                            lines.append(
                                f"{role} [called {block.name}]: "
                                f"{json.dumps(block.input)}"
                            )
        return "\n".join(lines)

    def __len__(self) -> int:
        return len(self._messages)

    # ------------------------------------------------------------------
    # Persistence (optional)
    # ------------------------------------------------------------------

    def save(self, path: str | Path) -> None:
        """Save session to a JSON file."""
        data = {
            "started_at": self.started_at.isoformat(),
            "messages": _serialize_messages(self._messages),
        }
        Path(path).write_text(json.dumps(data, indent=2))

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _trim(self) -> None:
        """Keep the sliding window within max_turns * 2 messages.

        Always preserve the very first user message for context anchoring.
        """
        limit = self.max_turns * 2
        if len(self._messages) <= limit:
            return

        # Find the first user message to preserve as anchor
        anchor = None
        for msg in self._messages:
            if msg["role"] == "user" and isinstance(msg["content"], str):
                anchor = msg
                break

        excess = len(self._messages) - limit
        trimmed = self._messages[excess:]

        # Ensure we start on a user message (Anthropic requires user-first)
        while trimmed and trimmed[0]["role"] != "user":
            trimmed = trimmed[1:]

        if anchor and (not trimmed or trimmed[0] is not anchor):
            self._messages = [anchor] + trimmed
        else:
            self._messages = trimmed


def _serialize_messages(messages: list[dict]) -> list[dict]:
    """Convert SDK message objects to plain dicts for JSON serialization."""
    result = []
    for msg in messages:
        content = msg["content"]
        if isinstance(content, list):
            serialized_content = []
            for block in content:
                if isinstance(block, dict):
                    serialized_content.append(block)
                elif hasattr(block, "__dict__"):
                    serialized_content.append(vars(block))
                else:
                    serialized_content.append(str(block))
            result.append({"role": msg["role"], "content": serialized_content})
        else:
            result.append({"role": msg["role"], "content": content})
    return result
