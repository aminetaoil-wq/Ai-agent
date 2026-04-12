from __future__ import annotations

import anthropic

from agents.base import BaseAgent
from config import (
    ESCALATION_MODEL,
    MAX_TOKENS_ESCALATION,
    ESCALATION_THINKING_BUDGET,
    SPECIALIST_PROMPTS,
    make_system_prompt,
)


class EscalationAgent(BaseAgent):
    def __init__(self, client: anthropic.Anthropic) -> None:
        super().__init__(
            name="escalation_agent",
            model=ESCALATION_MODEL,
            system_prompt=make_system_prompt(SPECIALIST_PROMPTS["escalation_agent"]),
            client=client,
            tools=None,
            max_tokens=MAX_TOKENS_ESCALATION,
        )

    def invoke(self, messages: list[dict]) -> anthropic.types.Message:
        """Override invoke to enable extended thinking for escalation reasoning."""
        response = self.client.messages.create(
            model=self.model,
            system=self.system_prompt,
            messages=messages,
            max_tokens=self.max_tokens,
            thinking={
                "type": "enabled",
                "budget_tokens": ESCALATION_THINKING_BUDGET,
            },
        )
        # Filter out thinking blocks — only return the text response to the orchestrator
        text_blocks = [b for b in response.content if b.type == "text"]
        # Reconstruct a response-like object with only text blocks
        response.content = text_blocks
        return response
