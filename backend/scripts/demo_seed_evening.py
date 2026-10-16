"""Idempotent evening-demo sample data for local DEVELOPMENT databases only.

Creates fictional DEMO-EVE-* / DEMO-ADM-* / AN-DEMO* / CAL-DEMO* records so
Admin, PRM, Principal, Teacher, and HR screens are not empty during a manager demo.

Safety:
  - Refuses to run unless ENVIRONMENT is development (settings.is_development).
  - Refuses if DATABASE_URL looks like a non-local host (optional hard stop).
  - Never deletes existing rows.
  - Stable public ids / codes — safe to re-run (upserts by unique key).

Identify demo rows:
  - Students: admission_number starts with DEMO-ADM-
  - Enquiries: enquiry_code starts with DEMO-ENQ-
  - Front Office: public_id starts with DEMO-FO-
  - Announcements: code starts with AN-DEMO
  - Calendar: code starts with CAL-DEMO
  - TC: code starts with TC-DEMO-
  - Tasks: title starts with [DEMO]
  - Escalations: description starts with [DEMO]
  - HR records: public_id starts with DEMO-HR-

Usage (from backend/, with API DB already migrated and reference seed applied):

  python scripts/demo_seed_evening.py
"""

from __future__ import annotations

import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import func, select  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402
from app.models import (  # noqa: E402
    AdmissionEnquiry,
    Announcement,
    CalendarEvent,
    Campus,
    Escalation,
    FrontOfficeRecord,
    HrRecord,
    Student,
    StudentAttendance,
    Task,
    TaskEvent,
    TcRequest,
    User,
)

MARKER = "DEMO-EVE"
TODAY = date.today()


def _abort(message: str) -> None:
    print(f"BLOCKED: {message}")
    raise SystemExit(2)


def _assert_safe_target() -> None:
    if not settings.is_development:
        _abort(
            f"ENVIRONMENT={settings.environment!r} is not development. "
            "Demo seed only runs against a designated development database."
        )
    parsed = urlparse(settings.database_url.replace("postgresql+psycopg", "postgresql"))
    host = (parsed.hostname or "").lower()
    if host and host not in {"localhost", "127.0.0.1", "::1"} and "sqlite" not in settings.database_url.lower():
        _abort(
            f"DATABASE_URL host {host!r} is not local. "
            "Refusing to insert demo rows into a remote database."
        )


def _campus(db) -> Campus:
    campus = db.scalar(select(Campus).where(Campus.code == "QMIS-MDU"))
    if campus is None:
        _abort("Campus QMIS-MDU not found. Start the API once so seed_reference_data runs first.")
    return campus


