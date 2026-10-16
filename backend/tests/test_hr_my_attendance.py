"""GET /hr/attendance/mine — signed-in staff only."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)


def _login(email: str, password: str) -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_mine_requires_auth():
    assert client.get("/api/v1/hr/attendance/mine").status_code == 401


def test_director_mine_does_not_leak_campus_attendance():
    admin = _login(settings.admin_seed_email, settings.admin_seed_password)
    director = _login(settings.director_seed_email, settings.director_seed_password)

    campus = client.get("/api/v1/hr/attendance", headers=admin)
    assert campus.status_code == 200
    campus_rows = campus.json()
    assert len(campus_rows) >= 1
    campus_employee_ids = {row["employeeId"] for row in campus_rows if row.get("employeeId")}

    mine = client.get("/api/v1/hr/attendance/mine", headers=director)
    assert mine.status_code == 200
    rows = mine.json()
    assert isinstance(rows, list)
    # Director seed user is not linked to an HrEmployee in the demo DB, so the list is empty.
    # Even if linked later, every returned row must belong to a single employeeId.
    assert len({row.get("employeeId") for row in rows}) <= 1
    # Must never surface arbitrary campus peers when the actor has no (or a different) link.
    if not rows:
        assert campus_employee_ids  # campus still has data; mine correctly hid it
    else:
        only = rows[0]["employeeId"]
        assert all(row.get("employeeId") == only for row in rows)


def test_teacher_mine_is_at_most_one_employee():
    teacher = _login(settings.teacher_seed_email, settings.teacher_seed_password)
    mine = client.get("/api/v1/hr/attendance/mine", headers=teacher)
    assert mine.status_code == 200
    rows = mine.json()
    assert isinstance(rows, list)
    assert len({row.get("employeeId") for row in rows}) <= 1


def test_director_cannot_overwrite_campus_attendance():
    director = _login(settings.director_seed_email, settings.director_seed_password)
    denied = client.put(
        "/api/v1/hr/attendance",
        headers=director,
        json=[{"id": "ATT-HACK", "employeeId": "EMP-2026-001", "date": "01-01-2026", "status": "Present"}],
    )
    assert denied.status_code == 403


def test_seed_director_login_has_no_hreemployee_email_match():
    """Demo seed users are auth-only; identity for attendance is HrEmployee.user_id or email.

    Seed creates User(director@qmis.edu) but does not create a matching HrEmployee.
    /attendance/mine must therefore stay empty without fabricating punches.
    """
    director = _login(settings.director_seed_email, settings.director_seed_password)
    portal = client.get("/api/v1/hr/portal/employees", headers=director)
    assert portal.status_code == 200
    emails = {str(row.get("email") or "").lower() for row in portal.json()}
    assert settings.director_seed_email.lower() not in emails

    mine = client.get("/api/v1/hr/attendance/mine", headers=director)
    assert mine.status_code == 200
    assert mine.json() == []
