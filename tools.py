"""
SPECIALIST_TOOLS: tool schemas passed to the orchestrator so Claude can
route customer queries to the appropriate specialist agent via tool_use.
"""

SPECIALIST_TOOLS: list[dict] = [
    {
        "name": "billing_agent",
        "description": (
            "Handles all billing-related issues: payment failures, invoice questions, "
            "subscription changes (upgrades, downgrades, cancellations), refund eligibility, "
            "duplicate or unexpected charges, and account credits. "
            "Call this when the customer mentions payments, invoices, charges, subscriptions, "
            "or billing statements."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "customer_query": {
                    "type": "string",
                    "description": (
                        "The specific billing question or issue from the customer, "
                        "verbatim or closely paraphrased."
                    ),
                },
                "context": {
                    "type": "string",
                    "description": (
                        "Any relevant context from earlier in the conversation "
                        "(account email, last 4 digits of card, subscription plan, etc.)."
                    ),
                },
            },
            "required": ["customer_query"],
        },
    },
    {
        "name": "technical_support_agent",
        "description": (
            "Handles technical problems: software bugs, app crashes, login issues, "
            "authentication errors, configuration questions, API integration errors, "
            "and how-to guidance for product features. "
            "Call this for any technical troubleshooting or product usage request."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "customer_query": {
                    "type": "string",
                    "description": "The technical issue or question from the customer.",
                },
                "context": {
                    "type": "string",
                    "description": (
                        "Relevant technical context if mentioned: OS, app version, "
                        "device type, error message text, steps already tried."
                    ),
                },
            },
            "required": ["customer_query"],
        },
    },
    {
        "name": "returns_agent",
        "description": (
            "Handles returns, refunds, exchanges, and order fulfillment. "
            "Call this when the customer wants to return a product, check a refund status, "
            "exchange an item, track an order, or report a missing/damaged shipment."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "customer_query": {
                    "type": "string",
                    "description": "The return, refund, or order-related request from the customer.",
                },
                "order_id": {
                    "type": "string",
                    "description": "Order ID if the customer provided one.",
                },
                "context": {
                    "type": "string",
                    "description": (
                        "Additional context: purchase date, item description, "
                        "reason for return, delivery status."
                    ),
                },
            },
            "required": ["customer_query"],
        },
    },
    {
        "name": "faq_agent",
        "description": (
            "Answers general informational questions about products, policies, features, "
            "pricing plans, hours of operation, company information, and promotions. "
            "Call this for questions that don't require account-specific data or actions."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "customer_query": {
                    "type": "string",
                    "description": "The general question from the customer.",
                },
            },
            "required": ["customer_query"],
        },
    },
    {
        "name": "escalation_agent",
        "description": (
            "Escalates unresolved or complex issues to a human support agent and creates "
            "a support ticket. Call this when: (1) the customer is very frustrated or upset, "
            "(2) the issue requires human judgment or access to internal systems, "
            "(3) previous specialist interactions did not resolve the issue, "
            "(4) the issue involves legal, compliance, or safety concerns."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "customer_query": {
                    "type": "string",
                    "description": "Summary of the unresolved issue.",
                },
                "reason_for_escalation": {
                    "type": "string",
                    "description": "Why this issue requires human escalation.",
                },
                "conversation_summary": {
                    "type": "string",
                    "description": (
                        "A brief summary of the conversation so far, "
                        "including what was already tried."
                    ),
                },
                "priority": {
                    "type": "string",
                    "enum": ["low", "medium", "high", "urgent"],
                    "description": (
                        "Priority: urgent=safety/legal, high=financial impact or very frustrated, "
                        "medium=unresolved after multiple attempts, low=preference/exception request."
                    ),
                },
            },
            "required": ["customer_query", "reason_for_escalation"],
        },
    },
]
