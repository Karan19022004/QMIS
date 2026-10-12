from fastapi import APIRouter, Depends
from sqlalchemy import String, cast, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_user, role_code_for
from app.models import Student, User
from app.services.errors import fail

router = APIRouter(prefix="/api/v1/parents", tags=["parents"])


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

    return [
        {
            "id": str(row.id),
            "name": row.full_name,
            "className": row.class_name or "",
            "section": "",
            "classSection": row.class_name or "",
            "rollNumber": "",
            "admissionNumber": row.admission_number,
            "admissionId": str(row.admission_id) if row.admission_id else None,
        }
        for row in rows
    ]
