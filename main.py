#!/usr/bin/env python3
"""
StoneLinked Customer Service Agent OS — CLI entry point.

Gebruik:
    python3 main.py

Commando's (typ tijdens de sessie):
    /help       Toon beschikbare commando's
    /reset      Wis gesprekshistorie en begin opnieuw
    /history    Toon samenvatting van het huidige gesprek
    /save       Sla sessie op als JSON-bestand
    /quit       Beëindig sessie (ook: /exit, Ctrl+C)
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

from agents.orchestrator import OrchestratorAgent
from agents.specialists import (
    PakketAdviseur,
    BestellingAgent,
    GedenkpaginaAgent,
    PartnerAgent,
    EscalatieAgent,
)
from session.manager import SessionManager

load_dotenv()

console = Console()

BANNER = """
[bold]╔══════════════════════════════════════════════════════╗[/bold]
[bold]║[/bold]  [bold white]StoneLinked — Klantenservice[/bold white]                      [bold]║[/bold]
[bold]║[/bold]  [dim]Houd hun verhaal levend.[/dim]                            [bold]║[/bold]
[bold]║[/bold]  [dim]Typ /help voor commando's[/dim]                          [bold]║[/bold]
[bold]╚══════════════════════════════════════════════════════╝[/bold]
"""

HELP_TEXT = """
[bold]Beschikbare commando's[/bold]

  [cyan]/help[/cyan]       Toon dit helpbericht
  [cyan]/reset[/cyan]      Wis gesprekshistorie en begin opnieuw
  [cyan]/history[/cyan]    Toon samenvatting van het huidige gesprek
  [cyan]/save[/cyan]       Sla sessie op als JSON-bestand
  [cyan]/quit[/cyan]       Beëindig sessie  (ook: [cyan]/exit[/cyan] of [cyan]Ctrl+C[/cyan])

[bold]Tips[/bold]
  • Beschrijf uw vraag in gewone taal — het systeem routeert automatisch
  • U kunt meerdere vragen tegelijk stellen
  • Bij complexe situaties wordt u doorverbonden met een medewerker
"""


def build_agents(client: anthropic.Anthropic) -> dict:
    return {
        "pakket_adviseur": PakketAdviseur(client),
        "bestelling_agent": BestellingAgent(client),
        "gedenkpagina_agent": GedenkpaginaAgent(client),
        "partner_agent": PartnerAgent(client),
        "escalatie_agent": EscalatieAgent(client),
    }


def print_response(text: str) -> None:
    console.print(
        Panel(
            Markdown(text),
            title="[bold]StoneLinked Klantenservice[/bold]",
            border_style="bright_white",
            padding=(1, 2),
        )
    )


def print_history(session: SessionManager) -> None:
    summary = session.get_summary()
    if not summary:
        console.print("[dim]Nog geen gesprekshistorie.[/dim]")
        return
    console.print(
        Panel(
            summary,
            title="[bold yellow]Gesprekshistorie[/bold yellow]",
            border_style="yellow",
        )
    )


def main() -> None:
    # ── API key ────────────────────────────────────────────────────────
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        console.print(
            "[bold red]Fout:[/bold red] ANTHROPIC_API_KEY is niet ingesteld.\n"
            "Kopieer [cyan].env.example[/cyan] naar [cyan].env[/cyan] en voeg uw sleutel toe."
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
            user_input = console.input("[bold cyan]U:[/bold cyan] ").strip()
        except (EOFError, KeyboardInterrupt):
            console.print("\n[dim]Sessie beëindigd. Tot ziens.[/dim]")
            break

        if not user_input:
            continue

        # ── Ingebouwde commando's ──────────────────────────────────────
        cmd = user_input.lower()

        if cmd in ("/quit", "/exit"):
            console.print("[dim]Tot ziens.[/dim]")
            break

        if cmd == "/help":
            console.print(HELP_TEXT)
            continue

        if cmd == "/reset":
            session.reset()
            console.print("[yellow]Gesprekshistorie gewist.[/yellow]")
            continue

        if cmd == "/history":
            print_history(session)
            continue

        if cmd == "/save":
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            save_path = Path(f"sessie_{ts}.json")
            session.save(save_path)
            console.print(f"[green]Sessie opgeslagen als [cyan]{save_path}[/cyan][/green]")
            continue

        # ── Verwerk klantbericht ───────────────────────────────────────
        session.add_user_message(user_input)

        response_text = ""

        try:
            with console.status(
                "[bold]Doorverbinden met specialist...[/bold]",
                spinner="dots",
            ):
                response_text = orchestrator.process(session=session)

        except anthropic.AuthenticationError:
            console.print(
                "[bold red]Authenticatiefout:[/bold red] "
                "Controleer of uw ANTHROPIC_API_KEY geldig is."
            )
            continue
        except anthropic.RateLimitError:
            console.print(
                "[bold yellow]Limiet bereikt.[/bold yellow] "
                "Even wachten en opnieuw proberen."
            )
            continue
        except anthropic.APIConnectionError:
            console.print(
                "[bold red]Verbindingsfout:[/bold red] "
                "Kan de Anthropic API niet bereiken. Controleer uw netwerk."
            )
            continue
        except anthropic.APIStatusError as exc:
            console.print(
                f"[bold red]API-fout {exc.status_code}:[/bold red] {exc.message}"
            )
            continue
        except KeyboardInterrupt:
            console.print("\n[dim]Antwoord onderbroken.[/dim]")
            continue

        if response_text:
            print_response(response_text)
        else:
            console.print("[dim]Geen antwoord ontvangen. Probeer het opnieuw.[/dim]")


if __name__ == "__main__":
    main()
