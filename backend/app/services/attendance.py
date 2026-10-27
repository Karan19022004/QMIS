"""Teacher class attendance SoT (Y-1)."""

from __future__ import annotations

import json
import uuid
from datetime import date
from types import SimpleNamespace
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import role_code_for
from app.models import SchoolClass, Section, Student, StudentAttendance, User
from app.models.base import utcnow
from app.schemas.attendance import AttendanceUpsertIn
from app.services.audit import write_audit
from app.services.errors import fail
from app.services.students import PORTAL_ROLES, ensure_staff_can_view_student, section_key, staff_student_filter

ALLOWED_STATUS = {"Present", "Absent", "Late", "Holiday"}


def _class_list_scope(db: Session, actor: User, attendance_date: date):
    """Which students an attendance list, roster or save may include: None = all, else a predicate.

    Parents/students never get class lists (they use the per-child calendar). Teachers and
    coordinators are limited to their class-teacher sections, Teacher Allocation mappings and
    (coordinators) grade band, widened only by a substitute duty that is valid right now for
    ``attendance_date`` (see services.substitute_duties).
    """
    from app.services.substitute_duties import valid_duties

    role = role_code_for(db, actor)
    if role in PORTAL_ROLES:
        fail(403, "forbidden", "Class attendance lists are for staff. Open your child's attendance calendar instead.")
    standing = staff_student_filter(db, actor, role)
    if standing is None:
        return None
    duty_sections = {d.section_id for d in valid_duties(db, actor, attendance_date)}
    if not duty_sections:
        return standing
    return lambda student: standing(student) or getattr(student, "section_id", None) in duty_sections


def my_attendance_classes(db: Session, actor: User, on_date: date | None = None) -> dict:
    """Class/section options for the Class Attendance screen, using the same rule as roster and save.

    Built from the current academic year's active classes and sections, plus the sections of
    substitute duties that are valid right now for ``on_date`` (default: today, campus time).
    """
    from app.services.placement import current_academic_year
    from app.services.substitute_duties import local_now, valid_duties

    on_date = on_date or local_now().date()
    allowed = _class_list_scope(db, actor, on_date)
    stmt = select(SchoolClass).where(SchoolClass.campus_id == actor.campus_id, SchoolClass.is_active.is_(True))
    year = current_academic_year(db, actor.campus_id)
    if year is not None:
        stmt = stmt.where(SchoolClass.academic_year_id == year.id)
    duties = valid_duties(db, actor, on_date) if allowed is not None else []
    duty_sections = {d.section_id for d in duties}
    classes = []
    for cls in db.scalars(stmt.order_by(SchoolClass.name)).all():
        sections = db.scalars(
            select(Section).where(Section.class_id == cls.id, Section.is_active.is_(True)).order_by(Section.name)
        ).all()
        if allowed is not None:
            sections = [
                s for s in sections
                if s.id in duty_sections or allowed(SimpleNamespace(class_name=cls.name, section=s.name, section_id=None))
            ]
        if sections:
            classes.append({"className": cls.name, "sections": [s.name for s in sections]})
    substitute = []
    for duty in duties:
        section = db.get(Section, duty.section_id)
        cls = db.get(SchoolClass, duty.class_id)
        substitute.append({
            "id": str(duty.id),
            "className": cls.name if cls else "",
            "section": section.name if section else "",
            "period": duty.period,
            "startTime": duty.start_time.strftime("%H:%M"),
            "endTime": duty.end_time.strftime("%H:%M"),
        })
    return {"scoped": allowed is not None, "classes": classes, "substituteDuties": substitute}


def _mark_out(row: StudentAttendance, student: Student | None = None) -> dict:
    name = student.full_name if student else ""
    admission = student.admission_number if student else ""
    return {
        "id": str(row.id),
        "studentId": str(row.student_id),
        "studentName": name,
        "admissionNumber": admission,
        "className": row.class_name,
        "section": row.section or "",
        "date": row.attendance_date.isoformat(),
        "time": row.updated_at.isoformat() if row.updated_at else row.created_at.isoformat(),
        "attendanceStatus": row.status,
        "inOutStatus": row.in_out_status or ("—" if row.status == "Absent" else ""),
    }


