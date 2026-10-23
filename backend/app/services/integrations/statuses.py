"""Canonical delivery / payment status codes for external integrations.

LIVE_VERIFIED is never set by code without a successful provider response under
INTEGRATIONS_MODE=live with real credentials. Do not invent success.
"""

from __future__ import annotations

# Delivery / intent lifecycle
NOT_CONFIGURED = "NOT_CONFIGURED"
MOCK_QUEUED = "MOCK_QUEUED"  # INTEGRATIONS_MODE=demo local outbox
SENT = "sent"
FAILED = "failed"

# Payment link / order lifecycle
OPEN = "OPEN"
PAID = "PAID"
PAYMENT_FAILED = "FAILED"

# Back-compat aliases used in older tests / UI (same meaning as NOT_CONFIGURED)
QUEUED_STUB = "queued_stub"
DEMO_SENT = "demo_sent"