def _user_by_email(db, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


def _upsert_student(db, campus: Campus, *, admission_number: str, full_name: str, class_name: str) -> Student:
    row = db.scalar(select(Student).where(Student.admission_number == admission_number))
    if row:
        row.full_name = full_name
        row.class_name = class_name
        return row
    row = Student(
        campus_id=campus.id,
        admission_number=admission_number,
        full_name=full_name,
        class_name=class_name,
    )
    db.add(row)
    db.flush()
    return row


def _upsert_enquiry(
    db,
    campus: Campus,
    *,
    code: str,
    name: str,
    mobile: str,
    class_name: str,
    status: str = "Active",
) -> AdmissionEnquiry:
    row = db.scalar(select(AdmissionEnquiry).where(AdmissionEnquiry.enquiry_code == code))
    if row:
        row.name = name
        row.mobile_number = mobile
        row.class_name = class_name
        row.status = status
        return row
    row = AdmissionEnquiry(
        campus_id=campus.id,
        enquiry_code=code,
        name=name,
        mobile_number=mobile,
        email=f"{code.lower().replace('-', '.')}@demo.qmis.local",
        class_name=class_name,
        enquiry_date=TODAY - timedelta(days=5),
        next_follow_up_date=TODAY + timedelta(days=2),
        source="Walk-in",
        city="Madurai",
        state="Tamil Nadu",
        status=status,
        student_name=name,
        guardian_name=f"Parent of {name.split()[0]}",
        guardian_phone=mobile,
    )
    db.add(row)
    return row


def _upsert_fo(db, campus: Campus, *, collection: str, public_id: str, body: dict, actor: User | None) -> None:
    row = db.scalar(
        select(FrontOfficeRecord).where(
            FrontOfficeRecord.campus_id == campus.id,
            FrontOfficeRecord.collection == collection,
            FrontOfficeRecord.public_id == public_id,
        )
    )
    payload = {**body, "id": public_id, "regressionMarker": MARKER}
    if row:
        row.body = payload
        row.updated_at = datetime.now(timezone.utc)
        return
    db.add(
        FrontOfficeRecord(
            campus_id=campus.id,
            collection=collection,
            public_id=public_id,
            body=payload,
            created_by=actor.id if actor else None,
        )
    )


def _upsert_hr(db, campus: Campus, *, collection: str, public_id: str, body: dict) -> None:
    row = db.scalar(
        select(HrRecord).where(
            HrRecord.campus_id == campus.id,
            HrRecord.collection == collection,
            HrRecord.public_id == public_id,
        )
    )
    payload = {**body, "id": public_id}
    if row:
        row.body = payload
        return
    db.add(HrRecord(campus_id=campus.id, collection=collection, public_id=public_id, body=payload))


def _upsert_announcement(db, campus: Campus, *, code: str, title: str, message: str, sender: User | None) -> None:
    row = db.scalar(
        select(Announcement).where(Announcement.campus_id == campus.id, Announcement.code == code)
    )
    if row:
        row.title = title
        row.message = message
        return
    db.add(
        Announcement(
            campus_id=campus.id,
            code=code,
            title=title,
            category="General",
            message=message,
            sent_by="Administrator",
            sender_role="admin",
            announcement_date=TODAY,
            audience=["teacher", "principal", "prm", "hr"],
            created_by=sender.id if sender else None,
        )
    )


def _upsert_calendar(db, campus: Campus, *, code: str, title: str, event_type: str, start: date, end: date) -> None:
    row = db.scalar(
        select(CalendarEvent).where(CalendarEvent.campus_id == campus.id, CalendarEvent.code == code)
    )
    if row:
        row.title = title
        row.start_date = start
        row.end_date = end
        return
    db.add(
        CalendarEvent(
            campus_id=campus.id,
            code=code,
            event_type=event_type,
            title=title,
            start_date=start,
            end_date=end,
            description=f"{MARKER} sample calendar event",
        )
    )


def _upsert_attendance(db, campus: Campus, student: Student, teacher: User | None, status: str) -> None:
    row = db.scalar(
        select(StudentAttendance).where(
            StudentAttendance.campus_id == campus.id,
            StudentAttendance.student_id == student.id,
            StudentAttendance.attendance_date == TODAY,
        )
    )
    class_name = student.class_name.split("-")[0] if "-" in student.class_name else student.class_name
    section = student.class_name.split("-")[-1] if "-" in student.class_name else "A"
    if row:
        row.status = status
        row.class_name = class_name
        row.section = section
        row.updated_at = datetime.now(timezone.utc)
        return
    db.add(
        StudentAttendance(
            campus_id=campus.id,
            student_id=student.id,
            attendance_date=TODAY,
            class_name=class_name,
            section=section,
            status=status,
            in_out_status="In Campus" if status == "Present" else None,
            marked_by_user_id=teacher.id if teacher else None,
        )
    )


def _upsert_tc(db, campus: Campus, student: Student, *, code: str, status: str) -> None:
    row = db.scalar(select(TcRequest).where(TcRequest.campus_id == campus.id, TcRequest.code == code))
    if row:
        row.status = status
        return
    db.add(
        TcRequest(
            campus_id=campus.id,
            code=code,
            student_id=student.id,
            reason="Family relocation (demo sample — fictional)",
            transfer_to="Demo International School, Chennai",
            last_date_of_attendance=TODAY - timedelta(days=2),
            requested_by="Parent (demo)",
            requested_on=TODAY - timedelta(days=3),
            status=status,
            prm_remarks="Forwarded for demo review" if status != "Pending PRM Review" else "",
            forwarded_on=TODAY - timedelta(days=1) if status != "Pending PRM Review" else None,
        )
    )


def _ensure_task(db, campus: Campus, *, assigner: User, assignee: User, title: str, task_no: int) -> None:
    existing = db.scalar(
        select(Task).where(Task.campus_id == campus.id, Task.title == title, Task.assignee_id == assignee.id)
    )
    if existing:
        return
    task = Task(
        campus_id=campus.id,
        task_no=task_no,
        assigned_by_id=assigner.id,
        assigned_by_role="admin",
        assignee_id=assignee.id,
        assignee_role="teacher",
        title=title,
        description=f"{MARKER} demo task for evening walkthrough.",
        priority="Medium",
        due_date=TODAY + timedelta(days=3),
        status="Incomplete",
    )
    db.add(task)
    db.flush()
    db.add(
        TaskEvent(
            task_id=task.id,
            campus_id=campus.id,
            action="assigned",
            from_status=None,
            to_status="Incomplete",
            actor_id=assigner.id,
            actor_role="admin",
            remark="Demo seed",
            client_ref=f"{MARKER}-TASK-{task_no}",
        )
    )


def _ensure_escalation(db, campus: Campus, *, raised_by: User, to_user: User | None, description: str, esc_no: int) -> None:
    existing = db.scalar(
        select(Escalation).where(
            Escalation.campus_id == campus.id,
            Escalation.description == description,
        )
    )
    if existing:
        return
    db.add(
        Escalation(
            campus_id=campus.id,
            esc_no=esc_no,
            raised_by_id=raised_by.id,
            raised_by_role="teacher",
            to_role="principal",
            to_user_id=to_user.id if to_user else None,
            description=description,
            full_description=f"{MARKER} full description for manager demo — fictional facility issue.",
            status="Pending",
            level=0,
            resolve_by=datetime.now(timezone.utc) + timedelta(hours=24),
            trail_json="[]",
        )
    )


def main() -> int:
    _assert_safe_target()
    db = SessionLocal()
    created: list[str] = []
    try:
        campus = _campus(db)
        admin = _user_by_email(db, settings.admin_seed_email)
        prm = _user_by_email(db, settings.prm_seed_email)
        teacher = _user_by_email(db, settings.teacher_seed_email)
        principal = _user_by_email(db, settings.principal_seed_email)
        hr = _user_by_email(db, settings.hr_seed_email)
        if not all([admin, prm, teacher, principal, hr]):
            _abort("Demo role users missing. Ensure seed_demo_accounts ran (ENVIRONMENT=development).")

        students = [
            _upsert_student(db, campus, admission_number="DEMO-ADM-1001", full_name="Aarav Mehta", class_name="5-A"),
            _upsert_student(db, campus, admission_number="DEMO-ADM-1002", full_name="Diya Krishnan", class_name="5-A"),
            _upsert_student(db, campus, admission_number="DEMO-ADM-1003", full_name="Kabir Iyer", class_name="8-B"),
            _upsert_student(db, campus, admission_number="DEMO-ADM-1004", full_name="Ananya Rao", class_name="8-B"),
            _upsert_student(db, campus, admission_number="DEMO-ADM-1005", full_name="Vihaan Nair", class_name="10-A"),
        ]
        created.append(f"students={len(students)}")

        for idx, (name, klass) in enumerate(
            [
                ("Rohan Patel", "1-A"),
                ("Meera Shah", "2-B"),
                ("Ishaan Gupta", "3-A"),
            ],
            start=1,
        ):
            _upsert_enquiry(
                db,
                campus,
                code=f"DEMO-ENQ-{idx:03d}",
                name=name,
                mobile=f"90000000{idx:02d}",
                class_name=klass,
            )
        created.append("enquiries=3")

        for student, status in zip(students, ["Present", "Present", "Absent", "Late", "Present"], strict=True):
            _upsert_attendance(db, campus, student, teacher, status)
        created.append("attendance=5")

        _upsert_fo(
            db,
            campus,
            collection="student-gate-passes",
            public_id="DEMO-FO-SGP-001",
            body={
                "studentId": "DEMO-ADM-1001",
                "studentName": "Aarav Mehta",
                "classSection": "5-A",
                "reason": "Medical appointment",
                "date": TODAY.strftime("%d-%m-%Y"),
                "outTime": "14:00",
                "status": "Pending",
            },
            actor=prm,
        )
        _upsert_fo(
            db,
            campus,
            collection="material-gate-passes",
            public_id="DEMO-FO-MGP-001",
            body={
                "passType": "Non-Returnable",
                "date": TODAY.strftime("%d-%m-%Y"),
                "time": "10:30",
                "timePeriod": "AM",
                "driverName": "Suresh Kumar",
                "vehicleNo": "TN-59-DEMO-01",
                "materials": [
                    {"id": "row-1", "description": "Library cartons", "quantity": 4, "destination": "Store", "remarks": ""}
                ],
                "status": "Pending",
            },
            actor=prm,
        )
        _upsert_fo(
            db,
            campus,
            collection="goods-received-passes",
            public_id="DEMO-FO-GRP-001",
            body={
                "paymentType": "CASH",
                "date": TODAY.strftime("%d-%m-%Y"),
                "time": "11:15",
                "timePeriod": "AM",
                "supplierName": "Demo Stationery Mart",
                "billNo": "DEMO-BILL-01",
                "billDate": TODAY.strftime("%d-%m-%Y"),
                "materials": [{"id": "row-1", "description": "A4 paper reams", "quantity": 10, "remarks": ""}],
                "status": "Pending",
            },
            actor=prm,
        )
        _upsert_fo(
            db,
            campus,
            collection="student-transfers",
            public_id="DEMO-FO-TRF-001",
            body={
                "studentName": "Vihaan Nair",
                "admissionNumber": "DEMO-ADM-1005",
                "classSection": "10-A",
                "transferTo": "Demo School Chennai",
                "date": TODAY.strftime("%d-%m-%Y"),
                "status": "Pending",
            },
            actor=prm,
        )
        _upsert_fo(
            db,
            campus,
            collection="student-re-enrollments",
            public_id="DEMO-FO-REN-001",
            body={
                "studentName": "Diya Krishnan",
                "admissionNumber": "DEMO-ADM-1002",
                "classSection": "5-A",
                "academicYear": "2026-27",
                "date": TODAY.strftime("%d-%m-%Y"),
                "status": "Pending",
            },
            actor=prm,
        )
        created.append("front_office=5")

        _upsert_announcement(
            db,
            campus,
            code="AN-DEMO01",
            title="Parent–Teacher meeting (demo)",
            message="Fictional notice for the evening management demo. Meeting hall booking on Saturday.",
            sender=admin,
        )
        _upsert_calendar(
            db,
            campus,
            code="CAL-DEMO-HOL",
            title="Demo holiday — Founders Day",
            event_type="holiday",
            start=TODAY + timedelta(days=10),
            end=TODAY + timedelta(days=10),
        )
        _upsert_calendar(
            db,
            campus,
            code="CAL-DEMO-EXAM",
            title="Demo mid-term window",
            event_type="exam",
            start=TODAY + timedelta(days=20),
            end=TODAY + timedelta(days=25),
        )
        created.append("announcement+calendar")

        _upsert_tc(db, campus, students[4], code="TC-DEMO-001", status="Pending PRM Review")
        _upsert_tc(db, campus, students[2], code="TC-DEMO-002", status="Pending Super Admin Approval")
        created.append("tc=2")

        max_task = db.scalar(select(func.coalesce(func.max(Task.task_no), 0)).where(Task.campus_id == campus.id)) or 0
        _ensure_task(
            db,
            campus,
            assigner=admin,
            assignee=teacher,
            title="[DEMO] Prepare class 5-A attendance sheet",
            task_no=int(max_task) + 1,
        )
        _ensure_task(
            db,
            campus,
            assigner=principal,
            assignee=teacher,
            title="[DEMO] Submit weekly lesson notes",
            task_no=int(max_task) + 2,
        )
        created.append("tasks=2")

        max_esc = db.scalar(
            select(func.coalesce(func.max(Escalation.esc_no), 0)).where(Escalation.campus_id == campus.id)
        ) or 0
        _ensure_escalation(
            db,
            campus,
            raised_by=teacher,
            to_user=principal,
            description="[DEMO] Projector not working in Lab 2",
            esc_no=int(max_esc) + 1,
        )
        created.append("escalation=1")

        _upsert_hr(
            db,
            campus,
            collection="leave-requests",
            public_id="DEMO-HR-LV-001",
            body={
                "employeeId": "EMP-2026-001",
                "employeeName": "Demo Staff Member",
                "leaveType": "Casual Leave",
                "fromDate": TODAY.strftime("%d-%m-%Y"),
                "toDate": (TODAY + timedelta(days=1)).strftime("%d-%m-%Y"),
                "status": "Pending",
                "reason": "Personal (demo sample)",
            },
        )
        _upsert_hr(
            db,
            campus,
            collection="job-openings",
            public_id="DEMO-HR-JOB-001",
            body={
                "title": "Demo Mathematics Teacher",
                "department": "Academics",
                "openings": 1,
                "status": "Open",
                "postedOn": TODAY.strftime("%d-%m-%Y"),
            },
        )
        created.append("hr=2")

        db.commit()
        print("DEMO SEED OK —", ", ".join(created))
        print("Marker:", MARKER)
        print("Identify rows by DEMO-ADM- / DEMO-FO- / DEMO-ENQ- / AN-DEMO / CAL-DEMO / TC-DEMO- / [DEMO] / DEMO-HR-")
        return 0
    except SystemExit:
        db.rollback()
        raise
    except Exception as exc:  # noqa: BLE001 — script surface
        db.rollback()
        print(f"DEMO SEED FAILED: {exc}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
