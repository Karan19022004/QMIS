from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import require_permission
from app.models import User
from app.services import students as svc

router = APIRouter(prefix="/api/v1/students", tags=["students"])


@router.get("")
def list_students_route(
    class_name: str | None = Query(default=None, alias="className"),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("students.read")),
) -> list[dict]:
    """Campus enrolled students for staff UIS (API SoT)."""
    return svc.list_students(db, user, class_name=class_name)


@router.get("/{student_id}")
def get_student_route(
    student_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("students.read")),
) -> dict:
    """Student detail including linked admission + guardians."""
    return svc.get_student(db, user, student_id)
