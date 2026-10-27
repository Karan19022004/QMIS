"""Campus academics collections: class timetables, teacher allocations, timetable change requests."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.deps import role_code_for
from app.models import AcademicsRecord, Student, User
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


def replace_records(db: Session, actor: User, collection: str, items: list) -> list[dict]:
    """Replace the entire campus collection with the given list (SoT put)."""
    _ensure_collection(collection)
    if not _can_write(db, actor, collection):
        fail(403, "forbidden", "You are not allowed to change academics records.")
    if not isinstance(items, list):
        fail(422, "invalid_body", "Body must be a JSON array.")

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

    db.commit()
    return list_records(db, actor, collection)
