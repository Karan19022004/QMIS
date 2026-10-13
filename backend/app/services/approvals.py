"""Approval FSM (Engine C) + in-app notifications (Engine E).

Doc rules implemented:
- Chains are role ordered (Teacher -> Coordinator -> Principal -> Director/DA).
- A denial ends the request; a new submission is required (old rows stay as history).
- Every transition is an append-only ApprovalEvent (no edit / no delete).
- Each transition notifies the next approver role or the initiator.
"""

from __future__ import annotations

import json
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import role_code_for
from app.models import ApprovalEvent, ApprovalRequest, Notification, Role, User
from app.models.base import utcnow
from app.services.audit import write_audit
from app.services.errors import fail

ACADEMIC_CHAIN = ["coordinator", "principal", "director"]

# entity_type -> (roles allowed to submit, approver chain). chain None => caller supplies it.
WORKFLOWS: dict[str, dict] = {
    "lesson_plan": {"submit": {"teacher", "coordinator"}, "chain": ACADEMIC_CHAIN},
    "marks_batch": {"submit": {"teacher", "coordinator"}, "chain": ACADEMIC_CHAIN},
    "section_change": {"submit": {"teacher", "coordinator", "principal"}, "chain": ACADEMIC_CHAIN},
    "timetable": {"submit": {"principal", "coordinator"}, "chain": ["director"]},
    "exam_timetable": {"submit": {"principal", "coordinator"}, "chain": ["director"]},
    "academic_calendar": {"submit": {"principal", "coordinator"}, "chain": ["director"]},
    "store_request": {
        "submit": {"teacher", "coordinator", "principal"},
        "chain": ["principal", "stationerystoremanager"],
    },
    "gate_pass": {"submit": {"teacher", "coordinator", "principal", "hr"}, "chain": None},
    # any staff role may file leave; the leave service computes the chain (dept head -> HR)
    "leave_request": {"submit": None, "chain": None},
}


# Types backed by a domain record; only their own services may open an approval for them.
DOMAIN_OWNED = {"lesson_plan", "marks_batch", "exam_timetable", "leave_request"}


def _chain(row: ApprovalRequest) -> list[str]:
    return json.loads(row.chain_json)


def _notify(
    db: Session,
    *,
    campus_id,
    title: str,
    body: str | None,
    entity_type: str,
    entity_id: str,
    user_id=None,
    role_code: str | None = None,
) -> None:
    db.add(
        Notification(
            campus_id=campus_id,
            user_id=user_id,
            role_code=role_code,
            title=title,
            body=body,
            entity_type=entity_type,
            entity_id=entity_id,
        )
    )


def _event(db: Session, row: ApprovalRequest, *, level: int, action: str, actor: User, role: str, comment) -> None:
    db.add(
        ApprovalEvent(
            approval_id=row.id,
            campus_id=row.campus_id,
            level=level,
            action=action,
            actor_id=actor.id,
            actor_role=role,
            comment=comment,
        )
    )


def _out(row: ApprovalRequest, events: list[ApprovalEvent] | None = None) -> dict:
    chain = _chain(row)
    data = {
        "id": str(row.id),
        "entityType": row.entity_type,
        "entityId": row.entity_id,
        "title": row.title or "",
        "initiatorId": str(row.initiator_id),
        "initiatorRole": row.initiator_role,
        "chain": chain,
        "currentLevel": row.current_level,
        "awaitingRole": chain[row.current_level] if row.status == "pending" else None,
        "status": row.status,
        "createdAt": row.created_at.isoformat(),
        "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
    }
    if events is not None:
        data["events"] = [
            {
                "level": e.level,
                "action": e.action,
                "actorId": str(e.actor_id),
                "actorRole": e.actor_role,
                "comment": e.comment or "",
                "at": e.created_at.isoformat(),
            }
            for e in events
        ]
    return data


