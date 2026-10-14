"""Academic calendar: holidays, exam windows and school events.

The list every role sees is the persisted events plus (when activities exist) approved/pending
activities as ``event`` items. Who may add or change an event is ``calendar.write``.
"""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import permission_codes_for
from app.models import CalendarEvent, User
from app.models.base import utcnow
from app.services.audit import write_audit
from app.services.errors import fail

EVENT_TYPES = ("holiday", "exam", "event")
TITLE_MAX = 200
DESCRIPTION_MAX = 2000
# The holidays / exam windows / events the school calendar starts with (one row per campus, by code).
DEFAULT_EVENTS = [
    ("hol-1", "holiday", "Republic Day", date(2026, 1, 26), date(2026, 1, 26), "National holiday. School remains closed."),
    ("hol-2", "holiday", "Holi", date(2026, 3, 14), date(2026, 3, 14), "Festival holiday."),
    ("hol-3", "holiday", "Good Friday", date(2026, 4, 3), date(2026, 4, 3), "School holiday."),
    ("hol-4", "holiday", "Summer Break", date(2026, 5, 15), date(2026, 6, 15), "Summer vacation for all classes."),
    ("hol-5", "holiday", "Independence Day", date(2026, 8, 15), date(2026, 8, 15), "National holiday. Flag hoisting ceremony on campus."),
    ("hol-6", "holiday", "Gandhi Jayanti", date(2026, 10, 2), date(2026, 10, 2), "National holiday."),
    ("hol-7", "holiday", "Diwali Break", date(2026, 11, 8), date(2026, 11, 12), "Festival holidays."),
    ("hol-8", "holiday", "Christmas", date(2026, 12, 25), date(2026, 12, 25), "Christmas holiday."),
    ("exam-1", "exam", "Unit Test – I", date(2026, 7, 20), date(2026, 7, 25), "Unit Test I for Classes VI–XII."),
    ("exam-2", "exam", "Mid Term Examinations", date(2026, 9, 14), date(2026, 9, 26), "Mid-term exam timeline across all grades."),
    ("exam-3", "exam", "Unit Test – II", date(2026, 11, 16), date(2026, 11, 21), "Unit Test II for Classes VI–XII."),
    ("exam-4", "exam", "Final Term Examinations", date(2027, 2, 16), date(2027, 3, 5), "Final / annual examination timeline."),
    ("evt-1", "event", "Academic Year Begins", date(2026, 4, 6), date(2026, 4, 6), "First day of the academic session 2026–27."),
    ("evt-2", "event", "Parent–Teacher Meeting", date(2026, 8, 8), date(2026, 8, 8), "PTM for all classes (morning & afternoon slots)."),
    ("evt-3", "event", "Annual Sports Day", date(2026, 10, 17), date(2026, 10, 18), "Inter-house sports meet."),
    ("evt-4", "event", "Annual Day Celebration", date(2026, 12, 12), date(2026, 12, 12), "Cultural performances and prize distribution."),
    ("evt-5", "event", "Science Exhibition", date(2026, 11, 28), date(2026, 11, 28), "School-wide science fair and project showcase."),
]


def _can_write(db: Session, actor: User) -> bool:
    return "calendar.write" in permission_codes_for(db, actor)


def _out(row: CalendarEvent) -> dict:
    return {
        "id": row.code,
        "uuid": str(row.id),
        "type": row.event_type,
        "title": row.title,
        "startDate": row.start_date.isoformat(),
        "endDate": row.end_date.isoformat(),
        "description": row.description or "",
    }


def _find(db: Session, actor: User, ref: str) -> CalendarEvent:
    row = None
    try:
        row = db.get(CalendarEvent, UUID(ref))
    except ValueError:
        row = db.scalar(
            select(CalendarEvent).where(CalendarEvent.campus_id == actor.campus_id, CalendarEvent.code == ref.strip())
        )
    if row is None or row.campus_id != actor.campus_id:
        fail(404, "not_found", "Calendar event not found.")
    return row


def ensure_defaults(db: Session, campus_id) -> None:
    existing = set(db.scalars(select(CalendarEvent.code).where(CalendarEvent.campus_id == campus_id)).all())
    added = False
    for code, event_type, title, start, end, description in DEFAULT_EVENTS:
        if code in existing:
            continue
        db.add(
            CalendarEvent(
                campus_id=campus_id,
                code=code,
                event_type=event_type,
                title=title,
                start_date=start,
                end_date=end,
                description=description,
            )
        )
        added = True
    if added:
        db.commit()


