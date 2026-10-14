"""Parent portal announcements: read shared notices (incl. student-targeted)."""

import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-phase0-local"
os.environ["ENVIRONMENT"] = "development"

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.services.announcements import DEFAULT_AUDIENCE

ADMIN = (settings.admin_seed_email, settings.admin_seed_password)
PARENT_EMAIL = "parent.ann.demo@example.com"
PARENT_PASSWORD = "Parent-Test-2026"


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


def _login(client, email, password):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_default_audience_includes_parent():
    assert "parent" in DEFAULT_AUDIENCE
    assert "student" in DEFAULT_AUDIENCE


def test_parent_sees_admin_broadcast_announcement(client):
    admin = _login(client, ADMIN[0], ADMIN[1])
    created = client.post(
        "/api/v1/admissions",
        headers=admin,
        json={
            "first_name": "AnnChild",
            "last_name": "Demo",
            "mobile_number": "9000077777",
            "class_name": "Grade 1",
            "father_name": "Ann Parent",
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

    notice = client.post(
        "/api/v1/announcements",
        headers=admin,
        data={
            "title": "Parent portal notice",
            "category": "General Announcement",
            "message": "Visible to parents via shared announcements API.",
        },
    )
    assert notice.status_code == 201, notice.text
    notice_id = notice.json()["id"]

    parent = _login(client, PARENT_EMAIL, PARENT_PASSWORD)
    listed = client.get("/api/v1/announcements", headers=parent)
    assert listed.status_code == 200, listed.text
    assert notice_id in [row["id"] for row in listed.json()]

    detail = client.get(f"/api/v1/announcements/{notice_id}", headers=parent)
    assert detail.status_code == 200
    assert detail.json()["title"] == "Parent portal notice"
