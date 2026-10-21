"""SMTP + WhatsApp delivery. Demo outbox, live providers, or NOT_CONFIGURED when unset."""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

import httpx

from app.core.config import settings
from app.services.integrations import demo
from app.services.integrations.statuses import DEMO_SENT, FAILED, MOCK_QUEUED, NOT_CONFIGURED, SENT

log = logging.getLogger(__name__)


def _not_configured(channel: str, hint: str) -> dict:
    return {
        "channel": channel,
        "status": NOT_CONFIGURED,
        "legacyStatus": "queued_stub",
        "delivered": False,
        "providerConfigured": False,
        "liveVerified": False,
        "message": hint,
    }


def send_email(
    *,
    to: str,
    subject: str,
    body: str,
    html_body: str | None = None,
) -> dict:
    if not settings.smtp_configured:
        return _not_configured(
            "email",
            "NOT_CONFIGURED — set SMTP_HOST and SMTP_FROM (and INTEGRATIONS_MODE=live for real send)",
        )
    if not to or "@" not in to:
        return {
            "channel": "email",
            "status": FAILED,
            "delivered": False,
            "providerConfigured": True,
            "liveVerified": False,
            "message": "Missing or invalid recipient email",
        }

    if settings.demo_integrations:
        demo.append_demo_outbox(
            {
                "channel": "email",
                "to": to,
                "from": settings.smtp_from or demo.DEMO_SMTP_FROM,
                "subject": subject,
                "body": body,
                "html": html_body,
            }
        )
        return {
            "channel": "email",
            "status": MOCK_QUEUED,
            "legacyStatus": DEMO_SENT,
            "delivered": False,
            "providerConfigured": True,
            "demo": True,
            "liveVerified": False,
            "message": "MOCK_QUEUED — written to local outbox (not a real mailbox)",
        }

    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from
        msg["To"] = to
        msg["Reply-To"] = settings.smtp_from
        msg.set_content(body)
        if html_body:
            msg.add_alternative(html_body, subtype="html")
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(msg)
        return {
            "channel": "email",
            "status": SENT,
            "delivered": True,
            "providerConfigured": True,
            "liveVerified": True,
            "message": "SMTP accepted message",
        }
    except Exception as exc:  # noqa: BLE001
        log.warning("smtp_send_failed")
        return {
            "channel": "email",
            "status": FAILED,
            "delivered": False,
            "providerConfigured": True,
            "liveVerified": False,
            "message": f"SMTP error: {type(exc).__name__}",
        }


def send_whatsapp(*, to_phone: str, text: str) -> dict:
    if not settings.whatsapp_configured:
        return _not_configured(
            "whatsapp",
            "NOT_CONFIGURED — set WHATSAPP_API_URL and WHATSAPP_API_TOKEN (INTEGRATIONS_MODE=live for real send)",
        )
    if not to_phone:
        return {
            "channel": "whatsapp",
            "status": FAILED,
            "delivered": False,
            "providerConfigured": True,
            "liveVerified": False,
            "message": "Missing recipient phone",
        }

    if settings.demo_integrations:
        demo.append_demo_outbox(
            {
                "channel": "whatsapp",
                "to": to_phone,
                "from": settings.whatsapp_from or demo.DEMO_WHATSAPP_FROM,
                "text": text,
            }
        )
        return {
            "channel": "whatsapp",
            "status": MOCK_QUEUED,
            "legacyStatus": DEMO_SENT,
            "delivered": False,
            "providerConfigured": True,
            "demo": True,
            "liveVerified": False,
            "message": "MOCK_QUEUED — written to local outbox (not a real WhatsApp send)",
        }

    payload = {
        "to": to_phone,
        "from": settings.whatsapp_from or None,
        "text": text,
    }
    try:
        response = httpx.post(
            settings.whatsapp_api_url,
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.whatsapp_api_token}",
                "Content-Type": "application/json",
            },
            timeout=20,
        )
        if response.status_code >= 400:
            return {
                "channel": "whatsapp",
                "status": FAILED,
                "delivered": False,
                "providerConfigured": True,
                "liveVerified": False,
                "message": f"Provider HTTP {response.status_code}",
            }
        return {
            "channel": "whatsapp",
            "status": SENT,
            "delivered": True,
            "providerConfigured": True,
            "liveVerified": True,
            "message": "Provider accepted message",
        }
    except Exception as exc:  # noqa: BLE001
        log.warning("whatsapp_send_failed")
        return {
            "channel": "whatsapp",
            "status": FAILED,
            "delivered": False,
            "providerConfigured": True,
            "liveVerified": False,
            "message": f"WhatsApp error: {type(exc).__name__}",
        }
