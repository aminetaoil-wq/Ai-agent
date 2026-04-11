from __future__ import annotations

import anthropic

from agents.base import BaseAgent
from config import SPECIALIST_MODEL, MAX_TOKENS_SPECIALIST, SPECIALIST_PROMPTS, make_system_prompt


class GedenkpaginaAgent(BaseAgent):
    def __init__(self, client: anthropic.Anthropic) -> None:
        super().__init__(
            name="gedenkpagina_agent",
            model=SPECIALIST_MODEL,
            system_prompt=make_system_prompt(SPECIALIST_PROMPTS["gedenkpagina_agent"]),
            client=client,
            tools=None,
            max_tokens=MAX_TOKENS_SPECIALIST,
        )
