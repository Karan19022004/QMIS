"""Admin > Documents: secure student and employee document folders.

Files are stored through the shared file service (validated type and size, random stored name, kept out of
any public path); the folder/item rows tie each file to ONE student or employee. Reading, uploading or
removing a file needs the matching ``documents.students.*`` / ``documents.employees.*`` permission, and the
generic ``/files/{id}/download`` route enforces the same rule for these files.
"""

import re
import uuid
from datetime import date

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.deps import permission_codes_for
from app.models import DocumentItem, DocumentRecord, FileAsset, HrEmployee, Student, User
from app.models.base import utcnow
from app.services.audit import write_audit
from app.services.errors import fail
from app.services.files import (
    DOCUMENT_MAX_BYTES,
    DOCUMENT_SIGNATURES,
    discard_stored_bytes,
    store_upload,
)

STUDENT_TYPES: dict[str, str] = {
    "aadhaar": "Aadhaar/ID Proof",
    "birth": "Birth Certificate",
    "tc": "TC",
    "marksheet": "Mark Sheet",
}
KINDS = {"students": "student", "employees": "employee"}
EMPLOYEE_ITEM_STATUSES = ("Approved", "Pending")
RECORD_STATUSES = ("In Progress", "Completed")
_SPACES = re.compile(r"\s+")


def _kind(kind: str) -> str:
    subject = KINDS.get(kind)
    if subject is None:
        fail(404, "not_found", "Unknown document type.")
    return subject


def _require(db: Session, actor: User, subject: str, *, write: bool) -> None:
    code = f"documents.{subject}s.{'write' if write else 'read'}"
    if code not in set(permission_codes_for(db, actor)):
        fail(403, "forbidden", "You do not have permission for this action.")


def _person(db: Session, actor: User, subject: str, ref: str) -> Student | HrEmployee:
    if subject == "student":
        try:
            student_id = uuid.UUID(str(ref))
        except ValueError:
            fail(404, "not_found", "Student was not found.")
        row = db.get(Student, student_id)
        if row is None or row.campus_id != actor.campus_id:
            fail(404, "not_found", "Student was not found.")
        return row
    row = db.scalar(
        select(HrEmployee).where(HrEmployee.employee_code == ref, HrEmployee.campus_id == actor.campus_id)
    )
    if row is None:
        fail(404, "not_found", "Employee was not found.")
    return row


def _record_for(db: Session, subject: str, person: Student | HrEmployee) -> DocumentRecord | None:
    column = DocumentRecord.student_id if subject == "student" else DocumentRecord.employee_id
    return db.scalar(
        select(DocumentRecord).options(selectinload(DocumentRecord.items)).where(column == person.id)
    )


def _doc_key(subject: str, label: str) -> tuple[str, str]:
    """(key, display label). Students use a fixed list; employees use their own label."""
    cleaned = _SPACES.sub(" ", (label or "").strip())
    if subject == "student":
        code = cleaned.lower().removeprefix("doc-")
        if code not in STUDENT_TYPES:
            fail(422, "unknown_document_type", "Choose one of: " + ", ".join(STUDENT_TYPES.values()) + ".")
        return code, STUDENT_TYPES[code]
    if not cleaned:
        fail(422, "label_required", "Enter a label for the document.")
    if len(cleaned) > 80:
        fail(422, "label_too_long", "The document label can be at most 80 characters.")
    return cleaned.lower(), cleaned


def _files(db: Session, record: DocumentRecord) -> dict[uuid.UUID, FileAsset]:
    ids = [item.file_id for item in record.items]
    if not ids:
        return {}
    return {row.id: row for row in db.scalars(select(FileAsset).where(FileAsset.id.in_(ids)))}


def _serialize(db: Session, record: DocumentRecord, person: Student | HrEmployee) -> dict:
    files = _files(db, record)
    if isinstance(person, Student):
        head = {
            "subject_id": str(person.id),
            "subject_ref": person.admission_number,
            "name": person.full_name,
            "class_name": person.class_name,
        }
    else:
        head = {
            "subject_id": str(person.id),
            "subject_ref": person.employee_code,
            "name": f"{person.first_name} {person.last_name}".strip(),
            "class_name": None,
        }
    return {
        "id": str(record.id),
        "kind": record.subject_type,
        **head,
        "submitted_date": record.submitted_date.isoformat() if record.submitted_date else None,
        "status": record.status,
        "items": [
            {
                "id": str(item.id),
                "key": item.doc_key,
                "label": item.label,
                "status": item.status,
                "file_id": str(item.file_id),
                "file_name": files[item.file_id].original_name if item.file_id in files else "",
                "size_bytes": files[item.file_id].size_bytes if item.file_id in files else 0,
                "content_type": files[item.file_id].content_type if item.file_id in files else "",
                "download_url": f"/api/v1/files/{item.file_id}/download",
                "updated_at": (item.updated_at or item.created_at).isoformat(),
            }
            for item in record.items
        ],
    }


