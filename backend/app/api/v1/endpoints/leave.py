from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import require_permission
from app.models import User
from app.services import leave as svc

router = APIRouter(prefix="/api/v1/leave-requests", tags=["leave"])


class LeaveIn(BaseModel):
    leaveType: str
    fromDate: date
    toDate: date
    hours: float | None = Field(default=None, description="Permission only, max 2")
    reason: str = Field(min_length=1, max_length=2000)


class DecideIn(BaseModel):
    decision: str
    comment: str | None = None


@router.post("", status_code=201)
def create_route(
    body: LeaveIn, db: Session = Depends(get_db), user: User = Depends(require_permission("leave.write"))
) -> dict:
    return svc.create(
        db, user, leave_type=body.leaveType, from_date=body.fromDate, to_date=body.toDate,
        hours=body.hours, reason=body.reason,
    )


@router.get("")
def list_route(
    box: str = Query(default="mine", description="mine | received | all"),
    status: str | None = Query(default=None, description="Pending | Approved | Rejected"),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("leave.read")),
) -> list[dict]:
    return svc.list_requests(db, user, box=box, status=status)


@router.get("/on-leave")
def on_leave_route(
    day: date = Query(alias="date"),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("leave.decide")),
) -> list[dict]:
    """Approved leave/permission on a date (attendance auto-marks Leave / Permission from this)."""
    return svc.on_leave(db, user, day)


@router.get("/{request_id}")
def get_route(
    request_id: UUID, db: Session = Depends(get_db), user: User = Depends(require_permission("leave.read"))
) -> dict:
    return svc.get(db, user, request_id)


@router.post("/{request_id}/decide")
def decide_route(
    request_id: UUID,
    body: DecideIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("leave.decide")),
) -> dict:
    return svc.decide(db, user, request_id, decision=body.decision, comment=body.comment)
