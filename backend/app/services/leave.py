"""Leave and permission requests (Y-4, Academics doc 4.9 + confirmed 'Permission request' decision).

Rules:
- Any staff user files a request; it is approved/denied by the department head and HR (approval engine).
  The department-head step follows the approver map the frontend already uses (teacher -> Principal,
  principal -> Director, gate keeper -> Gate Keeper Manager, driver -> Transport Manager ...).
- Permission = short absence of at most 2 hours on a single day; shows as Permission, not Absent/Leave.
- No edit / no delete once filed (no cancel endpoint either - per the doc's immutability rule).
- Approved leave is exposed via ``on_leave`` so attendance can auto-mark Leave.
"""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import role_code_for
from app.models import ApprovalRequest, LeaveRequest, User
from app.services import approvals
from app.services.audit import write_audit
from app.services.errors import fail

LEAVE_TYPES = [
    "Sick Leave",
    "Casual Leave",
    "Emergency Leave",
    "Personal Leave",
    "Medical Leave",
    "Week-Off",
    "Permission",
]
MAX_PERMISSION_HOURS = 2.0
NON_STAFF = {"student", "parent"}

# first approver (department head) per requester role - mirrors src/Common/LeaveRequest/leaveRequestConfigs.js
DEPT_HEAD = {
    "teacher": "principal",
    "coordinator": "principal",
    "principal": "director",
    "director": "admin",
    "jointdirector": "director",
    "prm": "director",
    "gatekeeper": "gatekeepermanager",
    "gatekeepermanager": "director",
    "driver": "transportmanager",
    "admin": "superadmin",
}
DEFAULT_HEAD = "director"
STATUS_LABEL = {"pending": "Pending", "approved": "Approved", "denied": "Rejected"}
VIEW_ALL_ROLES = {"hr", "admin", "superadmin", "managing_director"}


def chain_for(requester_role: str) -> list[str]:
    head = DEPT_HEAD.get(requester_role, DEFAULT_HEAD)
    chain = [head]
    if requester_role != "hr" and head != "hr":
        chain.append("hr")
    return chain


def _appr(db: Session, row: LeaveRequest) -> ApprovalRequest | None:
    return db.get(ApprovalRequest, row.approval_id) if row.approval_id else None


def _out(db: Session, row: LeaveRequest, *, events: bool = False) -> dict:
    appr = _appr(db, row)
    detail = approvals._out(appr) if appr else {}
    requester = db.get(User, row.requester_id)
    data = {
        "id": str(row.id),
        "leaveRequestId": f"LR-{row.request_no:04d}",
        "requestedBy": requester.email if requester else "",
        "submitterRole": row.requester_role,
        "leaveType": row.leave_type,
        "fromDate": row.from_date.isoformat(),
        "toDate": row.to_date.isoformat(),
        "totalDays": row.total_days,
        "hours": row.hours,
        "reason": row.reason,
        "appliedDate": row.created_at.date().isoformat(),
        "status": STATUS_LABEL[appr.status] if appr else "Pending",
        "chain": detail.get("chain", []),
        "requestedTo": detail["chain"][0] if detail.get("chain") else "",
        "approverRole": detail.get("awaitingRole"),
        "currentLevel": detail.get("currentLevel", 0),
        "approvalId": str(appr.id) if appr else None,
    }
    if appr:
        full = approvals.detail(db, requester, appr.id)  # type: ignore[arg-type]
        last = full["events"][-1] if full["events"] else None
        data["approverRemarks"] = last["comment"] if last and last["action"] != "submit" else ""
        if events:
            data["events"] = full["events"]
    return data


def _load(db: Session, actor: User, request_id: UUID) -> LeaveRequest:
    row = db.get(LeaveRequest, request_id)
    if not row or row.campus_id != actor.campus_id:
        fail(404, "not_found", "Leave request not found.")
    role = role_code_for(db, actor)
    if row.requester_id != actor.id and role not in VIEW_ALL_ROLES and not _reached(db, row, role):
        fail(404, "not_found", "Leave request not found.")
    return row


def _reached(db: Session, row: LeaveRequest, role: str) -> bool:
    appr = _appr(db, row)
    if not appr:
        return False
    chain = approvals._chain(appr)
    return role in chain and chain.index(role) <= appr.current_level


