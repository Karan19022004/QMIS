"""Campus academics collections: class timetables, teacher allocations, timetable change requests."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.deps import role_code_for
from app.models import (
    AcademicYear,
    AcademicsRecord,
    HrEmployee,
    SchoolClass,
    Section,
    Student,
    Subject,
    User,
)
from app.services.errors import fail
from app.services.students import PORTAL_ROLES, class_key, portal_students, section_key

COLLECTIONS: dict[str, str] = {
    "class-timetables": "CTT",
    "teacher-allocations": "TAL",
    "class-timetable-change-requests": "TCR",
    "extra-classes": "EC",
    "online-classes": "OC",
    "student-star-ratings": "SSR",
    "unit-tests": "UT",
    "sample-questions": "SQ",
    "home-fun": "HF",
    "study-materials": "SM",
}

_FULL_WRITERS = {"principal", "admin", "superadmin", "managing_director", "director"}
_CHANGE_WRITERS = _FULL_WRITERS | {"teacher", "coordinator"}
_EXTRA_WRITERS = _CHANGE_WRITERS
# Coordinators create/edit class timetables; teachers use change-requests only.
_TIMETABLE_WRITERS = _FULL_WRITERS | {"coordinator"}
_STAFF_DELIVERABLE_COLLECTIONS = {
    "extra-classes",
    "online-classes",
    "student-star-ratings",
    "unit-tests",
    "sample-questions",
    "home-fun",
    "study-materials",
}
_READERS = _CHANGE_WRITERS | {"student", "parent", "jointdirector"}
# Staff-internal lists: portal logins get an empty list (the timetable page loads these in parallel).
_STAFF_ONLY_COLLECTIONS = {"teacher-allocations", "class-timetable-change-requests"}
# Every staff form for these saves exactly one className and one section (both required, no "All").
_CLASS_CONTENT_COLLECTIONS = {
    "home-fun",
    "study-materials",
    "sample-questions",
    "unit-tests",
    "extra-classes",
    "online-classes",
}
# Submission tracking on home-fun items is staff data; it must never reach a parent/student response.
_PORTAL_HIDDEN_FIELDS = ("studentDetails",)


def _code(db: Session, actor: User) -> str:
    return role_code_for(db, actor)


def _ensure_collection(collection: str) -> None:
    if collection not in COLLECTIONS:
        fail(404, "not_found", "That academics collection does not exist.")


def _can_read(db: Session, actor: User) -> bool:
    return _code(db, actor) in _READERS


def _can_write(db: Session, actor: User, collection: str) -> bool:
    code = _code(db, actor)
    if collection == "class-timetable-change-requests":
        return code in _CHANGE_WRITERS
    if collection == "class-timetables":
        return code in _TIMETABLE_WRITERS
    if collection in _STAFF_DELIVERABLE_COLLECTIONS:
        return code in _EXTRA_WRITERS
    return code in _FULL_WRITERS


def _as_item(row: AcademicsRecord) -> dict:
    body = dict(row.body or {})
    body["id"] = row.public_id
    if row.collection == "teacher-allocations":
        body.setdefault("employeeId", row.public_id)
        body["employeeId"] = row.public_id
    body["_collection"] = row.collection
    body["_updatedAt"] = row.updated_at.isoformat() if row.updated_at else None
    body["_createdAt"] = row.created_at.isoformat() if row.created_at else None
    return body


def _public_id_for(collection: str, body: dict, fallback: str) -> str:
    if collection == "teacher-allocations":
        return str(body.get("employeeId") or body.get("id") or fallback).strip()
    return str(body.get("id") or fallback).strip()


def _timetable_for_student(item: dict, student: Student) -> bool:
    """Same matching as the portal timetable page: the child's class, and their section or a whole-class entry."""
    want_class = class_key(student.class_name)
    want_section = section_key(student.section)
    timelines = [t for t in item.get("timelines") or [] if isinstance(t, dict)]
    class_rows = [t for t in timelines if class_key(t.get("className")) == want_class]
    if class_key(item.get("className")) != want_class and not class_rows:
        return False
    item_section = section_key(item.get("section"))
    if not item_section:
        return True
    if item_section == want_section and want_section:
        return True
    return bool(want_section) and any(section_key(t.get("section")) == want_section for t in class_rows)


def _timetable_published(item: dict) -> bool:
    """Only a Principal/Director-approved timetable is published; Pending and Denied stay staff-only."""
    return str(item.get("approvalStatus") or "").strip().lower() == "approved"


