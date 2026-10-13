"""Behaviours the Administrator Attendance screens depend on (existing endpoints, no new routes).

Students: GET /attendance by date (optionally class / section / roster) and the teacher write path.
Employees: GET /hr/attendance (a generic HR collection) joined in the browser with /hr/portal/employees.
"""

import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-phase0-local"

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

DAY = "2026-10-13"


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


def _login(client, email, password):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _admin(client):
    return _login(client, settings.admin_seed_email, settings.admin_seed_password)


def _teacher(client):
    return _login(client, settings.teacher_seed_email, settings.teacher_seed_password)


def _enroll(client, headers, name, cls, email):
    enquiry = client.post(
        "/api/v1/admissions/enquiries",
        json={"name": name, "mobile_number": "9777766666", "class_name": cls, "email": email},
        headers=headers,
    )
    assert enquiry.status_code == 201, enquiry.text
    converted = client.post(f"/api/v1/admissions/enquiries/{enquiry.json()['id']}/convert", headers=headers)
    assert converted.status_code == 200, converted.text
    admission_id = converted.json()["id"]
    client.patch(
        f"/api/v1/admissions/{admission_id}",
        json={
            "first_name": name.split()[0],
            "last_name": name.split()[-1],
            "mobile_number": "9777766666",
            "class_name": cls,
            "parent_account_email": email,
        },
        headers=headers,
    )
    enrolled = client.post(
        f"/api/v1/admissions/{admission_id}/enroll",
        json={"parent_account_email": email, "parent_account_password": "Parent-Test-2026"},
        headers=headers,
    )
    assert enrolled.status_code == 200, enrolled.text
    return str(enrolled.json()["student_id"])


def _mark(client, headers, cls, section, marks):
    response = client.post(
        "/api/v1/attendance",
        json={"date": DAY, "className": cls, "section": section, "marks": marks},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_admin_lists_every_mark_for_a_date_and_narrows_by_class_and_section(client):
    admin = _admin(client)
    a = _enroll(client, admin, "Asha Rao", "Grade 7", "adm.att.a@example.com")
    b = _enroll(client, admin, "Bala Nair", "Grade 8", "adm.att.b@example.com")
    _mark(client, admin, "Grade 7", "A", [{"studentId": a, "status": "Present", "inOutStatus": "On Time"}])
    _mark(client, admin, "Grade 8", "B", [{"studentId": b, "status": "Late"}])

    everything = client.get("/api/v1/attendance", params={"date": DAY}, headers=admin).json()
    by_student = {row["studentId"]: row for row in everything}
    assert by_student[a]["attendanceStatus"] == "Present" and by_student[a]["className"] == "Grade 7"
    assert by_student[b]["attendanceStatus"] == "Late" and by_student[b]["section"] == "B"

    only_seven = client.get("/api/v1/attendance", params={"date": DAY, "className": "Grade 7"}, headers=admin).json()
    assert {row["studentId"] for row in only_seven} == {a}
    only_b = client.get("/api/v1/attendance", params={"date": DAY, "section": "B"}, headers=admin).json()
    assert {row["studentId"] for row in only_b} == {b}
    other_day = client.get("/api/v1/attendance", params={"date": "2026-10-14"}, headers=admin).json()
    assert a not in {row["studentId"] for row in other_day}


def test_roster_adds_unmarked_students_and_needs_a_class(client):
    admin = _admin(client)
    marked = _enroll(client, admin, "Charu Das", "Grade 9", "adm.att.c@example.com")
    unmarked = _enroll(client, admin, "Dev Iyer", "Grade 9", "adm.att.d@example.com")
    _mark(client, admin, "Grade 9", "A", [{"studentId": marked, "status": "Absent"}])

    roster = client.get(
        "/api/v1/attendance", params={"date": DAY, "className": "Grade 9", "roster": True}, headers=admin
    ).json()
    rows = {row["studentId"]: row for row in roster}
    assert rows[marked]["attendanceStatus"] == "Absent"
    # an unmarked student comes back with an empty status and no mark id: the screen shows "Not marked"
    assert rows[unmarked]["attendanceStatus"] == "" and rows[unmarked]["id"] is None
    # without a section the unmarked row has no section label (the screen only uses roster mode without a section)
    assert rows[unmarked]["section"] == ""

    refused = client.get("/api/v1/attendance", params={"date": DAY, "roster": True}, headers=admin)
    assert refused.status_code == 400 and refused.json()["detail"]["code"] == "validation_error"


def test_attendance_reads_need_a_login_and_teachers_can_read(client):
    admin = _admin(client)
    assert client.get("/api/v1/attendance", params={"date": DAY}).status_code == 401
    assert client.get("/api/v1/attendance", params={"date": DAY}, headers=_teacher(client)).status_code == 200
    assert client.get("/api/v1/attendance", headers=admin).status_code == 422  # date is required


def test_invalid_status_is_refused_so_the_screen_only_ever_sees_known_statuses(client):
    admin = _admin(client)
    sid = _enroll(client, admin, "Esha Pillai", "Grade 6", "adm.att.e@example.com")
    refused = client.post(
        "/api/v1/attendance",
        json={"date": DAY, "className": "Grade 6", "marks": [{"studentId": sid, "status": "Sleeping"}]},
        headers=admin,
    )
    assert refused.status_code == 400
    for status in ("Present", "Absent", "Late", "Holiday"):
        assert _mark(client, admin, "Grade 6", "A", [{"studentId": sid, "status": status}])[0]["attendanceStatus"] == status


def test_hr_attendance_collection_is_readable_by_admin_and_keeps_stored_dates_as_written(client):
    admin = _admin(client)
    assert client.get("/api/v1/hr/attendance").status_code == 401
    records = [
        {"id": "ATT-901", "employeeId": "EMP-2026-901", "date": "22-09-2026", "status": "Present",
         "checkIn": "08:25 AM", "checkOut": "04:05 PM", "punchIn": "08:25", "punchOut": "16:05", "source": "ESSL Demo"},
        {"id": "ATT-902", "employeeId": "EMP-2026-902", "date": "2026-10-13", "status": "Leave",
         "checkIn": "—", "checkOut": "—", "punchIn": "", "punchOut": "", "source": "Leave approval"},
    ]
    saved = client.put("/api/v1/hr/attendance", json=records, headers=admin)
    assert saved.status_code == 200, saved.text
    listed = {row["id"]: row for row in client.get("/api/v1/hr/attendance", headers=admin).json()}
    # the server stores whatever format HR wrote (dd-mm-yyyy and ISO both exist), so the browser must parse both
    assert listed["ATT-901"]["date"] == "22-09-2026" and listed["ATT-902"]["date"] == "2026-10-13"
    assert listed["ATT-901"]["punchIn"] == "08:25" and listed["ATT-902"]["status"] == "Leave"
