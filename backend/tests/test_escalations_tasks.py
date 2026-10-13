import os
from datetime import date, datetime, timedelta, timezone

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-escalations"

import pytest
from fastapi.testclient import TestClient

from app.main import app

USERS = {
    "admin": ("admin@qmis.edu", "admin123"),
    "teacher": ("teacher@qmis.edu", "teacher123"),
    "coordinator": ("coordinator@qmis.edu", "coord123"),
    "principal": ("principal@qmis.edu", "principal123"),
    "director": ("director@qmis.edu", "director123"),
    "hr": ("hr@qmis.edu", "hr12345"),
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


def _later(hours: float) -> str:
    return (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=hours)).isoformat()


def _raise(client, who="teacher", text="Projector in 8-A is broken"):
    return client.post("/api/v1/escalations", json={"description": text, "fullDescription": text + " (details)"},
                       headers=_h(client, who))


def _sweep(client, hours):
    return client.post("/api/v1/escalations/sla-sweep", params={"asOf": _later(hours)}, headers=_h(client, "admin"))


def _me(client, who):
    return client.get("/api/v1/auth/me", headers=_h(client, who)).json()


def _notes(client, who):
    return client.get("/api/v1/notifications", headers=_h(client, who)).json()


# ------------------------------------------------------------- escalations


def test_raise_goes_one_level_up_and_receiver_resolves_then_raiser_closes(client):
    created = _raise(client)
    assert created.status_code == 201, created.text
    esc = created.json()
    assert esc["status"] == "Pending" and esc["escalatedToRoleKey"] == "coordinator" and esc["level"] == 0
    assert esc["escalationId"].startswith("ESC-") and not esc["overdue"]

    # appears in the coordinator's received box and the teacher's sent box, not elsewhere
    got = client.get("/api/v1/escalations?box=received", headers=_h(client, "coordinator")).json()
    assert [e["id"] for e in got] == [esc["id"]]
    assert client.get("/api/v1/escalations?box=received", headers=_h(client, "principal")).json() == []
    assert [e["id"] for e in client.get("/api/v1/escalations?box=mine", headers=_h(client, "teacher")).json()] == [esc["id"]]
    assert any("Escalation" in n["title"] for n in _notes(client, "coordinator"))

    url = f"/api/v1/escalations/{esc['id']}/status"
    assert client.post(url, json={"status": "In Review"}, headers=_h(client, "teacher")).status_code == 403
    assert client.post(url, json={"status": "In Review"}, headers=_h(client, "principal")).status_code == 404
    assert client.post(url, json={"status": "In Review"}, headers=_h(client, "coordinator")).json()["status"] == "In Review"
    assert client.post(url, json={"status": "Resolved"}, headers=_h(client, "coordinator")).status_code == 400  # needs a note
    done = client.post(url, json={"status": "Resolved", "note": "Replaced the lamp"}, headers=_h(client, "coordinator"))
    assert done.status_code == 200 and done.json()["status"] == "Resolved"
    assert done.json()["resolutionNote"] == "Replaced the lamp"
    assert client.post(url, json={"status": "Rejected", "note": "x"}, headers=_h(client, "coordinator")).status_code == 409

    # the teacher is told, and only the raiser may close it
    assert any(n["title"].startswith("Escalation Resolved") for n in _notes(client, "teacher"))
    assert client.post(url, json={"status": "Closed"}, headers=_h(client, "coordinator")).status_code == 403
    closed = client.post(url, json={"status": "Closed"}, headers=_h(client, "teacher"))
    assert closed.status_code == 200 and closed.json()["status"] == "Closed"
    assert client.post(url, json={"status": "In Review"}, headers=_h(client, "coordinator")).status_code == 409
    actions = [t["action"] for t in client.get(f"/api/v1/escalations/{esc['id']}", headers=_h(client, "teacher")).json()["trail"]]
    assert actions == ["raised", "in_review", "resolved", "closed"]


def test_close_requires_settled_and_recipient_must_match_role(client):
    esc = _raise(client).json()
    url = f"/api/v1/escalations/{esc['id']}/status"
    assert client.post(url, json={"status": "Closed"}, headers=_h(client, "teacher")).status_code == 409  # still open
    # a named recipient must really be the coordinator
    principal_id = _me(client, "principal")["id"]
    bad = client.post("/api/v1/escalations", json={"description": "x", "recipientUserId": principal_id},
                      headers=_h(client, "teacher"))
    assert bad.status_code == 400
    coord_id = _me(client, "coordinator")["id"]
    ok = client.post("/api/v1/escalations", json={"description": "to named coordinator", "recipientUserId": coord_id},
                     headers=_h(client, "teacher"))
    assert ok.status_code == 201 and ok.json()["escalatedToUserId"] == coord_id


def test_24h_clock_auto_escalates_one_level_per_day_and_is_idempotent(client):
    esc = _raise(client).json()
    eid = esc["id"]
    assert client.post("/api/v1/escalations/sla-sweep", headers=_h(client, "teacher")).status_code == 403

    assert _sweep(client, 23).json()["autoEscalated"] == 0  # inside 24h: nothing moves
    assert _sweep(client, 25).json()["autoEscalated"] >= 1
    assert _sweep(client, 25).json()["autoEscalated"] == 0  # idempotent

    moved = client.get(f"/api/v1/escalations/{eid}", headers=_h(client, "principal")).json()
    assert moved["escalatedToRoleKey"] == "principal" and moved["level"] == 1 and moved["status"] == "Pending"
    # old owner keeps read access, new owner now receives it
    assert client.get(f"/api/v1/escalations/{eid}", headers=_h(client, "coordinator")).status_code == 200
    assert any(e["id"] == eid for e in client.get("/api/v1/escalations?box=received", headers=_h(client, "principal")).json())
    assert not any(e["id"] == eid for e in client.get("/api/v1/escalations?box=received", headers=_h(client, "coordinator")).json())
    assert any("not resolved" in n["title"].lower() for n in _notes(client, "teacher"))
    # the old owner can no longer act on it
    assert client.post(f"/api/v1/escalations/{eid}/status", json={"status": "In Review"},
                       headers=_h(client, "coordinator")).status_code == 403

    # two more days elapsed in one sweep: moves two levels (principal -> director -> admin)
    assert _sweep(client, 73).json()["autoEscalated"] >= 2
    final = client.get(f"/api/v1/escalations/{eid}", headers=_h(client, "admin")).json()
    assert final["escalatedToRoleKey"] == "admin" and final["level"] == 3