def _who(person: Student | HrEmployee) -> str:
    """Readable identifier for audit lines: admission number or employee code."""
    return person.admission_number if isinstance(person, Student) else person.employee_code


def _student_status(record: DocumentRecord) -> str:
    return "Completed" if {item.doc_key for item in record.items} >= set(STUDENT_TYPES) else "In Progress"


def list_records(db: Session, actor: User, kind: str) -> list[dict]:
    subject = _kind(kind)
    _require(db, actor, subject, write=False)
    records = list(
        db.scalars(
            select(DocumentRecord)
            .options(selectinload(DocumentRecord.items))
            .where(DocumentRecord.campus_id == actor.campus_id, DocumentRecord.subject_type == subject)
            .order_by(DocumentRecord.created_at.desc())
        )
    )
    out = []
    for record in records:
        person = db.get(Student if subject == "student" else HrEmployee, record.student_id or record.employee_id)
        if person is not None:
            out.append(_serialize(db, record, person))
    return out


def get_record(db: Session, actor: User, kind: str, ref: str) -> dict:
    subject = _kind(kind)
    _require(db, actor, subject, write=False)
    person = _person(db, actor, subject, ref)
    record = _record_for(db, subject, person)
    if record is None:
        fail(404, "not_found", "No documents have been added for this person yet.")
    return _serialize(db, record, person)


def put_item(
    db: Session,
    actor: User,
    kind: str,
    ref: str,
    *,
    label: str,
    upload: UploadFile | None,
    status: str | None,
    submitted_date: date | None,
) -> dict:
    subject = _kind(kind)
    _require(db, actor, subject, write=True)
    person = _person(db, actor, subject, ref)
    key, display = _doc_key(subject, label)
    if subject == "employee" and status is not None and status not in EMPLOYEE_ITEM_STATUSES:
        fail(422, "invalid_status", "Status must be Approved or Pending.")

    record = _record_for(db, subject, person)
    existing = next((item for item in record.items if item.doc_key == key), None) if record else None
    if upload is None and existing is None:
        fail(422, "file_required", "Choose a file to upload.")

    new_file: FileAsset | None = None
    old_file: FileAsset | None = None
    try:
        if upload is not None:
            new_file = store_upload(
                db,
                actor,
                upload,
                resource_type=f"{subject}_document",
                resource_id=str(person.id),
                max_bytes=DOCUMENT_MAX_BYTES,
                allowed_signatures=DOCUMENT_SIGNATURES,
            )
        if record is None:
            record = DocumentRecord(
                campus_id=actor.campus_id,
                subject_type=subject,
                student_id=person.id if subject == "student" else None,
                employee_id=person.id if subject == "employee" else None,
                submitted_date=submitted_date or date.today(),
                status="In Progress",
                created_by=actor.id,
            )
            db.add(record)
            db.flush()
        item_status = "Submitted" if subject == "student" else (status or (existing.status if existing else "Pending"))
        if existing is None:
            db.add(
                DocumentItem(
                    record_id=record.id,
                    doc_key=key,
                    label=display,
                    file_id=new_file.id,
                    status=item_status,
                    uploaded_by=actor.id,
                )
            )
        else:
            existing.status = item_status
            existing.updated_at = _now()
            if new_file is not None:
                old_file = db.get(FileAsset, existing.file_id)
                existing.file_id = new_file.id
        if submitted_date is not None:
            record.submitted_date = submitted_date
        record.updated_at = _now()
        db.flush()
        db.refresh(record)
        if subject == "student":
            record.status = _student_status(record)
        write_audit(
            db,
            action="DOCUMENT_REPLACED" if existing is not None and new_file is not None else "DOCUMENT_UPLOADED",
            entity_type=f"{subject}_document",
            entity_id=str(record.id),
            actor_id=actor.id,
            campus_id=actor.campus_id,
            details=f"{display} for {_who(person)}",
        )
        if old_file is not None:
            db.flush()  # the item no longer points at it
            db.delete(old_file)
        db.commit()
    except IntegrityError:
        db.rollback()
        if new_file is not None:
            discard_stored_bytes(new_file)
        fail(409, "document_conflict", "Another change to these documents was saved at the same time. Please retry.")
    except Exception:
        db.rollback()
        if new_file is not None:
            discard_stored_bytes(new_file)
        raise
    if old_file is not None:
        discard_stored_bytes(old_file)
    return get_record(db, actor, kind, ref)