def list_attendance(
    db: Session,
    actor: User,
    *,
    attendance_date: date,
    class_name: str | None = None,
    section: str | None = None,
) -> list[dict]:
    allowed = _class_list_scope(db, actor, attendance_date)
    stmt = select(StudentAttendance).where(
        StudentAttendance.campus_id == actor.campus_id,
        StudentAttendance.attendance_date == attendance_date,
    )
    if class_name:
        stmt = stmt.where(StudentAttendance.class_name == class_name)
    if section:
        stmt = stmt.where(StudentAttendance.section == section)
    rows = db.scalars(stmt.order_by(StudentAttendance.class_name, StudentAttendance.created_at)).all()
    student_ids = [r.student_id for r in rows]
    students = {
        s.id: s
        for s in db.scalars(select(Student).where(Student.id.in_(student_ids))).all()
    } if student_ids else {}
    if allowed is not None:
        rows = [r for r in rows if r.student_id in students and allowed(students[r.student_id])]
    return [_mark_out(r, students.get(r.student_id)) for r in rows]


def _class_matches(student_class: str | None, filter_class: str | None) -> bool:
    """Exact match, or same grade number (Grade 5 ↔ V ↔ 5)."""
    left = str(student_class or "").strip()
    right = str(filter_class or "").strip()
    if not left or not right:
        return False
    if left.lower() == right.lower():
        return True
    from app.services.placement import parse_grade

    left_g = parse_grade(left)
    right_g = parse_grade(right)
    return left_g is not None and left_g == right_g


def _section_matches(student_section: str | None, filter_section: str | None) -> bool:
    if not filter_section:
        return True
    return str(student_section or "").strip().upper() == str(filter_section).strip().upper()


def roster_with_marks(
    db: Session,
    actor: User,
    *,
    attendance_date: date,
    class_name: str,
    section: str | None = None,
) -> list[dict]:
    """Enrolled students for a class, merged with any marks for the date.

    Includes pending placement rows so Administrator Attendance can show "Not marked"
    before section/roll assignment — not only already-placed students.
    """
    from app.services.placement import repair_student_class_labels

    allowed = _class_list_scope(db, actor, attendance_date)
    repair_student_class_labels(db, actor.campus_id)

    stmt = select(Student).where(Student.campus_id == actor.campus_id)
    students = [
        row
        for row in db.scalars(stmt.order_by(Student.roll_number.nulls_last(), Student.full_name)).all()
        if _class_matches(row.class_name, class_name) and _section_matches(row.section, section)
    ]
    if allowed is not None:
        visible = [row for row in students if allowed(row)]
        if students and not visible:
            fail(403, "forbidden", "This class is outside your assigned classes.")
        students = visible
    marks_stmt = select(StudentAttendance).where(
        StudentAttendance.campus_id == actor.campus_id,
        StudentAttendance.attendance_date == attendance_date,
    )
    marks_all = db.scalars(marks_stmt).all()
    marks = {
        r.student_id: r
        for r in marks_all
        if _class_matches(r.class_name, class_name) and _section_matches(r.section, section)
    }
    out: list[dict] = []
    for student in students:
        mark = marks.get(student.id)
        if mark:
            out.append(_mark_out(mark, student))
        else:
            out.append(
                {
                    "id": None,
                    "studentId": str(student.id),
                    "studentName": student.full_name,
                    "admissionNumber": student.admission_number,
                    "className": student.class_name,
                    "section": student.section or section or "",
                    "rollNumber": student.roll_number if student.roll_number is not None else "",
                    "date": attendance_date.isoformat(),
                    "time": "",
                    "attendanceStatus": "",
                    "inOutStatus": "",
                }
            )
    return out


def _audited_values(row: StudentAttendance) -> dict:
    return {
        "status": row.status,
        "inOutStatus": row.in_out_status,
        "className": row.class_name,
        "section": row.section,
        "markedBy": str(row.marked_by_user_id) if row.marked_by_user_id else None,
    }


def _access_basis(db: Session, actor: User, attendance_date: date):
    """Which rule let the actor mark a student: campus role, standing assignment, or a substitute duty."""
    from app.services.substitute_duties import valid_duties

    standing = staff_student_filter(db, actor, role_code_for(db, actor))
    duties = {d.section_id: d for d in valid_duties(db, actor, attendance_date)} if standing is not None else {}

    def basis(student: Student) -> dict:
        if standing is None:
            return {"accessBasis": "role"}
        if standing(student):
            return {"accessBasis": "assignment"}
        duty = duties.get(student.section_id)
        return {"accessBasis": "substitute_duty", "substituteDutyId": str(duty.id) if duty else None}

    return basis


def _audit_mark(db: Session, actor: User, row: StudentAttendance, *, previous: dict | None, basis: dict) -> None:
    """One audit row per created/changed mark: ids and values only (no names or other student data)."""
    new = _audited_values(row)
    details = {
        "studentId": str(row.student_id),
        "date": row.attendance_date.isoformat(),
        "previous": previous,
        "new": new,
        "changed": sorted(k for k in new if previous is None or previous[k] != new[k]),
        **basis,
    }
    write_audit(
        db,
        action="ATTENDANCE_CREATED" if previous is None else "ATTENDANCE_UPDATED",
        entity_type="student_attendance",
        entity_id=str(row.id),
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=json.dumps(details, sort_keys=True),
    )


