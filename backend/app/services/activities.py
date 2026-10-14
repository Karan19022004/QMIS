"""Cultural, sports and competition activities, plus chess-result players."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import permission_codes_for, role_code_for
from app.models import Activity, ActivityPlayer, User
from app.models.base import utcnow
from app.permissions.matrix import ALL_ROLES
from app.services.audit import write_audit
from app.services.errors import fail

TYPES = ("cultural", "sports", "competition")
APPROVALS = ("Pending", "Approved", "Rejected")
PREFIX = {"cultural": "ACT-CUL", "sports": "ACT-SPT", "competition": "ACT-CMP"}
NAME_MAX = 200
FIELD_MAX = 160
DESC_MAX = 2000
PLAYER_RESULTS = ("Winner", "Runner Up", "Third Place", "Completed")
ROLE_NAMES = dict(ALL_ROLES)


def _has(db: Session, actor: User, code: str) -> bool:
    return code in permission_codes_for(db, actor)


def _find(db: Session, actor: User, ref: str) -> Activity:
    row = None
    try:
        row = db.get(Activity, UUID(ref))
    except ValueError:
        row = db.scalar(select(Activity).where(Activity.campus_id == actor.campus_id, Activity.code == ref.strip().upper()))
    if row is None or row.campus_id != actor.campus_id:
        fail(404, "not_found", "Activity not found.")
    return row


def _player_out(player: ActivityPlayer) -> dict:
    return {
        "id": str(player.id),
        "rank": player.rank,
        "name": player.name,
        "category": player.category,
        "className": player.class_name,
        "school": player.school,
        "rating": player.rating,
        "score": player.score,
        "tieBreak": player.tie_break,
        "result": player.result,
    }


def _out(row: Activity) -> dict:
    return {
        "id": row.code,
        "uuid": str(row.id),
        "type": row.activity_type,
        "eventName": row.event_name,
        "eventType": row.event_type,
        "className": row.class_name,
        "eventDate": row.event_date.isoformat(),
        "startTime": row.start_time,
        "endTime": row.end_time,
        "venue": row.venue,
        "coordinator": row.coordinator,
        "coach": row.coach,
        "description": row.description,
        "submittedBy": row.submitted_by,
        "submittedDate": row.submitted_date.isoformat(),
        "mdApprovalStatus": row.md_approval_status,
        "players": [_player_out(p) for p in row.players],
    }


def list_activities(db: Session, actor: User, *, activity_type: str | None = None) -> list[dict]:
    if not _has(db, actor, "activities.read"):
        fail(403, "forbidden", "You are not allowed to view activities.")
    query = select(Activity).where(Activity.campus_id == actor.campus_id).order_by(Activity.event_date.desc())
    if activity_type:
        if activity_type not in TYPES:
            fail(422, "invalid_type", "Type must be cultural, sports or competition.")
        query = query.where(Activity.activity_type == activity_type)
    return [_out(row) for row in db.scalars(query).all()]


def get_activity(db: Session, actor: User, ref: str) -> dict:
    if not _has(db, actor, "activities.read"):
        fail(403, "forbidden", "You are not allowed to view activities.")
    return _out(_find(db, actor, ref))


def as_calendar_items(db: Session, actor: User) -> list[dict]:
    rows = db.scalars(
        select(Activity).where(Activity.campus_id == actor.campus_id, Activity.md_approval_status != "Rejected")
    ).all()
    labels = {"cultural": "Cultural", "sports": "Sports", "competition": "Competition"}
    items = []
    for row in rows:
        pending = " (Pending Super Admin approval)" if row.md_approval_status == "Pending" else ""
        time_range = f"{row.start_time} – {row.end_time}" if row.start_time and row.end_time else ""
        items.append(
            {
                "id": f"cal-{row.code}",
                "type": "event",
                "title": row.event_name,
                "startDate": row.event_date.isoformat(),
                "endDate": row.event_date.isoformat(),
                "description": " · ".join(
                    part for part in (labels[row.activity_type], row.event_type, row.venue, row.class_name, time_range, row.description)
                    if part
                )
                + pending,
                "activityId": row.code,
            }
        )
    return items


def _next_code(db: Session, campus_id, activity_type: str) -> str:
    prefix = PREFIX[activity_type]
    codes = db.scalars(
        select(Activity.code).where(Activity.campus_id == campus_id, Activity.activity_type == activity_type)
    ).all()
    n = max((int(c.split("-")[2]) for c in codes if c.startswith(prefix + "-") and c.split("-")[-1].isdigit()), default=0) + 1
    return f"{prefix}-{n:03d}"


def _replace_players(db: Session, row: Activity, players: list[dict] | None) -> None:
    if players is None:
        return
    row.players.clear()
    db.flush()
    for index, raw in enumerate(players, start=1):
        name = str(raw.get("name") or "").strip()
        if not name:
            continue
        result = raw.get("result") or "Completed"
        if result not in PLAYER_RESULTS:
            fail(422, "invalid_result", "Player result must be Winner, Runner Up, Third Place or Completed.")
        try:
            rank = int(raw.get("rank") or index)
        except (TypeError, ValueError):
            fail(422, "invalid_rank", "Player rank must be a number.")
        if rank < 1:
            fail(422, "invalid_rank", "Player rank must be at least 1.")
        row.players.append(
            ActivityPlayer(
                rank=rank,
                name=name[:80],
                category=str(raw.get("category") or "")[:40],
                class_name=str(raw.get("className") or "")[:40],
                school=str(raw.get("school") or "")[:80],
                rating=str(raw.get("rating") or "")[:16],
                score=str(raw.get("score") or "")[:16],
                tie_break=str(raw.get("tieBreak") or "")[:16],
                result=result,
            )
        )


def _fields(payload: dict) -> dict:
    name = (payload.get("eventName") or "").strip()
    if not name:
        fail(422, "name_required", "Event name is required.")
    if len(name) > NAME_MAX:
        fail(422, "name_too_long", f"Event name can be at most {NAME_MAX} characters.")
    event_date = payload.get("eventDate")
    if not isinstance(event_date, date):
        fail(422, "date_required", "Event date is required.")
    if event_date.year < 2020 or event_date.year > 2035:
        fail(422, "invalid_date", "Event date must fall between 2020 and 2035.")
    description = (payload.get("description") or "").strip()
    if len(description) > DESC_MAX:
        fail(422, "description_too_long", f"Description can be at most {DESC_MAX} characters.")
    return {
        "event_name": name,
        "event_type": (payload.get("eventType") or "").strip()[:80],
        "class_name": (payload.get("className") or "").strip()[:80],
        "event_date": event_date,
        "start_time": (payload.get("startTime") or "").strip()[:16],
        "end_time": (payload.get("endTime") or "").strip()[:16],
        "venue": (payload.get("venue") or "").strip()[:FIELD_MAX],
        "coordinator": (payload.get("coordinator") or "").strip()[:80],
        "coach": (payload.get("coach") or "").strip()[:80],
        "description": description,
    }


def create(db: Session, actor: User, *, activity_type: str, payload: dict) -> dict:
    if not _has(db, actor, "activities.write"):
        fail(403, "forbidden", "You are not allowed to add activities.")
    if activity_type not in TYPES:
        fail(422, "invalid_type", "Type must be cultural, sports or competition.")
    fields = _fields(payload)
    role = role_code_for(db, actor)
    row = Activity(
        campus_id=actor.campus_id,
        code=_next_code(db, actor.campus_id, activity_type),
        activity_type=activity_type,
        submitted_by=ROLE_NAMES.get(role, role)[:80],
        submitted_date=date.today(),
        md_approval_status="Pending",
        created_by=actor.id,
        **fields,
    )
    try:
        db.add(row)
        db.flush()
    except IntegrityError:
        db.rollback()
        fail(409, "code_conflict", "Could not number the activity. Please try again.")
    _replace_players(db, row, payload.get("players"))
    write_audit(
        db, action="ACTIVITY_CREATED", entity_type="activity", entity_id=str(row.id),
        actor_id=actor.id, campus_id=actor.campus_id, details=row.code,
    )
    db.commit()
    db.refresh(row)
    return _out(row)


def update(db: Session, actor: User, ref: str, payload: dict) -> dict:
    if not _has(db, actor, "activities.write"):
        fail(403, "forbidden", "You are not allowed to change activities.")
    row = _find(db, actor, ref)
    fields = _fields({**_out(row), **payload, "eventDate": payload.get("eventDate") or row.event_date})
    for key, value in fields.items():
        setattr(row, key, value)
    row.updated_at = utcnow()
    if "players" in payload:
        _replace_players(db, row, payload.get("players"))
    write_audit(
        db, action="ACTIVITY_UPDATED", entity_type="activity", entity_id=str(row.id),
        actor_id=actor.id, campus_id=actor.campus_id, details=row.code,
    )
    db.commit()
    db.refresh(row)
    return _out(row)


def delete(db: Session, actor: User, ref: str) -> None:
    if not _has(db, actor, "activities.write"):
        fail(403, "forbidden", "You are not allowed to remove activities.")
    row = _find(db, actor, ref)
    write_audit(
        db, action="ACTIVITY_REMOVED", entity_type="activity", entity_id=str(row.id),
        actor_id=actor.id, campus_id=actor.campus_id, details=row.code,
    )
    db.delete(row)
    db.commit()


def decide(db: Session, actor: User, ref: str, status: str) -> dict:
    if not _has(db, actor, "activities.approve"):
        fail(403, "forbidden", "You are not allowed to approve activities.")
    if status not in APPROVALS:
        fail(422, "invalid_status", "Status must be Pending, Approved or Rejected.")
    row = _find(db, actor, ref)
    row.md_approval_status = status
    row.updated_at = utcnow()
    write_audit(
        db, action=f"ACTIVITY_{status.upper()}", entity_type="activity", entity_id=str(row.id),
        actor_id=actor.id, campus_id=actor.campus_id, details=row.code,
    )
    db.commit()
    return _out(row)
