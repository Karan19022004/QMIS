from fastapi import APIRouter, Depends
from sqlalchemy import String, cast, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_user, require_permission, role_code_for
from app.models import Student, User
from app.services import students as students_svc
from app.services.errors import fail

router = APIRouter(prefix="/api/v1/parents", tags=["parents"])


@router.get("")
def list_parents_route(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("students.read")),
) -> list[dict]:
    """
    Parents linked to campus students visible to the actor.
    Coordinators: grade band. Teachers: class-teacher / allocated classes only.
    """
    return students_svc.list_parents_for_staff(db, user)


@router.get("/me/children")
def list_my_children(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    """Children enrolled under the signed-in parent (API SoT for Select Child)."""
    if role_code_for(db, user) != "parent":
        fail(403, "forbidden", "Parent role required.")

    # ORM UUID column or Phase-0 VARCHAR(36) migrate leftover.
    parent_key = str(user.id)
    rows = db.scalars(
        select(Student)
        .where(
            Student.campus_id == user.campus_id,
            or_(
                Student.parent_user_id == user.id,
                cast(Student.parent_user_id, String) == parent_key,
            ),
        )
        .order_by(Student.full_name)
    ).all()

    from app.services.placement import student_placement_fields

    out: list[dict] = []
    for row in rows:
        section = row.section or ""
        item = {
            "id": str(row.id),
            "name": row.full_name,
            "className": row.class_name or "",
            "section": section,
            "classSection": f"{row.class_name}-{section}" if section else (row.class_name or ""),
            "rollNumber": row.roll_number if row.roll_number is not None else "",
            "admissionNumber": row.admission_number,
            "admissionId": str(row.admission_id) if row.admission_id else None,
        }
        item.update(student_placement_fields(db, row))
        out.append(item)
    return out