def list_events(db: Session, actor: User) -> list[dict]:
    ensure_defaults(db, actor.campus_id)
    rows = db.scalars(
        select(CalendarEvent)
        .where(CalendarEvent.campus_id == actor.campus_id)
        .order_by(CalendarEvent.start_date, CalendarEvent.title)
    ).all()
    items = [_out(row) for row in rows]
    try:
        from app.services import activities as activity_svc

        items.extend(activity_svc.as_calendar_items(db, actor))
    except Exception:
        pass
    return items


def _dates(start: date, end: date | None) -> tuple[date, date]:
    finish = end or start
    if finish < start:
        fail(422, "invalid_dates", "The end date cannot be before the start date.")
    if start.year < 2020 or finish.year > 2035:
        fail(422, "invalid_dates", "Calendar dates must fall between 2020 and 2035.")
    return start, finish


def create(db: Session, actor: User, *, event_type: str, title: str, start: date, end: date | None, description: str) -> dict:
    if not _can_write(db, actor):
        fail(403, "forbidden", "You are not allowed to change the calendar.")
    if event_type not in EVENT_TYPES:
        fail(422, "invalid_type", "Type must be holiday, exam or event.")
    title = (title or "").strip()
    if not title:
        fail(422, "title_required", "A title is required.")
    if len(title) > TITLE_MAX:
        fail(422, "title_too_long", f"Title can be at most {TITLE_MAX} characters.")
    description = (description or "").strip()
    if len(description) > DESCRIPTION_MAX:
        fail(422, "description_too_long", f"Description can be at most {DESCRIPTION_MAX} characters.")
    start, finish = _dates(start, end)
    codes = db.scalars(select(CalendarEvent.code).where(CalendarEvent.campus_id == actor.campus_id)).all()
    n = max((int(c.split("-")[1]) for c in codes if c.startswith("cal-") and c[4:].isdigit()), default=0) + 1
    row = CalendarEvent(
        campus_id=actor.campus_id,
        code=f"cal-{n:04d}",
        event_type=event_type,
        title=title,
        start_date=start,
        end_date=finish,
        description=description,
        created_by=actor.id,
    )
    try:
        db.add(row)
        db.flush()
    except IntegrityError:
        db.rollback()
        fail(409, "code_conflict", "Could not number the event. Please try again.")
    write_audit(
        db, action="CALENDAR_EVENT_CREATED", entity_type="calendar_event", entity_id=str(row.id),
        actor_id=actor.id, campus_id=actor.campus_id, details=row.code,
    )
    db.commit()
    return _out(row)


def update(db: Session, actor: User, ref: str, **fields) -> dict:
    if not _can_write(db, actor):
        fail(403, "forbidden", "You are not allowed to change the calendar.")
    row = _find(db, actor, ref)
    if "event_type" in fields and fields["event_type"] is not None:
        if fields["event_type"] not in EVENT_TYPES:
            fail(422, "invalid_type", "Type must be holiday, exam or event.")
        row.event_type = fields["event_type"]
    if "title" in fields and fields["title"] is not None:
        title = fields["title"].strip()
        if not title:
            fail(422, "title_required", "A title is required.")
        if len(title) > TITLE_MAX:
            fail(422, "title_too_long", f"Title can be at most {TITLE_MAX} characters.")
        row.title = title
    if "description" in fields and fields["description"] is not None:
        description = fields["description"].strip()
        if len(description) > DESCRIPTION_MAX:
            fail(422, "description_too_long", f"Description can be at most {DESCRIPTION_MAX} characters.")
        row.description = description
    start = fields.get("start") if "start" in fields else row.start_date
    end = fields.get("end") if "end" in fields else row.end_date
    if start is None:
        start = row.start_date
    row.start_date, row.end_date = _dates(start, end)
    row.updated_at = utcnow()
    write_audit(
        db, action="CALENDAR_EVENT_UPDATED", entity_type="calendar_event", entity_id=str(row.id),
        actor_id=actor.id, campus_id=actor.campus_id, details=row.code,
    )
    db.commit()
    return _out(row)


def delete(db: Session, actor: User, ref: str) -> None:
    if not _can_write(db, actor):
        fail(403, "forbidden", "You are not allowed to change the calendar.")
    row = _find(db, actor, ref)
    write_audit(
        db, action="CALENDAR_EVENT_REMOVED", entity_type="calendar_event", entity_id=str(row.id),
        actor_id=actor.id, campus_id=actor.campus_id, details=row.code,
    )
    db.delete(row)
    db.commit()
