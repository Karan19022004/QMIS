from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_user, require_permission
from app.models import User
from app.schemas.placement import CoordinatorGradeBandIn, PlaceStudentIn, PromoteStudentIn
from app.services import placement as placement_svc
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


@router.post("/sync-from-admissions")
def sync_students_from_admissions_route(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("finance.write")),
) -> dict:
    """
    Promote Active campus admissions into the students table (for finance Import).
    Account Head has finance.write but not admissions.write, so Enrol is done here.
    """
    return svc.sync_students_from_admissions(db, user)


@router.get("/me")
def my_student_route(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Linked student profile for the signed-in student portal login."""
    return svc.get_my_student(db, user)


@router.get("/pending-placement")
def pending_placement_route(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("students.place")),
) -> list[dict]:
    """Enrolled students awaiting section + roll (filtered by coordinator grade band)."""
    return placement_svc.list_pending_placement(db, user)


@router.get("/placed")
def placed_students_route(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("students.promote")),
) -> list[dict]:
    """Placed students the actor can promote."""
    return placement_svc.list_placed_for_band(db, user)


@router.get("/my-grade-band")
def my_grade_band_route(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("students.place")),
) -> dict | None:
    return placement_svc.list_my_grade_band(db, user)


@router.get("/placement-options")
def placement_options_route(
    class_name: str = Query(..., alias="className"),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("students.place")),
) -> dict:
    """Sections for a class (ensures Grade N + A/B/C exist in the current academic year)."""
    return placement_svc.placement_options(db, user, class_name)


@router.get("/promote-options/{student_id}")
def promote_options_route(
    student_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("students.promote")),
) -> dict:
    """Next grade only + its sections for the promote screen."""
    return placement_svc.promote_options(db, user, student_id)


@router.get("/coordinator-grade-bands")
def list_coordinator_grade_bands_route(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("students.place")),
) -> list[dict]:
    """Principal: list coordinator logins and assigned grade bands."""
    return placement_svc.list_coordinator_grade_bands(db, user)


@router.put("/coordinator-grade-bands")
def upsert_coordinator_grade_band_route(
    payload: CoordinatorGradeBandIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("students.place")),
) -> dict:
    """Principal: assign which grades a coordinator handles (HR creates the login)."""
    return placement_svc.upsert_coordinator_grade_band(
        db,
        user,
        user_id=payload.user_id,
        grade_from=payload.grade_from,
        grade_to=payload.grade_to,
    )


@router.post("/{student_id}/place")
def place_student_route(
    student_id: UUID,
    payload: PlaceStudentIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("students.place")),
) -> dict:
    return placement_svc.place_student(db, user, student_id, payload.section_id)


@router.post("/{student_id}/promote")
def promote_student_route(
    student_id: UUID,
    payload: PromoteStudentIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("students.promote")),
) -> dict:
    return placement_svc.promote_student(
        db,
        user,
        student_id,
        target_class_id=payload.target_class_id,
        target_section_id=payload.target_section_id,
        academic_year_id=payload.academic_year_id,
    )


@router.get("/{student_id}")
def get_student_route(
    student_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("students.read")),
) -> dict:
    """Student detail including linked admission + guardians."""
    return svc.get_student(db, user, student_id)
