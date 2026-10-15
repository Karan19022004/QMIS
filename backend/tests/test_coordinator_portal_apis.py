"""Coordinator portal shared APIs (same staff academic bundle as teacher + exams.write)."""

import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-phase0-local"
os.environ["ENVIRONMENT"] = "development"

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

COORDINATOR = (settings.coordinator_seed_email, settings.coordinator_seed_password)


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


def _login(client, email, password):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_coordinator_shared_reads_and_exams_write(client):
    headers = _login(client, COORDINATOR[0], COORDINATOR[1])

    assert client.get("/api/v1/students", headers=headers).status_code == 200
    assert client.get("/api/v1/announcements", headers=headers).status_code == 200
    assert client.get("/api/v1/calendar", headers=headers).status_code == 200
    assert client.get("/api/v1/notifications", headers=headers).status_code == 200
    assert client.get("/api/v1/communication/conversations", headers=headers).status_code == 200
    assert client.get("/api/v1/lesson-plans", headers=headers).status_code == 200
    assert client.get("/api/v1/exams", headers=headers).status_code == 200
    assert client.get("/api/v1/attendance?date=2026-10-15", headers=headers).status_code == 200

    created = client.post(
        "/api/v1/exams",
        headers=headers,
        json={
            "name": "Coordinator Midterm",
            "examType": "MIDTERM",
            "className": "Grade 6",
            "startDate": "2026-11-01",
            "endDate": "2026-11-05",
        },
    )
    assert created.status_code == 201, created.text
