"""Parent portal shared APIs: children, announcements, calendar, notifications, results, attendance."""

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
PARENT_EMAIL = "parent.portal.full@example.com"
PARENT_PASSWORD = "Parent-Test-2026"


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


def _login(client, email, password):
    from auth_test_helpers import login_headers

    return login_headers(client, email, password)


def _enroll(client, admin):
    created = client.post(
        "/api/v1/admissions",
        headers=admin,
        json={
            "first_name": "Portal",
            "last_name": "Child",
            "mobile_number": "9000033333",
            "class_name": "Grade 5",
            "father_name": "Portal Parent",
            "parent_account_email": PARENT_EMAIL,
        },
    )
    assert created.status_code in (200, 201), created.text
    admission_id = created.json()["id"]
    enrolled = client.post(
        f"/api/v1/admissions/{admission_id}/enroll",
        headers=admin,
        json={"parent_account_email": PARENT_EMAIL, "parent_account_password": PARENT_PASSWORD},
    )
    assert enrolled.status_code == 200, enrolled.text
    return enrolled.json()["student_id"]


def test_parent_shared_reads_succeed(client):
    admin = _login(client, ADMIN[0], ADMIN[1])
    student_id = _enroll(client, admin)
    parent = _login(client, PARENT_EMAIL, PARENT_PASSWORD)

    children = client.get("/api/v1/parents/me/children", headers=parent)
    assert children.status_code == 200
    assert any(row["id"] == student_id for row in children.json())

    assert client.get("/api/v1/announcements", headers=parent).status_code == 200
    assert client.get("/api/v1/calendar", headers=parent).status_code == 200
    assert client.get("/api/v1/notifications", headers=parent).status_code == 200
    assert client.get("/api/v1/communication/conversations", headers=parent).status_code == 200

    results = client.get(f"/api/v1/results/students/{student_id}", headers=parent)
    assert results.status_code == 200, results.text

    attendance = client.get(
        f"/api/v1/attendance/students/{student_id}/calendar?year=2026&month=10",
        headers=parent,
    )
    assert attendance.status_code == 200, attendance.text
