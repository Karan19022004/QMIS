from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import require_permission
from app.models import User
from app.services import approvals as svc

router = APIRouter(prefix="/api/v1", tags=["approvals"])


class SubmitIn(BaseModel):
    entityType: str = Field(min_length=1, max_length=48)
    entityId: str = Field(min_length=1, max_length=80)
    title: str | None = Field(default=None, max_length=200)
    chain: list[str] | None = None


class DecideIn(BaseModel):
    decision: str
    comment: str | None = None


@router.post("/approvals", status_code=201)
def submit_route(
    body: SubmitIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("approvals.submit")),
) -> dict:
    return svc.submit(
        db, user, entity_type=body.entityType, entity_id=body.entityId, title=body.title, chain=body.chain
    )


@router.get("/approvals/inbox")
def inbox_route(
    db: Session = Depends(get_db), user: User = Depends(require_permission("approvals.read"))
) -> list[dict]:
    return svc.inbox(db, user)


@router.get("/approvals/mine")
def mine_route(
    db: Session = Depends(get_db), user: User = Depends(require_permission("approvals.read"))
) -> list[dict]:
    return svc.mine(db, user)


@router.get("/approvals/lookup")
def lookup_route(
    entity_type: str = Query(alias="entityType"),
    entity_id: str = Query(alias="entityId"),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("approvals.read")),
) -> list[dict]:
    return svc.lookup(db, user, entity_type=entity_type, entity_id=entity_id)


@router.get("/approvals/{approval_id}")
def detail_route(
    approval_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("approvals.read")),
) -> dict:
    return svc.detail(db, user, approval_id)


@router.post("/approvals/{approval_id}/decide")
def decide_route(
    approval_id: UUID,
    body: DecideIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("approvals.decide")),
) -> dict:
    return svc.decide(db, user, approval_id, decision=body.decision, comment=body.comment)


@router.get("/notifications")
def notifications_route(
    unread_only: bool = Query(default=False, alias="unreadOnly"),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("notifications.read")),
) -> list[dict]:
    return svc.list_notifications(db, user, unread_only=unread_only)


@router.post("/notifications/{notification_id}/read")
def notification_read_route(
    notification_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("notifications.read")),
) -> dict:
    return svc.mark_read(db, user, notification_id)
