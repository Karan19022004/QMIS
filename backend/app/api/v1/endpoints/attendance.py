from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import require_permission
from app.models import User
from app.schemas.attendance import AttendanceUpsertIn
from app.services import attendance as svc

router = APIRouter(prefix="/api/v1/attendance", tags=["attendance"])


@router.get("")
def list_attendance_route(
    date_: date = Query(alias="date"),
    class_name: str | None = Query(default=None, alias="className"),
    section: str | None = Query(default=None),
    roster: bool = Query(default=False, description="Include unmarked enrolled students"),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("attendance.read")),
) -> list[dict]:
    if roster:
        if not class_name:
            from app.services.errors import fail

            fail(400, "validation_error", "className is required when roster=true.")
        return svc.roster_with_marks(
            db, user, attendance_date=date_, class_name=class_name, section=section
        )
    return svc.list_attendance(
        db, user, attendance_date=date_, class_name=class_name, section=section
    )


@router.get("/my-classes")
def my_attendance_classes_route(
    date_: date | None = Query(default=None, alias="date"),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("attendance.read")),
) -> dict:
    """Classes and sections the signed-in user may load and mark (same rule as roster and save)."""
    return svc.my_attendance_classes(db, user, date_)


@router.post("")
def upsert_attendance_route(
    body: AttendanceUpsertIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("attendance.write")),
) -> list[dict]:
    return svc.upsert_attendance(db, user, body)


@router.get("/students/{student_id}/calendar")
def student_calendar_route(
    student_id: UUID,
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("attendance.read")),
) -> dict[str, str]:
    """Month map for AttendanceCalendar (P/A/H codes)."""
    return svc.student_month_map(db, user, student_id, year=year, month=month)
