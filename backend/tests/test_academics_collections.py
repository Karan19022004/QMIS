"""Principal academics collections: class timetables + teacher allocations."""

import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-phase0-local"
os.environ["ENVIRONMENT"] = "development"

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

TEACHER = (settings.teacher_seed_email, settings.teacher_seed_password)


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


def _login(client, email: str, password: str):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _principal_headers(client):
    return _login(client, settings.principal_seed_email, settings.principal_seed_password)


def test_class_timetables_replace_and_list(client):
    headers = _principal_headers(client)
    payload = [
        {
            "id": "CTT100",
            "className": "Grade 9",
            "section": "A",
            "academicYear": "2026-2027",
            "term": "Term 1",
            "submittedDate": "17-10-2026",
            "approvalStatus": "Pending",
            "timelines": [
                {
                    "id": "TL-1",
                    "periodNumber": "1",
                    "day": "Monday",
                    "subject": "English",
                    "teacher": "Ms. Anitha Verma",
                    "startTime": "09:00",
                    "endTime": "09:45",
                }
            ],
        }
    ]
    put = client.put("/api/v1/academics/class-timetables", json=payload, headers=headers)
    assert put.status_code == 200, put.text
    assert put.json()[0]["id"] == "CTT100"

    get = client.get("/api/v1/academics/class-timetables", headers=headers)
    assert get.status_code == 200
    assert get.json()[0]["className"] == "Grade 9"


def test_teacher_allocations_replace(client):
    headers = _principal_headers(client)
    payload = [
        {
            "employeeId": "TEA-1001",
            "status": "Active",
            "classTeacher": {"academicYear": "2026–2027", "className": "Grade 10", "section": "A"},
            "teachingClasses": ["Grade 10"],
            "subjects": ["Mathematics"],
            "mappings": [
                {"id": "MAP-001", "className": "Grade 10", "section": "A", "subject": "Mathematics"}
            ],
        }
    ]
    put = client.put("/api/v1/academics/teacher-allocations", json=payload, headers=headers)
    assert put.status_code == 200, put.text
    assert put.json()[0]["employeeId"] == "TEA-1001"


def test_teacher_cannot_replace_timetables(client):
    headers = _login(client, TEACHER[0], TEACHER[1])
    put = client.put(
        "/api/v1/academics/class-timetables",
        json=[{"id": "CTT999", "className": "Grade 1", "section": "A", "timelines": []}],
        headers=headers,
    )
    assert put.status_code == 403


def test_online_classes_replace_and_list(client):
    headers = _principal_headers(client)
    payload = [
        {
            "id": "OC-2001",
            "onlineClassId": "OC-2001",
            "subject": "Mathematics",
            "className": "Grade 10",
            "section": "A",
            "topic": "Live revision",
            "date": "21-10-2026",
            "startTime": "09:00 AM",
            "endTime": "10:00 AM",
            "meetingPlatform": "Google Meet",
            "meetingLink": "https://meet.google.com/demo",
            "status": "Scheduled",
        }
    ]
    put = client.put("/api/v1/academics/online-classes", json=payload, headers=headers)
    assert put.status_code == 200, put.text
    assert put.json()[0]["id"] == "OC-2001"

    get = client.get("/api/v1/academics/online-classes", headers=headers)
    assert get.status_code == 200
    assert get.json()[0]["meetingPlatform"] == "Google Meet"


def test_extra_classes_replace_and_list(client):
    headers = _principal_headers(client)
    payload = [
        {
            "id": "EC-2001",
            "extraClassId": "EC-2001",
            "subject": "Science",
            "className": "9",
            "section": "A",
            "classSection": "9-A",
            "topic": "Forces",
            "date": "20-10-2026",
            "startTime": "03:00 PM",
            "endTime": "04:00 PM",
            "venue": "Lab 1",
            "reason": "Catch-up",
        }
    ]
    put = client.put("/api/v1/academics/extra-classes", json=payload, headers=headers)
    assert put.status_code == 200, put.text
    assert put.json()[0]["id"] == "EC-2001"

    get = client.get("/api/v1/academics/extra-classes", headers=headers)
    assert get.status_code == 200
    assert get.json()[0]["subject"] == "Science"


def test_teacher_can_file_change_request(client):
    headers = _login(client, TEACHER[0], TEACHER[1])
    put = client.put(
        "/api/v1/academics/class-timetable-change-requests",
        json=[
            {
                "id": "TCR-1",
                "className": "Grade 9",
                "section": "A",
                "day": "Monday",
                "requestedSubject": "Science",
                "reason": "Swap",
                "status": "Pending",
            }
        ],
        headers=headers,
    )
    assert put.status_code == 200, put.text
    assert put.json()[0]["id"] == "TCR-1"
