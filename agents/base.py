"""
BaseAgent: shared Anthropic client wrapper used by all agents.
"""

from __future__ import annotations

import anthropic


class BaseAgent:
    def __init__(
        self,
        name: str,
        model: str,
        system_prompt: list[dict],
        client: anthropic.Anthropic,
        tools: list[dict] | None = None,
        max_tokens: int = 2048,
    ) -> None:
        self.name = name
        self.model = model
        self.system_prompt = system_prompt
        self.client = client
        self.tools = tools
        self.max_tokens = max_tokens

    def invoke(self, messages: list[dict]) -> anthropic.types.Message:
        """Send messages to the model and return the full response."""
        kwargs: dict = {
            "model": self.model,
            "system": self.system_prompt,
            "messages": messages,
            "max_tokens": self.max_tokens,
        }
        if self.tools:
            kwargs["tools"] = self.tools
        return self.client.messages.create(**kwargs)
