from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import require_permission
from app.models import User
from app.services import lesson_plans as svc

router = APIRouter(prefix="/api/v1/lesson-plans", tags=["lesson-plans"])


class LessonPlanIn(BaseModel):
    className: str = Field(min_length=1, max_length=64)
    section: str | None = Field(default=None, max_length=16)
    subject: str = Field(min_length=1, max_length=80)
    month: str = Field(description="Target month YYYY-MM")
    title: str | None = Field(default=None, max_length=200)
    content: dict = Field(default_factory=dict)
    fileId: UUID | None = None


class LessonPlanPatch(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    content: dict | None = None
    fileId: UUID | None = None


@router.post("", status_code=201)
def create_route(
    body: LessonPlanIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("lessonplans.write")),
) -> dict:
    return svc.create(
        db,
        user,
        class_name=body.className,
        section=body.section,
        subject=body.subject,
        month=body.month,
        title=body.title,
        content=body.content,
        file_id=body.fileId,
    )


@router.get("")
def list_route(
    month: str | None = None,
    class_name: str | None = Query(default=None, alias="className"),
    status: str | None = None,
    mine: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("lessonplans.read")),
) -> list[dict]:
    return svc.list_plans(db, user, month=month, class_name=class_name, status=status, mine=mine)


@router.post("/reminders/run")
def reminders_route(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("lessonplans.remind")),
) -> dict:
    """Create 'submit your plan' reminders (7 days before the 25th). Safe to call repeatedly."""
    return {"created": svc.run_reminders(db, user.campus_id, today=date.today())}


@router.get("/{plan_id}")
def get_route(
    plan_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("lessonplans.read")),
) -> dict:
    return svc.get(db, user, plan_id)


@router.patch("/{plan_id}")
def patch_route(
    plan_id: UUID,
    body: LessonPlanPatch,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("lessonplans.write")),
) -> dict:
    return svc.update(db, user, plan_id, title=body.title, content=body.content, file_id=body.fileId)


@router.post("/{plan_id}/submit")
def submit_route(
    plan_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("lessonplans.write")),
) -> dict:
    return svc.submit(db, user, plan_id)


@router.post("/{plan_id}/revise", status_code=201)
def revise_route(
    plan_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("lessonplans.write")),
) -> dict:
    return svc.revise(db, user, plan_id)
