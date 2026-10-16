"""Teacher portal shared APIs: students, attendance, lesson-plans, exams, announcements, calendar, notifications."""

import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-phase0-local"
os.environ["ENVIRONMENT"] = "development"

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

ADMIN = (settings.admin_seed_email, settings.admin_seed_password)
TEACHER = (settings.teacher_seed_email, settings.teacher_seed_password)


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


def _login(client, email, password):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_teacher_shared_reads_succeed(client):
    teacher = _login(client, TEACHER[0], TEACHER[1])

    me = client.get("/api/v1/auth/me", headers=teacher)
    assert me.status_code == 200
    perms = set(me.json().get("permissions") or [])
    assert "students.read" in perms
    assert "exams.read" in perms
    assert "exams.write" not in perms
    assert "hr.employees.read" not in perms
    assert "hr.write" not in perms

    assert client.get("/api/v1/students", headers=teacher).status_code == 200
    assert client.get("/api/v1/announcements", headers=teacher).status_code == 200
    assert client.get("/api/v1/calendar", headers=teacher).status_code == 200
    assert client.get("/api/v1/notifications", headers=teacher).status_code == 200
    assert client.get("/api/v1/communication/conversations", headers=teacher).status_code == 200
    assert client.get("/api/v1/lesson-plans?mine=true", headers=teacher).status_code == 200
    assert client.get("/api/v1/exams", headers=teacher).status_code == 200
    assert client.get("/api/v1/marks-batches?mine=true", headers=teacher).status_code == 200
    assert client.get("/api/v1/admin/users", headers=teacher).status_code == 403
    assert client.post(
        "/api/v1/exams",
        headers=teacher,
        json={"name": "Blocked", "examType": "MIDTERM", "className": "G1", "startDate": "2026-11-01", "endDate": "2026-11-02"},
    ).status_code == 403

    attendance = client.get("/api/v1/attendance?date=2026-10-15", headers=teacher)
    assert attendance.status_code == 200, attendance.text


def test_teacher_can_create_lesson_plan(client):
    teacher = _login(client, TEACHER[0], TEACHER[1])
    created = client.post(
        "/api/v1/lesson-plans",
        headers=teacher,
        json={
            "className": "Grade 6",
            "section": "A",
            "subject": "Mathematics",
            "month": "2026-10",
            "title": "Fractions week 1",
            "content": {"weekNo": "1", "planningRows": []},
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["subject"] == "Mathematics"
    assert body["month"] == "2026-10"