def _content_for_student(item: dict, student: Student) -> bool:
    """Class content targets one class and section; rows missing either are not shown to families."""
    item_class = class_key(item.get("className"))
    item_section = section_key(item.get("section"))
    if not item_class or not item_section:
        return False
    return item_class == class_key(student.class_name) and item_section == section_key(student.section)


def _portal_items(db: Session, actor: User, role: str, collection: str, items: list[dict]) -> list[dict]:
    if collection in _STAFF_ONLY_COLLECTIONS:
        return []
    students = portal_students(db, actor, role)
    if collection == "class-timetables":
        return [
            item for item in items
            if _timetable_published(item) and any(_timetable_for_student(item, s) for s in students)
        ]
    if collection == "student-star-ratings":
        ids = {str(s.id) for s in students}
        return [item for item in items if str(item.get("studentId") or "") in ids]
    if collection in _CLASS_CONTENT_COLLECTIONS:
        visible = [item for item in items if any(_content_for_student(item, s) for s in students)]
        return [{k: v for k, v in item.items() if k not in _PORTAL_HIDDEN_FIELDS} for item in visible]
    return []


def list_records(db: Session, actor: User, collection: str) -> list[dict]:
    _ensure_collection(collection)
    if not _can_read(db, actor):
        fail(403, "forbidden", "You are not allowed to view academics records.")
    rows = db.scalars(
        select(AcademicsRecord)
        .where(
            AcademicsRecord.campus_id == actor.campus_id,
            AcademicsRecord.collection == collection,
        )
        .order_by(AcademicsRecord.created_at.desc())
    ).all()
    items = [_as_item(row) for row in rows]
    role = _code(db, actor)
    if role in PORTAL_ROLES:
        return _portal_items(db, actor, role, collection, items)
    return items


def _norm_subject(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip()).lower()


def _allocation_desired_class_teachers(db: Session, campus_id: UUID, items: list[dict]) -> dict[tuple[str, str], UUID]:
    """Map (class_key, section_key) -> user_id for Active allocations with a class-teacher role."""
    desired: dict[tuple[str, str], UUID] = {}
    for raw in items:
        if not isinstance(raw, dict):
            continue
        status = str(raw.get("status") or "").strip().lower()
        if status and status != "active":
            continue
        ct = raw.get("classTeacher") or {}
        if not isinstance(ct, dict):
            continue
        class_name = str(ct.get("className") or "").strip()
        section_name = str(ct.get("section") or "").strip()
        if not class_name or not section_name:
            continue
        user = _resolve_allocation_user(db, campus_id, raw)
        if user is None:
            continue
        desired[(class_key(class_name), section_key(section_name))] = user.id
    return desired


def _resolve_allocation_user(db: Session, campus_id: UUID, body: dict) -> User | None:
    """Resolve teacher login from allocation employeeId / email (HR link preferred)."""
    employee_id = str(body.get("employeeId") or body.get("id") or "").strip()
    email = str(body.get("email") or body.get("teacherEmail") or "").strip().lower()
    hr = None
    if employee_id:
        try:
            emp_uuid = UUID(employee_id)
        except ValueError:
            emp_uuid = None
        clauses = [
            HrEmployee.employee_code == employee_id,
            func.lower(HrEmployee.email) == employee_id.lower(),
        ]
        if emp_uuid is not None:
            clauses.append(HrEmployee.id == emp_uuid)
        hr = db.scalar(
            select(HrEmployee).where(HrEmployee.campus_id == campus_id, or_(*clauses))
        )
    if hr is None and email:
        hr = db.scalar(
            select(HrEmployee).where(
                HrEmployee.campus_id == campus_id,
                func.lower(HrEmployee.email) == email,
            )
        )
    if hr is not None and hr.user_id is not None:
        user = db.get(User, hr.user_id)
        if user is not None and user.campus_id == campus_id and user.is_active:
            return user
    if email:
        user = db.scalar(
            select(User).where(User.campus_id == campus_id, func.lower(User.email) == email)
        )
        if user is not None and user.is_active:
            return user
    if employee_id and "@" in employee_id:
        user = db.scalar(
            select(User).where(
                User.campus_id == campus_id,
                func.lower(User.email) == employee_id.lower(),
            )
        )
        if user is not None and user.is_active:
            return user
    return None


