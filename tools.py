"""
SPECIALIST_TOOLS: tool schemas voor de orchestrator zodat Claude klanten
kan doorsturen naar de juiste StoneLinked specialist via tool_use.
"""

SPECIALIST_TOOLS: list[dict] = [
    {
        "name": "pakket_adviseur",
        "description": (
            "Helpt klanten het juiste herdenkingspakket kiezen. Behandelt vragen over "
            "de drie pakketten: Het Anker (€195), De Ceremonie (€365) en Eeuwige Herinnering (€595). "
            "Vergelijkt inhoud, prijzen en geeft persoonlijk advies. "
            "Roep dit aan wanneer de klant vraagt welk pakket past bij hun situatie, "
            "wat er inbegrepen is, of wat de prijzen zijn."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "klant_vraag": {
                    "type": "string",
                    "description": "De specifieke paketvraag of situatie van de klant.",
                },
                "context": {
                    "type": "string",
                    "description": (
                        "Relevante context uit het gesprek: bijv. of de uitvaart al geweest is, "
                        "hoeveel mensen er worden verwacht, het budget."
                    ),
                },
            },
            "required": ["klant_vraag"],
        },
    },
    {
        "name": "bestelling_agent",
        "description": (
            "Behandelt vragen over bestellingen, betaling en levering. "
            "Roep dit aan wanneer de klant vraagt over: een bestelling plaatsen, "
            "betaalmethoden, levertijden, orderstatus, facturen, wijzigen of annuleren van een bestelling."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "klant_vraag": {
                    "type": "string",
                    "description": "De bestelling- of leveringsvraag van de klant.",
                },
                "bestelnummer": {
                    "type": "string",
                    "description": "Het bestelnummer als de klant dit heeft opgegeven.",
                },
                "context": {
                    "type": "string",
                    "description": "Aanvullende context: gekozen pakket, leveradres, urgentie.",
                },
            },
            "required": ["klant_vraag"],
        },
    },
    {
        "name": "gedenkpagina_agent",
        "description": (
            "Helpt klanten met de digitale gedenkpagina en QR-tag. "
            "Roep dit aan voor vragen over: pagina aanmaken, foto's of video's uploaden, "
            "QR-tag activeren of testen, privacyinstellingen, gastenboek beheren, "
            "de pagina delen met familie, of technische problemen met de pagina."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "klant_vraag": {
                    "type": "string",
                    "description": "De vraag over de gedenkpagina of QR-tag.",
                },
                "context": {
                    "type": "string",
                    "description": (
                        "Technische context: apparaat (iPhone/Android/PC), "
                        "welke stap mislukt, foutmelding die de klant ziet."
                    ),
                },
            },
            "required": ["klant_vraag"],
        },
    },
    {
        "name": "partner_agent",
        "description": (
            "Informeert over het partnerschap-programma voor uitvaartondernemers, "
            "begraafplaatsen, grafsteenhandelaren en zorginstellingen. "
            "Roep dit aan wanneer de klant aangeeft een bedrijf te vertegenwoordigen "
            "of vraagt naar samenwerking, reseller-mogelijkheden of het partnerportaal."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "klant_vraag": {
                    "type": "string",
                    "description": "De vraag over het partnerschap of samenwerking.",
                },
                "context": {
                    "type": "string",
                    "description": (
                        "Type bedrijf van de klant (bijv. uitvaartondernemer, begraafplaats), "
                        "regio of grootte van het bedrijf."
                    ),
                },
            },
            "required": ["klant_vraag"],
        },
    },
    {
        "name": "escalatie_agent",
        "description": (
            "Escaleert naar een menselijke medewerker van StoneLinked en maakt een supportticket aan. "
            "Roep dit aan wanneer: (1) de klant erg verdrietig of overstuur is en extra menselijke zorg nodig heeft, "
            "(2) er een spoedsituatie is (uitvaart binnen 24-48 uur), "
            "(3) een klacht niet is opgelost door andere specialisten, "
            "(4) er een uitzondering op het beleid nodig is."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "klant_vraag": {
                    "type": "string",
                    "description": "Samenvatting van het onopgeloste probleem of de gevoelige situatie.",
                },
                "reden_escalatie": {
                    "type": "string",
                    "description": "Waarom menselijke opvolging nodig is.",
                },
                "gesprek_samenvatting": {
                    "type": "string",
                    "description": "Korte samenvatting van het gesprek tot nu toe.",
                },
                "prioriteit": {
                    "type": "string",
                    "enum": ["laag", "middel", "hoog", "spoed"],
                    "description": (
                        "spoed = uitvaart binnen 24-48 uur, "
                        "hoog = klacht of financieel probleem, "
                        "middel = onopgelost na meerdere pogingen, "
                        "laag = voorkeur of beleidsuitzondering."
                    ),
                },
            },
            "required": ["klant_vraag", "reden_escalatie"],
        },
    },
]