def create(
    db: Session,
    actor: User,
    *,
    leave_type: str,
    from_date: date,
    to_date: date,
    hours: float | None,
    reason: str,
) -> dict:
    role = role_code_for(db, actor)
    if role in NON_STAFF:
        fail(403, "forbidden", "Only staff can file leave requests.")
    if leave_type not in LEAVE_TYPES:
        fail(400, "validation_error", f"leaveType must be one of: {', '.join(LEAVE_TYPES)}.")
    if not reason or not reason.strip():
        fail(400, "validation_error", "A reason is required.")
    if to_date < from_date:
        fail(400, "validation_error", "toDate cannot be before fromDate.")
    if leave_type == "Permission":
        if from_date != to_date:
            fail(400, "validation_error", "Permission is for a single day.")
        if hours is None or not (0 < hours <= MAX_PERMISSION_HOURS):
            fail(400, "validation_error", f"Permission needs hours between 0 and {MAX_PERMISSION_HOURS:g}.")
    elif hours is not None:
        fail(400, "validation_error", "hours applies to Permission requests only.")

    # overlap with the requester's own active (pending/approved) requests
    for other in db.scalars(
        select(LeaveRequest).where(
            LeaveRequest.campus_id == actor.campus_id,
            LeaveRequest.requester_id == actor.id,
            LeaveRequest.from_date <= to_date,
            LeaveRequest.to_date >= from_date,
        )
    ).all():
        appr = _appr(db, other)
        if appr is not None and appr.status == "denied":
            continue
        if leave_type == "Permission" and other.leave_type == "Permission":
            continue
        fail(409, "conflict", f"Overlaps your request {other.leave_type} ({other.from_date} to {other.to_date}).")

    next_no = (db.scalar(select(func.max(LeaveRequest.request_no)).where(LeaveRequest.campus_id == actor.campus_id)) or 0) + 1
    row = LeaveRequest(
        campus_id=actor.campus_id,
        request_no=next_no,
        requester_id=actor.id,
        requester_role=role,
        leave_type=leave_type,
        from_date=from_date,
        to_date=to_date,
        total_days=(to_date - from_date).days + 1,
        hours=hours,
        reason=reason.strip(),
    )
    db.add(row)
    db.flush()
    appr = approvals.submit(
        db,
        actor,
        entity_type="leave_request",
        entity_id=str(row.id),
        title=f"{leave_type} {from_date.isoformat()}" + ("" if from_date == to_date else f" to {to_date.isoformat()}"),
        chain=chain_for(role),
        internal=True,
    )
    row.approval_id = UUID(appr["id"])
    write_audit(db, action="LEAVE_REQUESTED", entity_type="leave_request", entity_id=str(row.id),
                actor_id=actor.id, campus_id=actor.campus_id, details=f"{leave_type} {row.total_days}d")
    db.commit()
    return _out(db, row)


def get(db: Session, actor: User, request_id: UUID) -> dict:
    return _out(db, _load(db, actor, request_id), events=True)


def list_requests(db: Session, actor: User, *, box: str, status: str | None) -> list[dict]:
    role = role_code_for(db, actor)
    rows = db.scalars(
        select(LeaveRequest).where(LeaveRequest.campus_id == actor.campus_id).order_by(LeaveRequest.request_no.desc())
    ).all()
    if box == "mine":
        rows = [r for r in rows if r.requester_id == actor.id]
    elif box == "received":
        rows = [r for r in rows if r.requester_id != actor.id and _reached(db, r, role)]
    elif box == "all":
        if role not in VIEW_ALL_ROLES:
            fail(403, "forbidden", "Not allowed to list all leave requests.")
    else:
        fail(400, "validation_error", "box must be mine, received or all.")
    out = [_out(db, r) for r in rows]
    return [o for o in out if o["status"] == status] if status else out


def decide(db: Session, actor: User, request_id: UUID, *, decision: str, comment: str | None) -> dict:
    row = _load(db, actor, request_id)
    if not row.approval_id:
        fail(409, "conflict", "Request has no approval attached.")
    approvals.decide(db, actor, row.approval_id, decision=decision, comment=comment)
    write_audit(db, action=f"LEAVE_{decision.upper()}", entity_type="leave_request", entity_id=str(row.id),
                actor_id=actor.id, campus_id=actor.campus_id)
    db.commit()
    return _out(db, row, events=True)


def on_leave(db: Session, actor: User, day: date) -> list[dict]:
    """Approved leave/permission covering ``day`` - used to auto-mark Leave/Permission in attendance."""
    rows = db.scalars(
        select(LeaveRequest).where(
            LeaveRequest.campus_id == actor.campus_id, LeaveRequest.from_date <= day, LeaveRequest.to_date >= day
        )
    ).all()
    out = []
    for r in rows:
        appr = _appr(db, r)
        if appr is None or appr.status != "approved":
            continue
        user = db.get(User, r.requester_id)
        out.append(
            {
                "userId": str(r.requester_id),
                "email": user.email if user else "",
                "role": r.requester_role,
                "leaveType": r.leave_type,
                "attendanceStatus": "Permission" if r.leave_type == "Permission" else "Leave",
                "hours": r.hours,
                "leaveRequestId": f"LR-{r.request_no:04d}",
            }
        )
    return out
