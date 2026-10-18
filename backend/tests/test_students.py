import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-students"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


def _login(client: TestClient, email: str = "admin@qmis.edu", password: str = "admin123") -> dict:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _enroll_one(client: TestClient, headers: dict) -> dict:
    enquiry = client.post(
        "/api/v1/admissions/enquiries",
        json={
            "name": "Riya Shah",
            "mobile_number": "9888877777",
            "class_name": "Grade 2",
            "email": "parent.riya@example.com",
            "city": "Madurai",
        },
        headers=headers,
    )
    assert enquiry.status_code == 201, enquiry.text
    enquiry_id = enquiry.json()["id"]

    converted = client.post(f"/api/v1/admissions/enquiries/{enquiry_id}/convert", headers=headers)
    assert converted.status_code == 200, converted.text
    admission_id = converted.json()["id"]

    client.patch(
        f"/api/v1/admissions/{admission_id}",
        json={
            "first_name": "Riya",
            "last_name": "Shah",
            "mobile_number": "9888877777",
            "class_name": "Grade 2",
            "gender": "Female",
            "father_name": "Amit Shah",
            "parent_account_email": "parent.riya@example.com",
            "city": "Madurai",
            "state": "Tamil Nadu",
            "country": "India",
        },
        headers=headers,
    )

    enrolled = client.post(
        f"/api/v1/admissions/{admission_id}/enroll",
        json={
            "parent_account_email": "parent.riya@example.com",
            "parent_account_password": "Parent-Test-2026",
        },
        headers=headers,
    )
    assert enrolled.status_code == 200, enrolled.text
    return enrolled.json()


def test_student_list_and_detail(client):
    headers = _login(client)
    result = _enroll_one(client, headers)
    student_id = result["student_id"]

    listed = client.get("/api/v1/students", headers=headers)
    assert listed.status_code == 200, listed.text
    rows = listed.json()
    assert any(row["id"] == student_id for row in rows)
    match = next(row for row in rows if row["id"] == student_id)
    assert match["name"] == "Riya Shah"
    assert match["admissionNumber"] == result["student_code"]
    assert match["className"] == "Grade 2"
    assert match["gender"] == "Female"

    detail = client.get(f"/api/v1/students/{student_id}", headers=headers)
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["firstName"] == "Riya"
    assert body["lastName"] == "Shah"
    assert body["fatherName"] == "Amit Shah"
    assert body["city"] == "Madurai"
    assert isinstance(body["guardians"], list)
    assert len(body["guardians"]) >= 1
    assert body["guardians"][0]["fullName"] == "Amit Shah"


def test_parent_cannot_list_campus_students(client):
    headers = _login(client)
    _enroll_one(client, headers)

    parent_login = client.post(
        "/api/v1/auth/login",
        json={"email": "parent.riya@example.com", "password": "Parent-Test-2026"},
    )
    assert parent_login.status_code == 200, parent_login.text
    parent_headers = {"Authorization": f"Bearer {parent_login.json()['access_token']}"}

    denied = client.get("/api/v1/students", headers=parent_headers)
    assert denied.status_code == 403


def test_teacher_can_list_students(client):
    admin = _login(client)
    enrolled = _enroll_one(client, admin)
    student_id = enrolled["student_id"]

    teacher = _login(client, "teacher@qmis.edu", "teacher123")
    me = client.get("/api/v1/auth/me", headers=teacher)
    assert me.status_code == 200, me.text
    teacher_user_id = me.json()["id"]

    # Assign seed teacher as class teacher of Grade 2 so roster scope is non-empty.
    classes = client.get("/api/v1/masters/classes", headers=admin)
    assert classes.status_code == 200, classes.text
    grade2 = next(
        (row for row in classes.json() if str(row.get("name") or "").lower() in {"grade 2", "2"}),
        None,
    )
    assert grade2 is not None, classes.json()
    sections = client.get(f"/api/v1/masters/sections?class_id={grade2['id']}", headers=admin)
    if sections.status_code != 200 or not sections.json():
        created = client.post(
            "/api/v1/masters/sections",
            headers=admin,
            json={"class_id": grade2["id"], "name": "A", "class_teacher_user_id": teacher_user_id},
        )
        assert created.status_code in {200, 201}, created.text
    else:
        section_id = sections.json()[0]["id"]
        patched = client.patch(
            f"/api/v1/masters/sections/{section_id}",
            headers=admin,
            json={"class_teacher_user_id": teacher_user_id},
        )
        assert patched.status_code == 200, patched.text

    listed = client.get("/api/v1/students", headers=teacher)
    assert listed.status_code == 200, listed.text
    ids = {row["id"] for row in listed.json()}
    assert student_id in ids

    parents = client.get("/api/v1/parents", headers=teacher)
    assert parents.status_code == 200, parents.text
    assert any(row.get("studentId") == student_id for row in parents.json())