def _find_section_for_keys(
    db: Session, campus_id: UUID, class_name_key: str, section_name_key: str
) -> Section | None:
    """Prefer the current academic year's class/section; else any matching active pair."""
    current = db.scalar(
        select(AcademicYear).where(
            AcademicYear.campus_id == campus_id,
            AcademicYear.is_current.is_(True),
        )
    )
    classes = db.scalars(
        select(SchoolClass).where(
            SchoolClass.campus_id == campus_id,
            SchoolClass.is_active.is_(True),
        )
    ).all()
    matching_class_ids: list[UUID] = []
    current_match: list[UUID] = []
    for row in classes:
        if class_key(row.name) != class_name_key:
            continue
        matching_class_ids.append(row.id)
        if current is not None and row.academic_year_id == current.id:
            current_match.append(row.id)
    class_ids = current_match or matching_class_ids
    if not class_ids:
        return None
    sections = db.scalars(
        select(Section).where(
            Section.campus_id == campus_id,
            Section.class_id.in_(class_ids),
            Section.is_active.is_(True),
        )
    ).all()
    for section in sections:
        if section_key(section.name) == section_name_key:
            return section
    return None


def _validate_teacher_allocation_subjects(db: Session, campus_id: UUID, items: list) -> None:
    """Campus-wide subject catalogue: reject mapping/subject names absent from masters when seeded."""
    names = {
        _norm_subject(row.name)
        for row in db.scalars(select(Subject).where(Subject.campus_id == campus_id)).all()
        if str(row.name or "").strip()
    }
    if not names:
        # No catalogue yet — do not invent a class↔subject schema; allow free text.
        return
    for index, raw in enumerate(items):
        if not isinstance(raw, dict):
            continue
        for subject in raw.get("subjects") or []:
            label = str(subject or "").strip()
            if label and _norm_subject(label) not in names:
                fail(
                    422,
                    "validation_error",
                    f"Unknown subject {label!r} in allocation item {index + 1}. "
                    "Use a subject from the campus subject list.",
                )
        for mapping in raw.get("mappings") or []:
            if not isinstance(mapping, dict):
                continue
            label = str(mapping.get("subject") or "").strip()
            if label and _norm_subject(label) not in names:
                fail(
                    422,
                    "validation_error",
                    f"Unknown subject {label!r} in allocation mapping. "
                    "Use a subject from the campus subject list.",
                )


_TIMETABLE_APPROVERS = frozenset(_FULL_WRITERS)


def _parse_clock_minutes(value: str) -> int | None:
    """Parse '09:00', '9:00 AM', '01:30 PM' → minutes since midnight."""
    match = re.match(r"^(\d{1,2}):(\d{2})\s*([AP]M)?$", str(value or "").strip(), re.I)
    if not match:
        return None
    hours = int(match.group(1)) % 24
    minutes = int(match.group(2))
    meridiem = (match.group(3) or "").upper()
    if meridiem == "PM" and hours < 12:
        hours += 12
    if meridiem == "AM" and hours == 12:
        hours = 0
    return hours * 60 + minutes


def _ranges_overlap(a_start: int, a_end: int, b_start: int, b_end: int) -> bool:
    return a_start < b_end and b_start < a_end


def _campus_subject_names(db: Session, campus_id: UUID) -> set[str]:
    return {
        _norm_subject(row.name)
        for row in db.scalars(select(Subject).where(Subject.campus_id == campus_id)).all()
        if str(row.name or "").strip()
    }


def _campus_class_section_index(db: Session, campus_id: UUID) -> dict[str, set[str]]:
    """class_key → set of section_keys for active classes/sections."""
    index: dict[str, set[str]] = {}
    classes = db.scalars(
        select(SchoolClass).where(SchoolClass.campus_id == campus_id, SchoolClass.is_active.is_(True))
    ).all()
    for school_class in classes:
        key = class_key(school_class.name)
        sections = db.scalars(
            select(Section).where(
                Section.campus_id == campus_id,
                Section.class_id == school_class.id,
                Section.is_active.is_(True),
            )
        ).all()
        index.setdefault(key, set()).update(section_key(s.name) for s in sections)
    return index


def _list_teacher_allocation_bodies(db: Session, campus_id: UUID) -> list[dict]:
    rows = db.scalars(
        select(AcademicsRecord).where(
            AcademicsRecord.campus_id == campus_id,
            AcademicsRecord.collection == "teacher-allocations",
        )
    ).all()
    return [dict(row.body or {}) for row in rows]


def _allocation_matches_owner(body: dict, owner_id: str, owner_email: str) -> bool:
    emp = str(body.get("employeeId") or body.get("id") or "").strip().lower()
    email = str(body.get("email") or body.get("teacherEmail") or "").strip().lower()
    if owner_id and emp and emp == owner_id.lower():
        return True
    if owner_email and email and email == owner_email.lower():
        return True
    if owner_id and "@" in owner_id and email and email == owner_id.lower():
        return True
    if owner_id and email and email == owner_id.lower():
        return True
    return False


