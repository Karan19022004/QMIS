"""Front Office campus records API (PRM gate passes / transfers / re-enrollment)."""

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


def _login(client, who):
    response = client.post("/api/v1/auth/login", json={"email": who[0], "password": who[1]})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_admin_can_create_and_list_student_gate_pass(client):
    headers = _login(client, ADMIN)
    created = client.post(
        "/api/v1/front-office/student-gate-passes",
        headers=headers,
        json={
            "studentId": "STU-1",
            "studentName": "Test Student",
            "classSection": "1-A",
            "reason": "Medical",
            "date": "14-10-2026",
            "outTime": "14:00",
            "status": "Pending",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["id"].startswith("SGP-")
    assert body["studentName"] == "Test Student"

    listed = client.get("/api/v1/front-office/student-gate-passes", headers=headers)
    assert listed.status_code == 200
    assert any(row["id"] == body["id"] for row in listed.json())


def test_teacher_denied_front_office_collection(client):
    headers = _login(client, TEACHER)
    response = client.get("/api/v1/front-office/student-gate-passes", headers=headers)
    assert response.status_code == 403