def update_record(
    db: Session, actor: User, kind: str, ref: str, *, submitted_date: date | None, status: str | None
) -> dict:
    subject = _kind(kind)
    _require(db, actor, subject, write=True)
    person = _person(db, actor, subject, ref)
    record = _record_for(db, subject, person)
    if record is None:
        fail(404, "not_found", "No documents have been added for this person yet.")
    if status is not None:
        if subject == "student":
            fail(422, "status_is_automatic", "A student's document status is set automatically.")
        if status not in RECORD_STATUSES:
            fail(422, "invalid_status", "Status must be In Progress or Completed.")
        record.status = status
    if submitted_date is not None:
        record.submitted_date = submitted_date
    record.updated_at = _now()
    write_audit(
        db,
        action="DOCUMENT_RECORD_UPDATED",
        entity_type=f"{subject}_document",
        entity_id=str(record.id),
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=_who(person),
    )
    db.commit()
    return get_record(db, actor, kind, ref)


def _remove_items(db: Session, items: list[DocumentItem]) -> list[FileAsset]:
    removed: list[FileAsset] = []
    for item in items:
        file_row = db.get(FileAsset, item.file_id)
        db.delete(item)
        if file_row is not None:
            removed.append(file_row)
    db.flush()
    for file_row in removed:
        db.delete(file_row)
    return removed


def delete_item(db: Session, actor: User, kind: str, ref: str, item_id: str) -> dict | None:
    subject = _kind(kind)
    _require(db, actor, subject, write=True)
    person = _person(db, actor, subject, ref)
    record = _record_for(db, subject, person)
    item = next((row for row in record.items if str(row.id) == str(item_id)), None) if record else None
    if item is None:
        fail(404, "not_found", "Document was not found.")
    label = item.label
    removed = _remove_items(db, [item])
    db.flush()
    db.refresh(record)
    folder_empty = not record.items
    record_id = str(record.id)
    if folder_empty:
        db.delete(record)
    elif subject == "student":
        record.status = _student_status(record)
    write_audit(
        db,
        action="DOCUMENT_REMOVED",
        entity_type=f"{subject}_document",
        entity_id=record_id,
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"{label} for {_who(person)}",
    )
    db.commit()
    for file_row in removed:
        discard_stored_bytes(file_row)
    return None if folder_empty else get_record(db, actor, kind, ref)


def delete_record(db: Session, actor: User, kind: str, ref: str) -> None:
    subject = _kind(kind)
    _require(db, actor, subject, write=True)
    person = _person(db, actor, subject, ref)
    record = _record_for(db, subject, person)
    if record is None:
        fail(404, "not_found", "No documents have been added for this person yet.")
    count = len(record.items)
    record_id = str(record.id)
    removed = [row for row in (db.get(FileAsset, item.file_id) for item in record.items) if row is not None]
    db.delete(record)  # cascades to the items
    db.flush()  # items first: they point at the files
    for file_row in removed:
        db.delete(file_row)
    write_audit(
        db,
        action="DOCUMENT_RECORD_REMOVED",
        entity_type=f"{subject}_document",
        entity_id=record_id,
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"{count} document(s) for {_who(person)}",
    )
    db.commit()
    for file_row in removed:
        discard_stored_bytes(file_row)


def authorize_file_download(db: Session, actor: User, row: FileAsset) -> None:
    """Files that sit in a document folder need that folder's read permission; other files are unchanged."""
    subject = db.scalar(
        select(DocumentRecord.subject_type)
        .join(DocumentItem, DocumentItem.record_id == DocumentRecord.id)
        .where(DocumentItem.file_id == row.id)
    )
    if subject is not None:
        _require(db, actor, subject, write=False)


def _now():
    return utcnow()
