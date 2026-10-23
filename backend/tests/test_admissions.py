import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-admissions"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


def _login(client: TestClient) -> dict:
    response = client.post("/api/v1/auth/login", json={"email": "admin@qmis.edu", "password": "admin123"})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_rich_enquiry_admission_enroll_with_parent(client):
    headers = _login(client)

    enquiry = client.post(
        "/api/v1/admissions/enquiries",
        json={
            "name": "Aariv Kumar",
            "mobile_number": "9876543210",
            "class_name": "Grade 1",
            "email": "parent.aariv@example.com",
            "source": "Walk-in",
            "city": "Madurai",
        },
        headers=headers,
    )
    assert enquiry.status_code == 201, enquiry.text
    body = enquiry.json()
    assert body["enquiry_code"].startswith("AE-")
    assert body["name"] == "Aariv Kumar"
    assert body["status"] == "Active"
    enquiry_id = body["id"]

    listed = client.get("/api/v1/admissions/enquiries", headers=headers)
    assert listed.status_code == 200
    assert any(row["id"] == enquiry_id for row in listed.json())

    converted = client.post(f"/api/v1/admissions/enquiries/{enquiry_id}/convert", headers=headers)
    assert converted.status_code == 200, converted.text
    admission = converted.json()
    assert admission["admission_code"].startswith("ADM-")
    assert admission["first_name"] == "Aariv"
    assert admission["status"] == "Active"
    admission_id = admission["id"]

    patched = client.patch(
        f"/api/v1/admissions/{admission_id}",
        json={
            "first_name": "Aariv",
            "last_name": "Kumar",
            "mobile_number": "9876543210",
            "class_name": "Grade 1",
            "father_name": "Meena Kumar",
            "parent_account_email": "parent.aariv@example.com",
        },
        headers=headers,
    )
    assert patched.status_code == 200, patched.text

    enrolled = client.post(
        f"/api/v1/admissions/{admission_id}/enroll",
        json={
            "parent_account_email": "parent.aariv@example.com",
            "parent_account_password": "Parent-Test-2026",
        },
        headers=headers,
    )
    assert enrolled.status_code == 200, enrolled.text
    result = enrolled.json()
    assert result["student_code"].startswith("ADM-")
    assert result["parent_created"] is True
    assert result["parent_user_id"]
    assert result["admission"]["status"] == "Enrolled"

    # Parent can authenticate with the enroll credentials (synthetic — no school data needed).
    parent_login = client.post(
        "/api/v1/auth/login",
        json={"email": "parent.aariv@example.com", "password": "Parent-Test-2026"},
    )
    assert parent_login.status_code == 200, parent_login.text
    assert parent_login.json()["role"] == "parent"
    assert parent_login.json()["must_change_password"] is True
    from auth_test_helpers import login_headers

    parent_headers = login_headers(client, "parent.aariv@example.com", "Parent-Test-2026")
    parent_me = client.get("/api/v1/auth/me", headers=parent_headers)
    assert parent_me.status_code == 200
    assert parent_me.json()["role"] == "parent"
    assert parent_me.json()["email"] == "parent.aariv@example.com"
    children = client.get("/api/v1/parents/me/children", headers=parent_headers)
    assert children.status_code == 200, children.text
    assert len(children.json()) == 1
    assert children.json()[0]["name"] == "Aariv Kumar"
    assert children.json()[0]["admissionNumber"] == result["student_code"]

    again = client.post(
        f"/api/v1/admissions/{admission_id}/enroll",
        json={"skip_parent_account": True},
        headers=headers,
    )
    assert again.status_code == 409


def test_create_admission_direct(client):
    headers = _login(client)
    created = client.post(
        "/api/v1/admissions",
        json={
            "first_name": "Diya",
            "mobile_number": "9000000001",
            "class_name": "Grade 2",
            "gender": "Female",
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    assert created.json()["admission_code"].startswith("ADM-")
    rows = client.get("/api/v1/admissions", headers=headers)
    assert rows.status_code == 200
    assert any(row["first_name"] == "Diya" for row in rows.json())


def test_enroll_with_student_email_but_no_password_skips_student_login(client):
    """Student portal login is optional — missing password must not crash enroll."""
    headers = _login(client)
    created = client.post(
        "/api/v1/admissions",
        json={
            "first_name": "Kabir",
            "mobile_number": "9000000099",
            "class_name": "Grade 1",
            "parent_account_email": "parent.kabir@example.com",
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    admission_id = created.json()["id"]

    enrolled = client.post(
        f"/api/v1/admissions/{admission_id}/enroll",
        json={
            "parent_account_email": "parent.kabir@example.com",
            "parent_account_password": "Parent-Test-2026",
            "skip_student_account": False,
            "student_account_email": "student.kabir@example.com",
            # student_account_password omitted on purpose
        },
        headers=headers,
    )
    assert enrolled.status_code == 200, enrolled.text
    body = enrolled.json()
    assert body["admission"]["status"] == "Enrolled"
    assert body["student_id"]
    assert body["student_created"] is False
    assert body["student_user_id"] is None
    assert body["parent_created"] is True