def _get(db: Session, actor: User, approval_id: UUID) -> ApprovalRequest:
    row = db.get(ApprovalRequest, approval_id)
    if not row or row.campus_id != actor.campus_id:
        fail(404, "not_found", "Approval request not found.")
    return row


def submit(
    db: Session,
    actor: User,
    *,
    entity_type: str,
    entity_id: str,
    title: str | None,
    chain: list[str] | None,
    internal: bool = False,
) -> dict:
    wf = WORKFLOWS.get(entity_type)
    if not wf:
        fail(400, "validation_error", f"Unknown approval type '{entity_type}'.")
    if entity_type in DOMAIN_OWNED and not internal:
        fail(400, "validation_error", f"'{entity_type}' must be submitted through its own endpoint.")
    role = role_code_for(db, actor)
    if wf["submit"] is not None and role not in wf["submit"]:
        fail(403, "forbidden", f"Role '{role}' cannot submit {entity_type}.")

    if wf["chain"] is not None:
        steps = list(wf["chain"])
    else:
        steps = [str(c).strip().lower() for c in (chain or []) if str(c).strip()]
        if not steps:
            fail(400, "validation_error", "chain is required for this approval type.")
        known = set(db.scalars(select(Role.code)).all())
        bad = [c for c in steps if c not in known]
        if bad:
            fail(400, "validation_error", f"Unknown role(s) in chain: {', '.join(bad)}.")

    pending = db.scalar(
        select(ApprovalRequest).where(
            ApprovalRequest.campus_id == actor.campus_id,
            ApprovalRequest.entity_type == entity_type,
            ApprovalRequest.entity_id == entity_id,
            ApprovalRequest.status == "pending",
        )
    )
    if pending:
        fail(409, "conflict", "An approval is already pending for this item.")

    row = ApprovalRequest(
        campus_id=actor.campus_id,
        entity_type=entity_type,
        entity_id=entity_id,
        title=title,
        initiator_id=actor.id,
        initiator_role=role,
        chain_json=json.dumps(steps),
        current_level=0,
        status="pending",
    )
    db.add(row)
    db.flush()
    _event(db, row, level=0, action="submit", actor=actor, role=role, comment=None)
    label = title or f"{entity_type} {entity_id}"
    _notify(
        db,
        campus_id=actor.campus_id,
        role_code=steps[0],
        title=f"Approval needed: {label}",
        body=f"Submitted by {actor.email} ({role}).",
        entity_type=entity_type,
        entity_id=entity_id,
    )
    write_audit(
        db,
        action="APPROVAL_SUBMITTED",
        entity_type="approval",
        entity_id=str(row.id),
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"{entity_type}:{entity_id} chain={'>'.join(steps)}",
    )
    db.commit()
    db.refresh(row)
    return _out(row)


def decide(db: Session, actor: User, approval_id: UUID, *, decision: str, comment: str | None) -> dict:
    if decision not in {"approve", "deny"}:
        fail(400, "validation_error", "decision must be 'approve' or 'deny'.")
    row = _get(db, actor, approval_id)
    if row.status != "pending":
        fail(409, "conflict", f"Request is already {row.status}.")
    role = role_code_for(db, actor)
    chain = _chain(row)
    level = row.current_level
    if role != chain[level]:
        fail(403, "forbidden", f"Awaiting '{chain[level]}' approval.")
    if row.initiator_id == actor.id:
        fail(403, "forbidden", "You cannot decide your own submission.")
    if decision == "deny" and not (comment or "").strip():
        fail(400, "validation_error", "A reason is required to deny.")

    _event(db, row, level=level, action=decision, actor=actor, role=role, comment=comment)
    row.updated_at = utcnow()
    label = row.title or f"{row.entity_type} {row.entity_id}"

    if decision == "deny":
        row.status = "denied"
        _notify(
            db,
            campus_id=row.campus_id,
            user_id=row.initiator_id,
            title=f"Denied: {label}",
            body=comment,
            entity_type=row.entity_type,
            entity_id=row.entity_id,
        )
    elif level + 1 < len(chain):
        row.current_level = level + 1
        _notify(
            db,
            campus_id=row.campus_id,
            role_code=chain[level + 1],
            title=f"Approval needed: {label}",
            body=f"Approved by {role}.",
            entity_type=row.entity_type,
            entity_id=row.entity_id,
        )
    else:
        row.status = "approved"
        _notify(
            db,
            campus_id=row.campus_id,
            user_id=row.initiator_id,
            title=f"Approved: {label}",
            body=comment,
            entity_type=row.entity_type,
            entity_id=row.entity_id,
        )
    write_audit(
        db,
        action=f"APPROVAL_{decision.upper()}",
        entity_type="approval",
        entity_id=str(row.id),
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"{row.entity_type}:{row.entity_id} level={level} status={row.status}",
    )
    db.commit()
    db.refresh(row)
    return _out(row)


