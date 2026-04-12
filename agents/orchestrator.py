"""
OrchestratorAgent: primary triage and routing agent.

Runs a tool_use agentic loop — delegating to specialist agents via Claude's
function-calling — and synthesizes a single unified response for the customer.
"""

from __future__ import annotations

import json
from typing import Callable

import anthropic

from agents.base import BaseAgent
from config import (
    ORCHESTRATOR_MODEL,
    MAX_TOKENS_ORCHESTRATOR,
    MAX_TOOL_STEPS,
    ORCHESTRATOR_SYSTEM,
)
from session.manager import SessionManager
from tools import SPECIALIST_TOOLS


class OrchestratorAgent(BaseAgent):
    def __init__(
        self,
        specialists: dict[str, BaseAgent],
        client: anthropic.Anthropic,
    ) -> None:
        super().__init__(
            name="orchestrator",
            model=ORCHESTRATOR_MODEL,
            system_prompt=ORCHESTRATOR_SYSTEM,
            client=client,
            tools=SPECIALIST_TOOLS,
            max_tokens=MAX_TOKENS_ORCHESTRATOR,
        )
        self.specialists = specialists

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def process(
        self,
        session: SessionManager,
        on_token: Callable[[str], None] | None = None,
    ) -> str:
        """Process the latest user message in the session.

        Runs the tool_use loop, updates the session with the full message
        history (including tool_use / tool_result pairs), and returns the
        final synthesized response text.

        Args:
            session: The current SessionManager (user message already added).
            on_token: Optional callback for streaming the final response token
                      by token. If None, the final text is returned silently.

        Returns:
            The final assistant response as a plain string.
        """
        messages = session.messages
        final_text, updated_messages = self._tool_use_loop(messages, on_token)
        session.replace_messages(updated_messages)
        return final_text

    # ------------------------------------------------------------------
    # Agentic loop
    # ------------------------------------------------------------------

    def _tool_use_loop(
        self,
        messages: list[dict],
        on_token: Callable[[str], None] | None = None,
    ) -> tuple[str, list[dict]]:
        """Run the tool_use loop until Claude returns a final end_turn response.

        Returns:
            (final_text, updated_message_list)
        """
        step = 0

        while step < MAX_TOOL_STEPS:
            step += 1

            response = self.client.messages.create(
                model=self.model,
                system=self.system_prompt,
                messages=messages,
                tools=SPECIALIST_TOOLS,
                max_tokens=self.max_tokens,
            )

            if response.stop_reason == "end_turn":
                # Extract text from the final assistant message
                final_text = self._extract_text(response.content)

                # Stream character-by-character if callback provided
                if on_token and final_text:
                    for char in final_text:
                        on_token(char)

                # Persist the final assistant message
                messages.append(
                    {"role": "assistant", "content": self._serialize_content(response.content)}
                )
                return final_text, messages

            elif response.stop_reason == "tool_use":
                # Append assistant's tool_use message
                messages.append(
                    {"role": "assistant", "content": self._serialize_content(response.content)}
                )

                # Dispatch all tool calls in this response (may be batched)
                tool_results: list[dict] = []
                for block in response.content:
                    block_type = block.type if hasattr(block, "type") else block.get("type")
                    if block_type == "tool_use":
                        tool_name = block.name if hasattr(block, "name") else block["name"]
                        tool_input = block.input if hasattr(block, "input") else block["input"]
                        tool_id = block.id if hasattr(block, "id") else block["id"]

                        specialist_response = self._dispatch(tool_name, tool_input)
                        tool_results.append(
                            {
                                "type": "tool_result",
                                "tool_use_id": tool_id,
                                "content": specialist_response,
                            }
                        )

                # All results go into a single user message (Anthropic requirement)
                messages.append({"role": "user", "content": tool_results})

            else:
                # Unexpected stop reason (e.g. max_tokens mid-stream)
                fallback = "I'm sorry, I wasn't able to fully process your request. Please try again."
                messages.append({"role": "assistant", "content": fallback})
                return fallback, messages

        # Safety fallback if loop exhausted without end_turn
        fallback = (
            "I apologize — I was unable to resolve your request in one go. "
            "A support agent will follow up with you shortly."
        )
        messages.append({"role": "assistant", "content": fallback})
        return fallback, messages

    # ------------------------------------------------------------------
    # Specialist dispatch
    # ------------------------------------------------------------------

    def _dispatch(self, tool_name: str, tool_input: dict) -> str:
        """Call the named specialist with a structured prompt and return its text."""
        agent = self.specialists.get(tool_name)
        if agent is None:
            return f"[Error: specialist '{tool_name}' not available]"

        # Build a structured single-turn message for the specialist
        parts: list[str] = []

        customer_query = tool_input.get("customer_query", "")
        context = tool_input.get("context", "")
        order_id = tool_input.get("order_id", "")
        reason = tool_input.get("reason_for_escalation", "")
        conv_summary = tool_input.get("conversation_summary", "")
        priority = tool_input.get("priority", "")

        if context:
            parts.append(f"Context from conversation: {context}")
        if order_id:
            parts.append(f"Order ID: {order_id}")
        if reason:
            parts.append(f"Reason for escalation: {reason}")
        if priority:
            parts.append(f"Priority: {priority}")
        if conv_summary:
            parts.append(f"Conversation summary:\n{conv_summary}")

        parts.append(f"Customer query: {customer_query}")
        user_content = "\n".join(parts)

        specialist_messages = [{"role": "user", "content": user_content}]

        try:
            response = agent.invoke(specialist_messages)
            return self._extract_text(response.content) or "[No response from specialist]"
        except anthropic.APIError as exc:
            return f"[Specialist error: {exc}]"

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_text(content) -> str:
        """Extract plain text from a content block list or string."""
        if isinstance(content, str):
            return content
        texts: list[str] = []
        for block in content:
            block_type = block.type if hasattr(block, "type") else block.get("type", "")
            if block_type == "text":
                text = block.text if hasattr(block, "text") else block.get("text", "")
                texts.append(text)
        return "\n".join(texts)

    @staticmethod
    def _serialize_content(content) -> list[dict] | str:
        """Convert SDK content objects to plain dicts for storage in message history."""
        if isinstance(content, str):
            return content
        result: list[dict] = []
        for block in content:
            if isinstance(block, dict):
                result.append(block)
            elif hasattr(block, "type"):
                btype = block.type
                if btype == "text":
                    result.append({"type": "text", "text": block.text})
                elif btype == "tool_use":
                    result.append(
                        {
                            "type": "tool_use",
                            "id": block.id,
                            "name": block.name,
                            "input": block.input,
                        }
                    )
                else:
                    # Thinking blocks or other types — skip for history
                    pass
        return result
