"""Transfer Certificate requests: filed, forwarded by PRM, decided by an administrator."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import permission_codes_for, role_code_for
from app.models import Student, TcRequest, User
from app.models.base import utcnow
from app.services.approvals import _notify
from app.services.audit import write_audit
from app.services.errors import fail

STATUSES = (
    "Pending PRM Review",
    "Pending Super Admin Approval",
    "Approved",
    "Rejected",
)
REASON_MAX = 2000
TRANSFER_MAX = 200
REMARKS_MAX = 1000


def _has(db: Session, actor: User, code: str) -> bool:
    return code in permission_codes_for(db, actor)


def _student(db: Session, actor: User, ref: str) -> Student:
    row = None
    try:
        row = db.get(Student, UUID(ref))
    except ValueError:
        row = db.scalar(
            select(Student).where(Student.campus_id == actor.campus_id, Student.admission_number == ref.strip())
        )
    if row is None or row.campus_id != actor.campus_id:
        fail(404, "not_found", "Student not found.")
    return row


def _find(db: Session, actor: User, ref: str) -> TcRequest:
    row = None
    try:
        row = db.get(TcRequest, UUID(ref))
    except ValueError:
        row = db.scalar(select(TcRequest).where(TcRequest.campus_id == actor.campus_id, TcRequest.code == ref.strip().upper()))
    if row is None or row.campus_id != actor.campus_id:
        fail(404, "not_found", "TC request not found.")
    return row


def _out(db: Session, row: TcRequest) -> dict:
    student = db.get(Student, row.student_id)
    return {
        "id": row.code,
        "requestId": row.code,
        "uuid": str(row.id),
        "studentId": str(row.student_id),
        "studentName": student.full_name if student else "",
        "classSection": student.class_name if student else "",
        "admissionNumber": student.admission_number if student else "",
        "reason": row.reason,
        "transferTo": row.transfer_to,
        "lastDateOfAttendance": row.last_date_of_attendance.isoformat() if row.last_date_of_attendance else "",
        "requestedBy": row.requested_by,
        "requestedOn": row.requested_on.isoformat(),
        "status": row.status,
        "prmRemarks": row.prm_remarks,
        "superAdminRemarks": row.admin_remarks,
        "forwardedOn": row.forwarded_on.isoformat() if row.forwarded_on else "",
        "approvedOn": row.decided_on.isoformat() if row.status == "Approved" and row.decided_on else "",
        "rejectedOn": row.decided_on.isoformat() if row.status == "Rejected" and row.decided_on else "",
        "tcNumber": row.tc_number,
        "tcIssuedDate": row.decided_on.isoformat() if row.status == "Approved" and row.decided_on else "",
        "tcDocumentName": f"Transfer-Certificate-{student.admission_number}.pdf" if row.status == "Approved" and student else "",
    }


def list_requests(db: Session, actor: User) -> list[dict]:
    if not _has(db, actor, "tc.read"):
        fail(403, "forbidden", "You are not allowed to view TC requests.")
    rows = db.scalars(
        select(TcRequest).where(TcRequest.campus_id == actor.campus_id).order_by(TcRequest.created_at.desc())
    ).all()
    return [_out(db, row) for row in rows]


def get_request(db: Session, actor: User, ref: str) -> dict:
    if not _has(db, actor, "tc.read"):
        fail(403, "forbidden", "You are not allowed to view TC requests.")
    return _out(db, _find(db, actor, ref))


def _next_code(db: Session, campus_id) -> str:
    codes = db.scalars(select(TcRequest.code).where(TcRequest.campus_id == campus_id)).all()
    n = max((int(c.split("-")[2]) for c in codes if c.startswith("TC-REQ-") and c[7:].isdigit()), default=0) + 1
    return f"TC-REQ-{n:03d}"


def create(
    db: Session,
    actor: User,
    *,
    student_ref: str,
    reason: str,
    transfer_to: str,
    last_date: date | None,
    requested_by: str | None,
) -> dict:
    if not _has(db, actor, "tc.write"):
        fail(403, "forbidden", "You are not allowed to file a TC request.")
    student = _student(db, actor, student_ref)
    reason = (reason or "").strip()
    transfer_to = (transfer_to or "").strip()
    if not reason:
        fail(422, "reason_required", "A reason is required.")
    if len(reason) > REASON_MAX:
        fail(422, "reason_too_long", f"Reason can be at most {REASON_MAX} characters.")
    if not transfer_to:
        fail(422, "transfer_to_required", "The receiving school is required.")
    if len(transfer_to) > TRANSFER_MAX:
        fail(422, "transfer_to_too_long", f"The receiving school can be at most {TRANSFER_MAX} characters.")
    open_one = db.scalar(
        select(TcRequest).where(
            TcRequest.student_id == student.id,
            TcRequest.status.in_(("Pending PRM Review", "Pending Super Admin Approval")),
        )
    )
    if open_one:
        fail(409, "already_open", "This student already has an open TC request.")
    role = role_code_for(db, actor)
    row = TcRequest(
        campus_id=actor.campus_id,
        code=_next_code(db, actor.campus_id),
        student_id=student.id,
        reason=reason,
        transfer_to=transfer_to,
        last_date_of_attendance=last_date,
        requested_by=(requested_by or role_code_for(db, actor))[:80],
        requested_on=date.today(),
        status="Pending PRM Review",
        created_by=actor.id,
    )
    try:
        db.add(row)
        db.flush()
    except IntegrityError:
        db.rollback()
        fail(409, "code_conflict", "Could not number the request. Please try again.")
    _notify(
        db, campus_id=actor.campus_id, title=f"TC request {row.code}",
        body=f"{student.full_name} — awaiting PRM review.", entity_type="tc_request",
        entity_id=row.code, role_code="prm",
    )
    write_audit(
        db, action="TC_REQUESTED", entity_type="tc_request", entity_id=str(row.id),
        actor_id=actor.id, campus_id=actor.campus_id, details=row.code,
    )
    db.commit()
    return _out(db, row)


def forward(db: Session, actor: User, ref: str, remarks: str) -> dict:
    if not _has(db, actor, "tc.write"):
        fail(403, "forbidden", "You are not allowed to forward a TC request.")
    row = _find(db, actor, ref)
    if row.status != "Pending PRM Review":
        fail(409, "wrong_status", "Only a request awaiting PRM review can be forwarded.")
    remarks = (remarks or "").strip()
    if len(remarks) > REMARKS_MAX:
        fail(422, "remarks_too_long", f"Remarks can be at most {REMARKS_MAX} characters.")
    row.prm_remarks = remarks
    row.status = "Pending Super Admin Approval"
    row.forwarded_on = date.today()
    row.updated_at = utcnow()
    _notify(
        db, campus_id=actor.campus_id, title=f"TC request {row.code} forwarded",
        body="Awaiting administrator approval.", entity_type="tc_request",
        entity_id=row.code, role_code="admin",
    )
    write_audit(
        db, action="TC_FORWARDED", entity_type="tc_request", entity_id=str(row.id),
        actor_id=actor.id, campus_id=actor.campus_id, details=row.code,
    )
    db.commit()
    return _out(db, row)


def decide(db: Session, actor: User, ref: str, *, decision: str, remarks: str) -> dict:
    if not _has(db, actor, "tc.decide"):
        fail(403, "forbidden", "You are not allowed to decide a TC request.")
    row = _find(db, actor, ref)
    if row.status != "Pending Super Admin Approval":
        fail(409, "wrong_status", "Only a request awaiting administrator approval can be decided.")
    decision = (decision or "").strip().lower()
    if decision not in {"approve", "reject"}:
        fail(422, "invalid_decision", "Decision must be approve or reject.")
    remarks = (remarks or "").strip()
    if decision == "reject" and not remarks:
        fail(422, "remarks_required", "A remark is required when rejecting.")
    if len(remarks) > REMARKS_MAX:
        fail(422, "remarks_too_long", f"Remarks can be at most {REMARKS_MAX} characters.")
    student = db.get(Student, row.student_id)
    row.admin_remarks = remarks
    row.decided_on = date.today()
    row.updated_at = utcnow()
    if decision == "approve":
        row.status = "Approved"
        digits = "".join(ch for ch in (student.admission_number if student else "") if ch.isdigit())[-4:] or "0001"
        row.tc_number = f"TC/{date.today().year}/{digits}"
        action = "TC_APPROVED"
    else:
        row.status = "Rejected"
        action = "TC_REJECTED"
    _notify(
        db, campus_id=actor.campus_id, title=f"TC request {row.code} {row.status.lower()}",
        body=remarks or row.status, entity_type="tc_request", entity_id=row.code, role_code="prm",
    )
    write_audit(
        db, action=action, entity_type="tc_request", entity_id=str(row.id),
        actor_id=actor.id, campus_id=actor.campus_id, details=row.code,
    )
    db.commit()
    return _out(db, row)