def inbox(db: Session, actor: User) -> list[dict]:
    """Pending requests awaiting the actor's role."""
    role = role_code_for(db, actor)
    rows = db.scalars(
        select(ApprovalRequest)
        .where(ApprovalRequest.campus_id == actor.campus_id, ApprovalRequest.status == "pending")
        .order_by(ApprovalRequest.created_at)
    ).all()
    return [_out(r) for r in rows if _chain(r)[r.current_level] == role and r.initiator_id != actor.id]


def mine(db: Session, actor: User) -> list[dict]:
    rows = db.scalars(
        select(ApprovalRequest)
        .where(ApprovalRequest.campus_id == actor.campus_id, ApprovalRequest.initiator_id == actor.id)
        .order_by(ApprovalRequest.created_at.desc())
    ).all()
    return [_out(r) for r in rows]


def lookup(db: Session, actor: User, *, entity_type: str, entity_id: str) -> list[dict]:
    rows = db.scalars(
        select(ApprovalRequest)
        .where(
            ApprovalRequest.campus_id == actor.campus_id,
            ApprovalRequest.entity_type == entity_type,
            ApprovalRequest.entity_id == entity_id,
        )
        .order_by(ApprovalRequest.created_at)
    ).all()
    return [_out(r, _events(db, r)) for r in rows]


def _events(db: Session, row: ApprovalRequest) -> list[ApprovalEvent]:
    return list(
        db.scalars(
            select(ApprovalEvent).where(ApprovalEvent.approval_id == row.id).order_by(ApprovalEvent.created_at)
        ).all()
    )


def detail(db: Session, actor: User, approval_id: UUID) -> dict:
    row = _get(db, actor, approval_id)
    return _out(row, _events(db, row))


# ---------------------------------------------------------------- notifications


def _notif_out(n: Notification) -> dict:
    return {
        "id": str(n.id),
        "title": n.title,
        "body": n.body or "",
        "entityType": n.entity_type,
        "entityId": n.entity_id,
        "read": n.read_at is not None,
        "createdAt": n.created_at.isoformat(),
    }


def list_notifications(db: Session, actor: User, *, unread_only: bool = False) -> list[dict]:
    role = role_code_for(db, actor)
    rows = db.scalars(
        select(Notification)
        .where(Notification.campus_id == actor.campus_id)
        .order_by(Notification.created_at.desc())
    ).all()
    mine_ = [n for n in rows if n.user_id == actor.id or (n.user_id is None and n.role_code == role)]
    if unread_only:
        mine_ = [n for n in mine_ if n.read_at is None]
    return [_notif_out(n) for n in mine_]


def mark_read(db: Session, actor: User, notification_id: UUID) -> dict:
    n = db.get(Notification, notification_id)
    role = role_code_for(db, actor)
    if (
        not n
        or n.campus_id != actor.campus_id
        or not (n.user_id == actor.id or (n.user_id is None and n.role_code == role))
    ):
        fail(404, "not_found", "Notification not found.")
    if n.read_at is None:
        n.read_at = datetime.now(n.created_at.tzinfo) if n.created_at.tzinfo else utcnow()
        db.commit()
    return _notif_out(n)
