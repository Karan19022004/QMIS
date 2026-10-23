"""Integrations without real credentials: NOT_CONFIGURED, mock outbox, webhook structure."""

import hashlib
import hmac
import json
import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-integrations-ready"
os.environ["INTEGRATIONS_MODE"] = ""
os.environ["ENVIRONMENT"] = "development"

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.integrations import payments, templates
from app.services.integrations.notify import notify_event, send_email, send_whatsapp


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


def _login(client: TestClient) -> dict:
    response = client.post("/api/v1/auth/login", json={"email": "accounthead@qmis.edu", "password": "accounts123"})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_notify_not_configured_without_credentials():
    email = send_email(to="parent@example.com", subject="t", body="b")
    assert email["status"] == "NOT_CONFIGURED"
    assert email["delivered"] is False
    assert email["liveVerified"] is False
    wa = send_whatsapp(to_phone="+919999999999", text="hello")
    assert wa["status"] == "NOT_CONFIGURED"
    assert wa["delivered"] is False


def test_notify_event_records_without_claiming_delivery():
    first = notify_event(
        event_key="unit-enroll-1",
        email="parent@example.com",
        subject="QMIS ERP enrollment recorded",
        body="Enrollment is recorded.",
    )
    assert first["status"] == "recorded"
    assert first["email"]["status"] == "NOT_CONFIGURED"
    assert first["email"]["delivered"] is False
    again = notify_event(
        event_key="unit-enroll-1",
        email="parent@example.com",
        subject="QMIS ERP enrollment recorded",
        body="Enrollment is recorded.",
    )
    assert again["status"] == "recorded"


def test_library_notice_needs_a_stored_email():
    from app.services.integrations.events import _borrower_email

    assert _borrower_email({"memberName": "Aarav", "status": "Issued"}, {}) == ""
    assert _borrower_email({"memberId": "LMB-1"}, {"LMB-1": "student@example.com"}) == "student@example.com"


def test_only_a_real_status_change_is_notified():
    from app.services.integrations.events import changed_public_ids

    previous = [{"id": "GVS-1", "status": "Inside", "phone": "999"}]
    same_status = [{"id": "GVS-1", "status": "Inside", "phone": "888"}]
    assert changed_public_ids(previous, same_status, ("status",)) == []
    updated = [{"id": "GVS-1", "status": "Exited"}]
    assert changed_public_ids(previous, updated, ("status",)) == ["GVS-1"]


def test_queued_notice_is_not_sent_twice(monkeypatch):
    from app.services.integrations import notify as notify_mod

    calls = []

    def fake_send(**kwargs):
        calls.append(kwargs["to"])
        return {"status": "MOCK_QUEUED", "delivered": False}

    monkeypatch.setattr(notify_mod, "send_email", fake_send)
    notify_mod._delivered_event_keys.discard("unit-dup")
    notify_mod.notify_event(event_key="unit-dup", email="a@example.com", subject="s", body="b")
    second = notify_mod.notify_event(event_key="unit-dup", email="a@example.com", subject="s", body="b")
    assert calls == ["a@example.com"]
    assert second["status"] == "skipped_duplicate"


def test_fee_receipt_templates_include_noreply_guidance():
    subject, text, html = templates.fee_receipt_email(
        school_name="Queen Mira International School",
        receipt_no="R-1",
        amount_label="₹1,000",
        student_name="Aarav",
        from_address="noreply@school.example",
    )
    assert "Fee receipt R-1" in subject
    assert "noreply@school.example" in text
    assert "non-reply" in html.lower() or "not monitored" in text.lower()
    wa = templates.fee_receipt_whatsapp(
        school_name="Queen Mira International School",
        receipt_no="R-1",
        amount_label="₹1,000",
        student_name="Aarav",
    )
    assert "R-1" in wa and "do not reply" in wa.lower()


def test_razorpay_webhook_not_configured(client):
    body = {"event": "payment.captured", "payload": {"payment": {"entity": {"id": "pay_x", "order_id": "order_x"}}}}
    raw = json.dumps(body).encode()
    response = client.post(
        "/api/v1/webhooks/razorpay",
        content=raw,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": "deadbeef"},
    )
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "NOT_CONFIGURED"


