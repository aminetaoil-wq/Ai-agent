#!/usr/bin/env python3
"""
Customer Service Agent OS — CLI entry point.

Usage:
    python3 main.py

Commands (type during session):
    /help     Show available commands
    /reset    Clear conversation history
    /history  Print conversation summary
    /save     Save session to a JSON file
    /quit     End session (also: /exit, Ctrl+C)
"""

from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path

import anthropic
from dotenv import load_dotenv
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.text import Text

from agents.orchestrator import OrchestratorAgent
from agents.specialists import (
    BillingAgent,
    EscalationAgent,
    FAQAgent,
    ReturnsAgent,
    TechnicalSupportAgent,
)
from session.manager import SessionManager

load_dotenv()

console = Console()

BANNER = """
[bold cyan]╔══════════════════════════════════════════════════════╗[/bold cyan]
[bold cyan]║[/bold cyan]  [bold white]Customer Service Agent OS[/bold white]                         [bold cyan]║[/bold cyan]
[bold cyan]║[/bold cyan]  [dim]Powered by Claude — Multi-Agent Routing System[/dim]     [bold cyan]║[/bold cyan]
[bold cyan]║[/bold cyan]  [dim]Type /help for commands[/dim]                            [bold cyan]║[/bold cyan]
[bold cyan]╚══════════════════════════════════════════════════════╝[/bold cyan]
"""

HELP_TEXT = """
[bold]Available Commands[/bold]

  [cyan]/help[/cyan]     Show this help message
  [cyan]/reset[/cyan]    Clear conversation history and start fresh
  [cyan]/history[/cyan]  Print a summary of the current conversation
  [cyan]/save[/cyan]     Save the current session to a JSON file
  [cyan]/quit[/cyan]     End the session  (also: [cyan]/exit[/cyan] or [cyan]Ctrl+C[/cyan])

[bold]Tips[/bold]
  • Describe your issue in plain language — the system routes automatically
  • You can raise multiple issues at once
  • The agent will escalate to a human if needed
"""


def build_agents(client: anthropic.Anthropic) -> dict:
    return {
        "billing_agent": BillingAgent(client),
        "technical_support_agent": TechnicalSupportAgent(client),
        "returns_agent": ReturnsAgent(client),
        "faq_agent": FAQAgent(client),
        "escalation_agent": EscalationAgent(client),
    }


def print_response(text: str) -> None:
    console.print(
        Panel(
            Markdown(text),
            title="[bold green]Support Agent[/bold green]",
            border_style="green",
            padding=(1, 2),
        )
    )


def print_history(session: SessionManager) -> None:
    summary = session.get_summary()
    if not summary:
        console.print("[dim]No conversation history yet.[/dim]")
        return
    console.print(
        Panel(
            summary,
            title="[bold yellow]Conversation History[/bold yellow]",
            border_style="yellow",
        )
    )


def main() -> None:
    # ── API key ────────────────────────────────────────────────────────
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        console.print(
            "[bold red]Error:[/bold red] ANTHROPIC_API_KEY is not set.\n"
            "Copy [cyan].env.example[/cyan] to [cyan].env[/cyan] and add your key."
        )
        sys.exit(1)

    # ── Bootstrap ──────────────────────────────────────────────────────
    client = anthropic.Anthropic(api_key=api_key)
    specialists = build_agents(client)
    orchestrator = OrchestratorAgent(specialists=specialists, client=client)
    session = SessionManager(max_turns=20)

    console.print(BANNER)

    # ── REPL ───────────────────────────────────────────────────────────
    while True:
        try:
            user_input = console.input("[bold cyan]You:[/bold cyan] ").strip()
        except (EOFError, KeyboardInterrupt):
            console.print("\n[dim]Session ended.[/dim]")
            break

        if not user_input:
            continue

        # ── Built-in commands ──────────────────────────────────────────
        cmd = user_input.lower()

        if cmd in ("/quit", "/exit"):
            console.print("[dim]Goodbye![/dim]")
            break

        if cmd == "/help":
            console.print(HELP_TEXT)
            continue

        if cmd == "/reset":
            session.reset()
            console.print("[yellow]Conversation history cleared.[/yellow]")
            continue

        if cmd == "/history":
            print_history(session)
            continue

        if cmd == "/save":
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            save_path = Path(f"session_{ts}.json")
            session.save(save_path)
            console.print(f"[green]Session saved to [cyan]{save_path}[/cyan][/green]")
            continue

        # ── Process customer message ───────────────────────────────────
        session.add_user_message(user_input)

        response_text = ""

        try:
            with console.status(
                "[bold green]Routing to specialist agents...[/bold green]",
                spinner="dots",
            ):
                response_text = orchestrator.process(session=session)

        except anthropic.AuthenticationError:
            console.print(
                "[bold red]Authentication error:[/bold red] "
                "Check that your ANTHROPIC_API_KEY is valid."
            )
            continue
        except anthropic.RateLimitError:
            console.print(
                "[bold yellow]Rate limit reached.[/bold yellow] "
                "Please wait a moment and try again."
            )
            continue
        except anthropic.APIConnectionError:
            console.print(
                "[bold red]Connection error:[/bold red] "
                "Could not reach the Anthropic API. Check your network."
            )
            continue
        except anthropic.APIStatusError as exc:
            console.print(
                f"[bold red]API error {exc.status_code}:[/bold red] {exc.message}"
            )
            continue
        except KeyboardInterrupt:
            console.print("\n[dim]Response interrupted.[/dim]")
            continue

        if response_text:
            print_response(response_text)
        else:
            console.print("[dim]No response received. Please try again.[/dim]")


if __name__ == "__main__":
    main()
