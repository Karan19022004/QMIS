"""Student portal shared APIs: /students/me, announcements, calendar, notifications, results, attendance, TC."""

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
PARENT_EMAIL = "parent.for.student.portal@example.com"
PARENT_PASSWORD = "Parent-Test-2026"
STUDENT_EMAIL = "student.portal.full@example.com"
STUDENT_PASSWORD = "Student-Test-2026"


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


def _login(client, email, password):
    from auth_test_helpers import login_headers

    return login_headers(client, email, password)


def _enroll_with_student_login(client, admin):
    created = client.post(
        "/api/v1/admissions",
        headers=admin,
        json={
            "first_name": "Portal",
            "last_name": "Learner",
            "mobile_number": "9000044444",
            "class_name": "Grade 6",
            "father_name": "Portal Parent",
            "parent_account_email": PARENT_EMAIL,
        },
    )
    assert created.status_code in (200, 201), created.text
    admission_id = created.json()["id"]
    enrolled = client.post(
        f"/api/v1/admissions/{admission_id}/enroll",
        headers=admin,
        json={
            "parent_account_email": PARENT_EMAIL,
            "parent_account_password": PARENT_PASSWORD,
            "skip_student_account": False,
            "student_account_email": STUDENT_EMAIL,
            "student_account_password": STUDENT_PASSWORD,
        },
    )
    assert enrolled.status_code == 200, enrolled.text
    body = enrolled.json()
    assert body.get("student_user_id")
    assert body.get("student_created") is True
    return body["student_id"]


def test_student_shared_reads_and_tc_scope(client):
    admin = _login(client, ADMIN[0], ADMIN[1])
    student_id = _enroll_with_student_login(client, admin)
    student = _login(client, STUDENT_EMAIL, STUDENT_PASSWORD)

    me = client.get("/api/v1/students/me", headers=student)
    assert me.status_code == 200, me.text
    assert me.json()["id"] == student_id

    assert client.get("/api/v1/announcements", headers=student).status_code == 200
    assert client.get("/api/v1/calendar", headers=student).status_code == 200
    assert client.get("/api/v1/notifications", headers=student).status_code == 200
    assert client.get("/api/v1/communication/conversations", headers=student).status_code == 200

    results = client.get(f"/api/v1/results/students/{student_id}", headers=student)
    assert results.status_code == 200, results.text

    attendance = client.get(
        f"/api/v1/attendance/students/{student_id}/calendar?year=2026&month=10",
        headers=student,
    )
    assert attendance.status_code == 200, attendance.text

    created_tc = client.post(
        "/api/v1/tc-requests",
        headers=student,
        json={
            "studentRef": student_id,
            "reason": "Family relocation for student portal test.",
            "transferTo": "Demo CBSE School",
            "lastDateOfAttendance": "2026-10-20",
            "requestedBy": "Student",
        },
    )
    assert created_tc.status_code == 201, created_tc.text
    tc_id = created_tc.json()["id"]

    listed = client.get("/api/v1/tc-requests", headers=student)
    assert listed.status_code == 200, listed.text
    assert any(row["id"] == tc_id for row in listed.json())

    forwarded = client.post(
        f"/api/v1/tc-requests/{tc_id}/forward",
        headers=student,
        json={"remarks": "should fail"},
    )
    assert forwarded.status_code == 403

    # Parent may not use /students/me
    parent = _login(client, PARENT_EMAIL, PARENT_PASSWORD)
    assert client.get("/api/v1/students/me", headers=parent).status_code == 403
