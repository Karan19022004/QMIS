import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-approvals"

import pytest
from fastapi.testclient import TestClient

from app.main import app

USERS = {
    "teacher": ("teacher@qmis.edu", "teacher123"),
    "coordinator": ("coordinator@qmis.edu", "coord123"),
    "principal": ("principal@qmis.edu", "principal123"),
    "director": ("director@qmis.edu", "director123"),
}


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


def _h(client, who: str) -> dict:
    email, password = USERS[who]
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _submit(client, headers, entity_id="LP-1"):
    return client.post(
        "/api/v1/approvals",
        json={"entityType": "section_change", "entityId": entity_id, "title": "Maths Week 1"},
        headers=headers,
    )


def test_full_chain_approves_and_notifies(client):
    teacher = _h(client, "teacher")
    created = _submit(client, teacher)
    assert created.status_code == 201, created.text
    aid = created.json()["id"]
    assert created.json()["awaitingRole"] == "coordinator"

    # duplicate pending is blocked
    assert _submit(client, teacher).status_code == 409

    for who, nxt in [("coordinator", "principal"), ("principal", "director"), ("director", None)]:
        h = _h(client, who)
        inbox = client.get("/api/v1/approvals/inbox", headers=h).json()
        assert any(i["id"] == aid for i in inbox)
        notes = client.get("/api/v1/notifications", headers=h).json()
        assert any("Approval needed" in n["title"] for n in notes)
        d = client.post(f"/api/v1/approvals/{aid}/decide", json={"decision": "approve"}, headers=h)
        assert d.status_code == 200, d.text
        assert d.json()["awaitingRole"] == nxt

    final = client.get(f"/api/v1/approvals/{aid}", headers=teacher).json()
    assert final["status"] == "approved"
    assert [e["action"] for e in final["events"]] == ["submit", "approve", "approve", "approve"]
    notes = client.get("/api/v1/notifications", headers=teacher).json()
    assert any(n["title"].startswith("Approved") for n in notes)


def test_wrong_role_and_self_decision_blocked(client):
    teacher = _h(client, "teacher")
    aid = _submit(client, teacher, "LP-2").json()["id"]
    # principal is not the current level (coordinator is)
    r = client.post(
        f"/api/v1/approvals/{aid}/decide", json={"decision": "approve"}, headers=_h(client, "principal")
    )
    assert r.status_code == 403
    # initiator cannot decide
    r = client.post(f"/api/v1/approvals/{aid}/decide", json={"decision": "approve"}, headers=teacher)
    assert r.status_code == 403


def test_deny_needs_reason_then_resubmit_keeps_history(client):
    teacher = _h(client, "teacher")
    coord = _h(client, "coordinator")
    aid = _submit(client, teacher, "LP-3").json()["id"]
    assert (
        client.post(f"/api/v1/approvals/{aid}/decide", json={"decision": "deny"}, headers=coord).status_code
        == 400
    )
    denied = client.post(
        f"/api/v1/approvals/{aid}/decide",
        json={"decision": "deny", "comment": "Missing objectives"},
        headers=coord,
    )
    assert denied.status_code == 200
    assert denied.json()["status"] == "denied"
    # cannot decide again
    again = client.post(f"/api/v1/approvals/{aid}/decide", json={"decision": "approve"}, headers=coord)
    assert again.status_code == 409

    second = _submit(client, teacher, "LP-3")
    assert second.status_code == 201
    history = client.get(
        "/api/v1/approvals/lookup", params={"entityType": "section_change", "entityId": "LP-3"}, headers=teacher
    ).json()
    assert [h["status"] for h in history] == ["denied", "pending"]


def test_submit_permissions_and_custom_chain(client):
    assert (
        client.post(
            "/api/v1/approvals",
            json={"entityType": "timetable", "entityId": "T-1"},
            headers=_h(client, "teacher"),
        ).status_code
        == 403
    )
    ok = client.post(
        "/api/v1/approvals",
        json={"entityType": "gate_pass", "entityId": "GP-1", "chain": ["principal", "director"]},
        headers=_h(client, "teacher"),
    )
    assert ok.status_code == 201
    bad = client.post(
        "/api/v1/approvals",
        json={"entityType": "gate_pass", "entityId": "GP-2", "chain": ["nobody"]},
        headers=_h(client, "teacher"),
    )
    assert bad.status_code == 400


def test_mark_notification_read(client):
    teacher = _h(client, "teacher")
    _submit(client, teacher, "LP-9")
    coord = _h(client, "coordinator")
    notes = client.get("/api/v1/notifications", params={"unreadOnly": True}, headers=coord).json()
    assert notes
    r = client.post(f"/api/v1/notifications/{notes[0]['id']}/read", headers=coord)
    assert r.status_code == 200 and r.json()["read"] is True
