from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import require_permission
from app.models import User
from app.services import activities as svc

router = APIRouter(prefix="/api/v1/activities", tags=["activities"])


class PlayerIn(BaseModel):
    rank: int | None = None
    name: str
    category: str = ""
    className: str = ""
    school: str = ""
    rating: str = ""
    score: str = ""
    tieBreak: str = ""
    result: str = "Completed"


class ActivityIn(BaseModel):
    type: str
    eventName: str
    eventType: str = ""
    className: str = ""
    eventDate: date
    startTime: str = ""
    endTime: str = ""
    venue: str = ""
    coordinator: str = ""
    coach: str = ""
    description: str = ""
    players: list[PlayerIn] | None = None


class ActivityPatch(BaseModel):
    eventName: str | None = None
    eventType: str | None = None
    className: str | None = None
    eventDate: date | None = None
    startTime: str | None = None
    endTime: str | None = None
    venue: str | None = None
    coordinator: str | None = None
    coach: str | None = None
    description: str | None = None
    players: list[PlayerIn] | None = None


class ApprovalIn(BaseModel):
    status: str


@router.get("")
def list_route(
    type: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("activities.read")),
) -> list[dict]:
    return svc.list_activities(db, user, activity_type=type)


@router.get("/{ref}")
def get_route(ref: str, db: Session = Depends(get_db), user: User = Depends(require_permission("activities.read"))) -> dict:
    return svc.get_activity(db, user, ref)


@router.post("", status_code=201)
def create_route(
    body: ActivityIn, db: Session = Depends(get_db), user: User = Depends(require_permission("activities.write"))
) -> dict:
    return svc.create(db, user, activity_type=body.type, payload=body.model_dump())


@router.patch("/{ref}")
def update_route(
    ref: str, body: ActivityPatch, db: Session = Depends(get_db), user: User = Depends(require_permission("activities.write"))
) -> dict:
    return svc.update(db, user, ref, {k: v for k, v in body.model_dump().items() if v is not None or k == "players"})


@router.delete("/{ref}", status_code=204)
def delete_route(
    ref: str, db: Session = Depends(get_db), user: User = Depends(require_permission("activities.write"))
) -> Response:
    svc.delete(db, user, ref)
    return Response(status_code=204)


@router.post("/{ref}/approval")
def approval_route(
    ref: str, body: ApprovalIn, db: Session = Depends(get_db), user: User = Depends(require_permission("activities.approve"))
) -> dict:
    return svc.decide(db, user, ref, body.status)