def _allocation_covers_period(body: dict, class_name: str, section_name: str, subject: str) -> bool:
    status = str(body.get("status") or "Active").strip().lower()
    if status and status not in {"active", "allocated"}:
        return False
    want_class = class_key(class_name)
    want_section = section_key(section_name)
    want_subject = _norm_subject(subject)
    mappings = [m for m in (body.get("mappings") or []) if isinstance(m, dict)]
    if mappings:
        for mapping in mappings:
            if class_key(mapping.get("className")) != want_class:
                continue
            map_section = section_key(mapping.get("section"))
            if map_section and want_section and map_section != want_section:
                continue
            if _norm_subject(mapping.get("subject")) == want_subject:
                return True
        return False
    teaching = {class_key(c) for c in (body.get("teachingClasses") or []) if str(c or "").strip()}
    subjects = {_norm_subject(s) for s in (body.get("subjects") or []) if str(s or "").strip()}
    if want_class not in teaching:
        return False
    return want_subject in subjects if subjects else True


def _normalize_timetable_approvals(actor_code: str, items: list) -> None:
    """TT-05: only Principal/Director/Admin family may set Approved/Denied; others stay Pending."""
    can_approve = actor_code in _TIMETABLE_APPROVERS
    for raw in items:
        if not isinstance(raw, dict):
            continue
        status = str(raw.get("approvalStatus") or "Pending").strip()
        if can_approve:
            if status not in {"Pending", "Approved", "Denied"}:
                raw["approvalStatus"] = "Pending"
            continue
        # Coordinators (and any non-approver writers) cannot publish or deny via PUT.
        raw["approvalStatus"] = "Pending"
        raw.pop("reviewedBy", None)
        raw.pop("reviewedAt", None)
        raw["rejectionReason"] = ""


def _validate_class_timetables(db: Session, campus_id: UUID, items: list) -> None:
    """TT-03 / TT-04: subjects, class/section masters, allocation coverage, period overlaps."""
    subject_names = _campus_subject_names(db, campus_id)
    class_sections = _campus_class_section_index(db, campus_id)
    allocations = _list_teacher_allocation_bodies(db, campus_id)
    has_allocations = bool(allocations)

    periods: list[dict] = []
    for index, raw in enumerate(items):
        if not isinstance(raw, dict):
            continue
        owner_id = str(raw.get("ownerTeacherId") or "").strip()
        owner_email = str(raw.get("ownerTeacherEmail") or "").strip().lower()
        owner_name = str(raw.get("ownerTeacherName") or "").strip()
        owner_alloc = None
        if has_allocations and (owner_id or owner_email):
            for body in allocations:
                if _allocation_matches_owner(body, owner_id, owner_email):
                    owner_alloc = body
                    break
            if owner_alloc is None:
                fail(
                    422,
                    "validation_error",
                    f"Timetable item {index + 1}: owner teacher is not in teacher allocations. "
                    "Allocate the teacher first.",
                )

        timelines = [t for t in (raw.get("timelines") or []) if isinstance(t, dict)]
        for timeline in timelines:
            class_name = str(timeline.get("className") or raw.get("className") or "").strip()
            section_name = str(timeline.get("section") or raw.get("section") or "").strip()
            subject = str(timeline.get("subject") or "").strip()
            day = str(timeline.get("day") or "").strip()
            start = str(timeline.get("startTime") or "").strip()
            end = str(timeline.get("endTime") or "").strip()
            if not (class_name and section_name and subject and day and start and end):
                continue
            if subject_names and _norm_subject(subject) not in subject_names:
                fail(
                    422,
                    "validation_error",
                    f"Unknown subject {subject!r} on class timetable. "
                    "Use a subject from the campus subject list.",
                )
            if class_sections:
                ck = class_key(class_name)
                if ck not in class_sections:
                    fail(
                        422,
                        "validation_error",
                        f"Unknown class {class_name!r} on class timetable.",
                    )
                sk = section_key(section_name)
                if sk and sk not in class_sections[ck]:
                    fail(
                        422,
                        "validation_error",
                        f"Unknown section {section_name!r} for class {class_name!r}.",
                    )
            if owner_alloc is not None and not _allocation_covers_period(
                owner_alloc, class_name, section_name, subject
            ):
                fail(
                    422,
                    "validation_error",
                    f"Subject {subject!r} for {class_name} {section_name} is not in the "
                    "owner teacher's active allocation.",
                )
            start_m = _parse_clock_minutes(start)
            end_m = _parse_clock_minutes(end)
            if start_m is None or end_m is None or start_m >= end_m:
                fail(
                    422,
                    "validation_error",
                    f"Invalid period times {start!r}–{end!r} on {day}.",
                )
            teacher_label = (
                owner_id.lower()
                or owner_email
                or str(timeline.get("teacher") or owner_name).strip().lower()
            )
            periods.append(
                {
                    "day": day.lower(),
                    "start": start_m,
                    "end": end_m,
                    "class": class_key(class_name),
                    "section": section_key(section_name),
                    "teacher": teacher_label,
                    "label": f"{class_name} {section_name} / {day} {start}-{end}",
                }
            )

    for i, left in enumerate(periods):
        for right in periods[i + 1 :]:
            if left["day"] != right["day"]:
                continue
            if not _ranges_overlap(left["start"], left["end"], right["start"], right["end"]):
                continue
            if left["class"] == right["class"] and left["section"] == right["section"]:
                fail(
                    422,
                    "conflict",
                    "Class/section period conflict: overlapping times on the same day "
                    f"({left['label']} vs {right['label']}).",
                )
            if left["teacher"] and right["teacher"] and left["teacher"] == right["teacher"]:
                fail(
                    422,
                    "conflict",
                    "Teacher period conflict: the same teacher has overlapping times on the same day "
                    f"({left['label']} vs {right['label']}).",
                )


