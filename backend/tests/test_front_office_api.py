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


def test_admin_can_create_update_and_list_hostel_gate_pass(client):
    headers = _login(client, ADMIN)
    created = client.post(
        "/api/v1/front-office/hostel-gate-passes",
        headers=headers,
        json={
            "studentId": "STU-H1",
            "studentName": "Hostel Student",
            "classSection": "8-A",
            "hostel": "QMIS Hostel",
            "leaveType": "Home Visit",
            "reason": "Family event",
            "outDate": "14-10-2026",
            "outTime": "16:00",
            "returnDate": "16-10-2026",
            "returnTime": "18:00",
            "status": "Pending",
            "parentApproval": "Pending",
            "wardenApproval": "Pending",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["id"].startswith("HGP-")
    assert body["hostel"] == "QMIS Hostel"

    updated = client.put(
        f"/api/v1/front-office/hostel-gate-passes/{body['id']}",
        headers=headers,
        json={**body, "status": "Checked Out", "wardenApproval": "Approved"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["status"] == "Checked Out"

    listed = client.get("/api/v1/front-office/hostel-gate-passes", headers=headers)
    assert listed.status_code == 200
    row = next(r for r in listed.json() if r["id"] == body["id"])
    assert row["status"] == "Checked Out"


def test_admin_can_create_and_list_material_gate_pass(client):
    headers = _login(client, ADMIN)
    created = client.post(
        "/api/v1/front-office/material-gate-passes",
        headers=headers,
        json={
            "passType": "Non-Returnable",
            "date": "14-10-2026",
            "time": "10:00",
            "timePeriod": "AM",
            "driverName": "Ravi",
            "vehicleNo": "TN-01-AB-1234",
            "materials": [
                {
                    "id": "row-1",
                    "description": "Chairs",
                    "quantity": 4,
                    "destination": "Hall",
                    "remarks": "",
                }
            ],
            "approvals": {},
            "status": "Pending",
            "createdBy": "Front Office",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["id"].startswith("MGP-")
    assert body["driverName"] == "Ravi"

    listed = client.get("/api/v1/front-office/material-gate-passes", headers=headers)
    assert listed.status_code == 200
    assert any(row["id"] == body["id"] for row in listed.json())


def test_admin_can_create_and_list_student_transfer(client):
    headers = _login(client, ADMIN)
    created = client.post(
        "/api/v1/front-office/student-transfers",
        headers=headers,
        json={
            "studentName": "Transfer Student",
            "transferType": "Outward",
            "transferTo": "Another School",
            "className": "Grade 5",
            "reason": "Relocation",
            "requestedOn": "14-10-2026",
            "mdApprovalStatus": "Pending",
            "status": "In Progress",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["id"]
    assert body["studentName"] == "Transfer Student"
    assert body.get("transferType") == "Outward"

    listed = client.get("/api/v1/front-office/student-transfers", headers=headers)
    assert listed.status_code == 200
    assert any(row["id"] == body["id"] for row in listed.json())

    fetched = client.get(f"/api/v1/front-office/student-transfers/{body['id']}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["reason"] == "Relocation"