def upsert_attendance(db: Session, actor: User, payload: AttendanceUpsertIn) -> list[dict]:
    class_name = payload.class_name.strip()
    if not class_name:
        fail(400, "validation_error", "Class is required.")

    allowed = _class_list_scope(db, actor, payload.date)
    checked: list[tuple[object, Student, str]] = []
    # Validate every mark before writing any, so a rejected student cannot leave partial writes.
    for item in payload.marks:
        status = (item.status or "").strip()
        if status not in ALLOWED_STATUS:
            fail(400, "validation_error", f"Invalid status '{item.status}'. Use {sorted(ALLOWED_STATUS)}.")
        student = db.get(Student, item.student_id)
        if student is None or student.campus_id != actor.campus_id:
            fail(404, "not_found", f"Student {item.student_id} not found.")
        if not _class_matches(student.class_name, class_name):
            fail(400, "validation_error", f"Student {student.full_name} is not in class {class_name}.")
        if allowed is not None:
            if not allowed(student):
                fail(403, "forbidden", "One or more students are outside your assigned classes.")
            if payload.section and student.section and section_key(payload.section) != section_key(student.section):
                fail(400, "validation_error", f"Student {student.full_name} is not in section {payload.section}.")
        checked.append((item, student, status))

    basis_for = _access_basis(db, actor, payload.date)
    results: list[StudentAttendance] = []
    for item, student, status in checked:
        row = db.scalar(
            select(StudentAttendance).where(
                StudentAttendance.campus_id == actor.campus_id,
                StudentAttendance.student_id == student.id,
                StudentAttendance.attendance_date == payload.date,
            )
        )
        if row is None:
            row = StudentAttendance(
                id=uuid.uuid4(),
                campus_id=actor.campus_id,
                student_id=student.id,
                attendance_date=payload.date,
                class_name=class_name,
                section=payload.section,
                status=status,
                in_out_status=item.in_out_status,
                marked_by_user_id=actor.id,
            )
            db.add(row)
            _audit_mark(db, actor, row, previous=None, basis=basis_for(student))
        else:
            previous = _audited_values(row)  # read from the persisted row before it is changed
            row.status = status
            row.in_out_status = item.in_out_status
            row.class_name = class_name
            row.section = payload.section
            row.marked_by_user_id = actor.id
            row.updated_at = utcnow()
            if _audited_values(row) != previous:
                _audit_mark(db, actor, row, previous=previous, basis=basis_for(student))
        results.append(row)

    # Per-record audit rows and the attendance rows share this one commit: either all persist or none do.
    write_audit(
        db,
        action="ATTENDANCE_UPSERT",
        entity_type="student_attendance",
        entity_id=f"{class_name}:{payload.date.isoformat()}",
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"{len(payload.marks)} marks",
    )
    db.commit()
    for row in results:
        db.refresh(row)

    students = {
        s.id: s
        for s in db.scalars(
            select(Student).where(Student.id.in_([r.student_id for r in results]))
        ).all()
    }
    return [_mark_out(r, students.get(r.student_id)) for r in results]


def student_month_map(
    db: Session,
    actor: User,
    student_id: UUID,
    *,
    year: int,
    month: int,
) -> dict[str, str]:
    student = db.get(Student, student_id)
    if student is None or student.campus_id != actor.campus_id:
        fail(404, "not_found", "Student not found.")
    role = role_code_for(db, actor)
    if role == "parent" and str(student.parent_user_id or "") != str(actor.id):
        fail(404, "not_found", "Student not found.")
    if role == "student" and str(student.student_user_id or "") != str(actor.id):
        fail(404, "not_found", "Student not found.")
    ensure_staff_can_view_student(db, actor, student, role)
    if month < 1 or month > 12:
        fail(400, "validation_error", "Month must be 1–12.")

    start = date(year, month, 1)
    end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    rows = db.scalars(
        select(StudentAttendance).where(
            StudentAttendance.campus_id == actor.campus_id,
            StudentAttendance.student_id == student_id,
            StudentAttendance.attendance_date >= start,
            StudentAttendance.attendance_date < end,
        )
    ).all()
    code = {"Present": "P", "Absent": "A", "Late": "P", "Holiday": "H"}
    return {r.attendance_date.isoformat(): code.get(r.status, "P") for r in rows}
