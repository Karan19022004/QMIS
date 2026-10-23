"""Campus audit collections: JD Audit configuration + Process/Quality execution."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.deps import role_code_for
from app.models import CampusAuditRecord, User
from app.services.errors import fail

COLLECTIONS: dict[str, str] = {
    # JD Audit configuration / planning
    "audit-templates": "ATM",
    "audit-checklist-sections": "ACS",
    "audit-question-bank": "AQB",
    "audit-response-types": "ART",
    "audit-scoring-rules": "ASR",
    "audit-workflow-rules": "AWR",
    "audit-visibility-rules": "AVR",
    "audit-template-versions": "ATV",
    "audit-published-templates": "APT",
    "audit-plans": "APL",
    "audit-monitoring": "AMN",
    "audit-findings": "AFD",
    "audit-assignments": "AAS",
    "audit-assignment-history": "AAH",
    "audit-workload": "AWL",
    "audit-reports-analytics": "ARA",
    "audit-components": "ACP",
    "audit-shared-deviations": "ASD",
    # Process auditor execution
    "process-my-audits": "PMA",
    "process-audit-schedule": "PAS",
    "process-execute-draft": "PED",
    "process-audit-templates": "PAT",
    "process-audit-history": "PAH",
    "process-observations": "POB",
    "process-rca": "PRCA",
    "process-atr": "PATR",
    "process-escalations": "PES",
    "process-audit-reports": "PAR",
    "process-actions-reports": "PAC",
    "process-compliance-reports": "PCR",
    "process-observation-reports": "POR",
    # Quality auditor execution
    "quality-my-audits": "QMA",
    "quality-audit-schedule": "QAS",
    "quality-execute-draft": "QED",
    "quality-audit-templates": "QAT",
    "quality-audit-history": "QAH",
    "quality-observations": "QOB",
    "quality-rca": "QRCA",
    "quality-atr": "QATR",
    "quality-escalations": "QES",
    "quality-audit-reports": "QAR",
    "quality-actions-reports": "QAC",
    "quality-compliance-reports": "QCR",
    "quality-observation-reports": "QOR",
}

_ADMINS = {"admin", "superadmin", "managing_director"}
_JD_AUDIT = {"jointdirectoraudit"} | _ADMINS
_PROCESS = {"processauditor"} | _ADMINS
_QUALITY = {"qualityauditor"} | _ADMINS
_READ_ALL_AUDIT = _JD_AUDIT | _PROCESS | _QUALITY | {"jointdirector", "principal", "director"}


def _writers_for(collection: str) -> set[str]:
    if collection.startswith("process-"):
        return _PROCESS | _JD_AUDIT
    if collection.startswith("quality-"):
        return _QUALITY | _JD_AUDIT
    if collection.startswith("audit-"):
        return _JD_AUDIT
    return _ADMINS


def _readers_for(collection: str) -> set[str]:
    return _READ_ALL_AUDIT | _writers_for(collection)


def _code(db: Session, actor: User) -> str:
    return role_code_for(db, actor)


def _ensure_collection(collection: str) -> None:
    if collection not in COLLECTIONS:
        fail(404, "not_found", "That audit collection does not exist.")


def _can_read(db: Session, actor: User, collection: str) -> bool:
    return _code(db, actor) in _readers_for(collection)


def _can_write(db: Session, actor: User, collection: str) -> bool:
    return _code(db, actor) in _writers_for(collection)


def _as_item(row: CampusAuditRecord) -> dict:
    body = dict(row.body or {})
    body["id"] = row.public_id
    body["_collection"] = row.collection
    body["_updatedAt"] = row.updated_at.isoformat() if row.updated_at else None
    body["_createdAt"] = row.created_at.isoformat() if row.created_at else None
    return body


def _public_id_for(body: dict, fallback: str) -> str:
    for key in ("id", "templateId", "planId", "assignmentId", "observationId"):
        value = body.get(key)
        if value:
            return str(value).strip()
    return fallback


def list_records(db: Session, actor: User, collection: str) -> list[dict]:
    _ensure_collection(collection)
    if not _can_read(db, actor, collection):
        fail(403, "forbidden", "You are not allowed to view audit records.")
    rows = db.scalars(
        select(CampusAuditRecord)
        .where(
            CampusAuditRecord.campus_id == actor.campus_id,
            CampusAuditRecord.collection == collection,
        )
        .order_by(CampusAuditRecord.created_at.desc())
    ).all()
    return [_as_item(row) for row in rows]


def replace_records(db: Session, actor: User, collection: str, items: list) -> list[dict]:
    _ensure_collection(collection)
    if not _can_write(db, actor, collection):
        fail(403, "forbidden", "You are not allowed to change audit records.")
    if not isinstance(items, list):
        fail(422, "invalid_body", "Body must be a JSON array.")

    previous = list_records(db, actor, collection)
    db.execute(
        delete(CampusAuditRecord).where(
            CampusAuditRecord.campus_id == actor.campus_id,
            CampusAuditRecord.collection == collection,
        )
    )

    now = datetime.now(timezone.utc)
    prefix = COLLECTIONS[collection]
    seen: set[str] = set()
    for index, raw in enumerate(items):
        if not isinstance(raw, dict):
            fail(422, "invalid_body", "Each item must be an object.")
        fallback = f"{prefix}-{index + 1:04d}"
        public_id = _public_id_for(raw, fallback)
        if not public_id:
            fail(422, "invalid_body", "Each item needs an id.")
        if public_id in seen:
            fail(422, "duplicate", f"Duplicate id in payload: {public_id}")
        seen.add(public_id)
        payload = {**raw, "id": public_id}
        db.add(
            CampusAuditRecord(
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
    saved = list_records(db, actor, collection)
    from app.services.integrations.events import notify_saved_audit
    notify_saved_audit(db, actor, collection, previous, saved)
    return saved