def test_overdue_flag_shows_and_top_level_only_notifies_once(client):
    esc = _raise(client, who="director", text="Budget freeze").json()  # director -> admin -> superadmin
    assert esc["escalatedToRoleKey"] == "admin"
    assert _sweep(client, 25).json()["autoEscalated"] >= 1
    assert _sweep(client, 60).json()["overdueAtTopLevel"] >= 1
    assert _sweep(client, 90).json()["overdueAtTopLevel"] == 0  # already flagged, no spam
    detail = client.get(f"/api/v1/escalations/{esc['id']}", headers=_h(client, "admin")).json()
    assert detail["escalatedToRoleKey"] == "superadmin"
    assert [t["action"] for t in detail["trail"]] == ["raised", "auto_escalated", "overdue_top_level"]
    # an unresolved item past its deadline reads as overdue in the receiver's list
    listing = client.get("/api/v1/escalations?box=all", headers=_h(client, "admin")).json()
    assert any(e["id"] == esc["id"] for e in listing)


def test_hr_cannot_raise_and_box_validation(client):
    assert _raise(client, who="hr").status_code == 403  # no escalation path for HR
    assert client.get("/api/v1/escalations?box=all", headers=_h(client, "teacher")).status_code == 403
    assert client.get("/api/v1/escalations?box=nonsense", headers=_h(client, "teacher")).status_code == 400
    assert client.get("/api/v1/escalations", headers={}).status_code in (401, 403)


# ------------------------------------------------------------------- tasks


def _task(client, who="principal", assignee="teacher", **over):
    body = {
        "assigneeId": _me(client, assignee)["id"],
        "title": "Submit class timetable",
        "description": "Before Friday",
        "priority": "High",
        "dueDate": (date.today() + timedelta(days=1)).isoformat(),
    }
    body.update(over)
    return client.post("/api/v1/tasks", json=body, headers=_h(client, who))


def test_task_assign_flow_only_assignee_moves_status(client):
    created = _task(client)
    assert created.status_code == 201, created.text
    task = created.json()
    assert task["status"] == "Incomplete" and task["assigneeRole"] == "teacher" and task["taskId"].startswith("TASK-")
    assert any("New task" in n["title"] for n in _notes(client, "teacher"))

    assert [t["id"] for t in client.get("/api/v1/tasks?box=mine", headers=_h(client, "teacher")).json()] == [task["id"]]
    assert [t["id"] for t in client.get("/api/v1/tasks?box=assigned", headers=_h(client, "principal")).json()] == [task["id"]]
    assert client.get("/api/v1/tasks?box=mine", headers=_h(client, "principal")).json() == []
    assert client.get(f"/api/v1/tasks/{task['id']}", headers=_h(client, "coordinator")).status_code == 404  # unrelated user

    url = f"/api/v1/tasks/{task['id']}/status"
    assert client.post(url, json={"status": "Completed"}, headers=_h(client, "principal")).status_code == 403
    assert client.post(url, json={"status": "Bogus"}, headers=_h(client, "teacher")).status_code == 400
    assert client.post(url, json={"status": "In Progress"}, headers=_h(client, "teacher")).json()["status"] == "In Progress"
    assert client.post(url, json={"status": "Incomplete"}, headers=_h(client, "teacher")).status_code == 409
    done = client.post(url, json={"status": "Completed"}, headers=_h(client, "teacher")).json()
    assert done["status"] == "Completed" and done["completedAt"]
    assert client.post(url, json={"status": "In Progress"}, headers=_h(client, "teacher")).status_code == 409  # no reopen
    assert any(n["title"].startswith("Task completed") for n in _notes(client, "principal"))


def test_task_validation(client):
    assert _task(client, dueDate=(date.today() - timedelta(days=1)).isoformat()).status_code == 400
    assert _task(client, priority="Urgent").status_code == 400
    assert _task(client, title="   ").status_code in (400, 422)
    assert _task(client, who="principal", assignee="principal").status_code == 400  # not to yourself
    assert client.get("/api/v1/tasks?box=all", headers=_h(client, "teacher")).status_code == 403
    people = client.get("/api/v1/tasks/assignees?role=teacher", headers=_h(client, "principal")).json()
    assert people and all(p["role"] == "teacher" for p in people)


def test_task_overdue_clock_notifies_once(client):
    task = _task(client).json()
    assert task["overdue"] is False
    first = _sweep(client, 24 * 5).json()
    assert first["overdueTasks"] >= 1
    assert _sweep(client, 24 * 5).json()["overdueTasks"] == 0
    assert any(n["title"].startswith("Task overdue") for n in _notes(client, "teacher"))
    assert any(n["title"].startswith("Task overdue") for n in _notes(client, "principal"))

    # a completed task never goes overdue
    other = _task(client, title="Collect forms").json()
    client.post(f"/api/v1/tasks/{other['id']}/status", json={"status": "Completed"}, headers=_h(client, "teacher"))
    assert _sweep(client, 24 * 9).json()["overdueTasks"] == 0