def _sync_section_class_teachers(
    db: Session,
    campus_id: UUID,
    *,
    previous: dict[tuple[str, str], UUID],
    desired: dict[tuple[str, str], UUID],
) -> None:
    """Keep sections.class_teacher_user_id aligned with Active teacher-allocation classTeacher rows.

    Authoritative write for class-teacher *from this screen* is the allocation PUT; Class Details
    section PATCH remains valid for sections never mentioned in allocations.
    """
    for key in set(previous) | set(desired):
        section = _find_section_for_keys(db, campus_id, key[0], key[1])
        if section is None:
            continue
        new_uid = desired.get(key)
        old_uid = previous.get(key)
        if new_uid is not None:
            section.class_teacher_user_id = new_uid
        elif old_uid is not None and section.class_teacher_user_id == old_uid:
            section.class_teacher_user_id = None


def replace_records(db: Session, actor: User, collection: str, items: list) -> list[dict]:
    """Replace the entire campus collection with the given list (SoT put)."""
    _ensure_collection(collection)
    if not _can_write(db, actor, collection):
        fail(403, "forbidden", "You are not allowed to change academics records.")
    if not isinstance(items, list):
        fail(422, "invalid_body", "Body must be a JSON array.")

    previous_class_teachers: dict[tuple[str, str], UUID] = {}
    if collection == "teacher-allocations":
        _validate_teacher_allocation_subjects(db, actor.campus_id, items)
        old_rows = db.scalars(
            select(AcademicsRecord).where(
                AcademicsRecord.campus_id == actor.campus_id,
                AcademicsRecord.collection == collection,
            )
        ).all()
        previous_class_teachers = _allocation_desired_class_teachers(
            db, actor.campus_id, [dict(row.body or {}) for row in old_rows]
        )

    if collection == "class-timetables":
        # Validate before delete so a failed PUT cannot wipe the campus collection.
        _normalize_timetable_approvals(_code(db, actor), items)
        _validate_class_timetables(db, actor.campus_id, items)

    db.execute(
        delete(AcademicsRecord).where(
            AcademicsRecord.campus_id == actor.campus_id,
            AcademicsRecord.collection == collection,
        )
    )

    now = datetime.now(timezone.utc)
    prefix = COLLECTIONS[collection]
    seen: set[str] = set()
    for index, raw in enumerate(items):
        if not isinstance(raw, dict):
            fail(422, "invalid_body", "Each item must be an object.")
        fallback = f"{prefix}-{index + 1:04d}"
        public_id = _public_id_for(collection, raw, fallback)
        if not public_id:
            fail(422, "invalid_body", "Each item needs an id (or employeeId for allocations).")
        if public_id in seen:
            fail(422, "duplicate", f"Duplicate id in payload: {public_id}")
        seen.add(public_id)
        payload = {**raw, "id": public_id}
        if collection == "teacher-allocations":
            payload["employeeId"] = public_id
        db.add(
            AcademicsRecord(
                id=uuid.uuid4(),
                campus_id=actor.campus_id,
                collection=collection,
                public_id=public_id,
                body=payload,
                created_by=actor.id,
                updated_at=now,
            )
        )

    if collection == "teacher-allocations":
        desired = _allocation_desired_class_teachers(db, actor.campus_id, items)
        _sync_section_class_teachers(
            db,
            actor.campus_id,
            previous=previous_class_teachers,
            desired=desired,
        )

    db.commit()
    return list_records(db, actor, collection)