def test_razorpay_webhook_marks_paid_with_mock_secret(client, monkeypatch):
    monkeypatch.setenv("RAZORPAY_WEBHOOK_SECRET", "whsec_test_only")
    from app.core import config

    config.settings.razorpay_webhook_secret = "whsec_test_only"

    headers = _login(client)
    # Seed a snapshot link via demo mode intent, then flip webhook secret verify
    monkeypatch.setenv("INTEGRATIONS_MODE", "demo")
    config.settings.integrations_mode = "demo"
    intent = client.post(
        "/api/v1/finance/actions/gateway-intent",
        headers=headers,
        json={"studentId": "STU-WH", "amount": 500, "installmentIds": []},
    )
    assert intent.status_code == 200, intent.text
    order_id = intent.json()["intent"]["providerOrderId"]
    assert order_id

    body = {
        "event": "payment.captured",
        "payload": {"payment": {"entity": {"id": "pay_test_1", "order_id": order_id}}},
    }
    raw = json.dumps(body, separators=(",", ":")).encode()
    signature = hmac.new(b"whsec_test_only", raw, hashlib.sha256).hexdigest()
    response = client.post(
        "/api/v1/webhooks/razorpay",
        content=raw,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": signature},
    )
    assert response.status_code == 200, response.text
    assert response.json()["success"] is True
    # Demo mode + mock secret: paid via verified webhook shape, not a real Razorpay merchant.
    assert response.json().get("liveVerified") is False
    assert response.json().get("demo") is True


def test_signature_helper_rejects_empty():
    assert payments.verify_razorpay_signature(order_id="", payment_id="p", signature="s") is False
    assert payments.verify_webhook_signature(body=b"{}", signature="") is False


def test_gateway_confirm_rejects_invalid_signature(client, monkeypatch):
    monkeypatch.setenv("INTEGRATIONS_MODE", "demo")
    from app.core import config

    config.settings.integrations_mode = "demo"
    headers = _login(client)
    intent = client.post(
        "/api/v1/finance/actions/gateway-intent",
        headers=headers,
        json={"studentId": "STU-SIG", "amount": 500, "installmentIds": []},
    )
    assert intent.status_code == 200, intent.text
    body = intent.json()["intent"]
    bad = client.post(
        "/api/v1/finance/actions/gateway-confirm",
        headers=headers,
        json={
            "reference": body["reference"],
            "razorpay_order_id": body["providerOrderId"],
            "razorpay_payment_id": "pay_bad",
            "razorpay_signature": "0" * 64,
        },
    )
    assert bad.status_code == 400, bad.text
    assert bad.json()["detail"]["code"] == "invalid_signature"


def test_razorpay_webhook_invalid_signature_and_duplicate(client, monkeypatch):
    monkeypatch.setenv("RAZORPAY_WEBHOOK_SECRET", "whsec_dup_test")
    monkeypatch.setenv("INTEGRATIONS_MODE", "demo")
    from app.core import config

    config.settings.razorpay_webhook_secret = "whsec_dup_test"
    config.settings.integrations_mode = "demo"

    headers = _login(client)
    intent = client.post(
        "/api/v1/finance/actions/gateway-intent",
        headers=headers,
        json={"studentId": "STU-DUP", "amount": 700, "installmentIds": []},
    )
    assert intent.status_code == 200, intent.text
    order_id = intent.json()["intent"]["providerOrderId"]

    body = {
        "event": "payment.captured",
        "payload": {"payment": {"entity": {"id": "pay_dup_1", "order_id": order_id}}},
    }
    raw = json.dumps(body, separators=(",", ":")).encode()
    bad = client.post(
        "/api/v1/webhooks/razorpay",
        content=raw,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": "deadbeef"},
    )
    assert bad.status_code == 400
    assert bad.json()["detail"]["code"] == "invalid_signature"

    signature = hmac.new(b"whsec_dup_test", raw, hashlib.sha256).hexdigest()
    first = client.post(
        "/api/v1/webhooks/razorpay",
        content=raw,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": signature},
    )
    assert first.status_code == 200, first.text
    assert first.json()["success"] is True
    assert first.json().get("skipped") is not True

    second = client.post(
        "/api/v1/webhooks/razorpay",
        content=raw,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": signature},
    )
    assert second.status_code == 200, second.text
    assert second.json()["skipped"] is True
    assert second.json()["reason"] == "already_paid"
