"""Public provider webhooks (no JWT). Signature verification is mandatory."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services import finance_actions as actions
from app.services.errors import fail

router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])


@router.post("/razorpay")
async def razorpay_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_razorpay_signature: str | None = Header(default=None, alias="X-Razorpay-Signature"),
) -> dict:
    raw = await request.body()
    try:
        payload = json.loads(raw.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        fail(400, "validation_error", "Webhook body must be JSON.")
    if not isinstance(payload, dict):
        fail(400, "validation_error", "Webhook body must be a JSON object.")
    return actions.apply_razorpay_webhook(
        db,
        raw_body=raw,
        signature=x_razorpay_signature or "",
        payload=payload,
    )
