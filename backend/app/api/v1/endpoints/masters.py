from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import require_permission
from app.models import AcademicYear, FinancialYear, HrEmployee, Role, SchoolClass, Section, Subject, User
from app.schemas.phase0 import (
    AcademicYearCreate,
    AcademicYearOut,
    AcademicYearUpdate,
    ClassCreate,
    ClassOut,
    ClassUpdate,
    FinancialYearCreate,
    FinancialYearOut,
    FinancialYearUpdate,
    SectionCreate,
    SectionOut,
    SectionUpdate,
    SubjectCreate,
    SubjectOut,
)
from app.services import class_dependencies
from app.services.audit import write_audit
from app.services.errors import fail

router = APIRouter(prefix="/api/v1/masters", tags=["masters"])


def _clear_current_years(db: Session, campus_id: UUID) -> None:
    for row in db.scalars(
        select(AcademicYear).where(AcademicYear.campus_id == campus_id, AcademicYear.is_current.is_(True))
    ).all():
        row.is_current = False


def _clear_current_financial_years(db: Session, campus_id: UUID) -> None:
    for row in db.scalars(
        select(FinancialYear).where(FinancialYear.campus_id == campus_id, FinancialYear.is_current.is_(True))
    ).all():
        row.is_current = False


def _assert_april_march(start, end) -> None:
    if start.month != 4 or start.day != 1:
        fail(400, "validation_error", "Financial year must start on 1 April.")
    if end.month != 3 or end.day != 31:
        fail(400, "validation_error", "Financial year must end on 31 March.")
    if end.year != start.year + 1:
        fail(400, "validation_error", "Financial year must run April–March across consecutive years.")
    if end <= start:
        fail(400, "validation_error", "end_date must be after start_date.")


@router.get("/academic-years", response_model=list[AcademicYearOut])
def list_academic_years(
    include_inactive: bool = Query(default=False),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("masters.read")),
) -> list[AcademicYear]:
    q = select(AcademicYear).where(AcademicYear.campus_id == user.campus_id)
    if not include_inactive:
        q = q.where(AcademicYear.is_active.is_(True))
    return list(db.scalars(q.order_by(AcademicYear.is_current.desc(), AcademicYear.name.desc())).all())


@router.post("/academic-years", response_model=AcademicYearOut, status_code=201)
def create_academic_year(
    body: AcademicYearCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("masters.write")),
) -> AcademicYear:
    name = body.name.strip()
    existing = db.scalar(
        select(AcademicYear).where(AcademicYear.campus_id == user.campus_id, AcademicYear.name == name)
    )
    if existing is not None:
        fail(409, "academic_year_exists", "That academic year already exists on this campus.")
    if body.is_current:
        _clear_current_years(db, user.campus_id)
    if body.start_date and body.end_date and body.end_date < body.start_date:
        fail(400, "validation_error", "end_date must be on or after start_date.")
    row = AcademicYear(
        campus_id=user.campus_id,
        name=name,
        start_date=body.start_date,
        end_date=body.end_date,
        is_current=body.is_current,
        is_active=True,
    )
    db.add(row)
    db.flush()
    write_audit(
        db,
        action="ACADEMIC_YEAR_CREATED",
        entity_type="academic_year",
        entity_id=str(row.id),
        actor_id=user.id,
        campus_id=user.campus_id,
        details=name,
    )
    db.commit()
    db.refresh(row)
    return row


@router.post("/academic-years/{year_id}/set-current", response_model=AcademicYearOut)
def set_current_academic_year(
    year_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("masters.write")),
) -> AcademicYear:
    row = db.scalar(
        select(AcademicYear).where(AcademicYear.id == year_id, AcademicYear.campus_id == user.campus_id)
    )
    if row is None:
        fail(404, "academic_year_not_found", "Academic year not found.")
    _clear_current_years(db, user.campus_id)
    row.is_current = True
    write_audit(
        db,
        action="ACADEMIC_YEAR_SET_CURRENT",
        entity_type="academic_year",
        entity_id=str(row.id),
        actor_id=user.id,
        campus_id=user.campus_id,
        details=row.name,
    )
    db.commit()
    db.refresh(row)
    return row


@router.get("/academic-years/current", response_model=AcademicYearOut)
def get_current_academic_year(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("masters.read")),
) -> AcademicYear:
    row = db.scalar(
        select(AcademicYear).where(
            AcademicYear.campus_id == user.campus_id,
            AcademicYear.is_current.is_(True),
            AcademicYear.is_active.is_(True),
        )
    )
    if row is None:
        fail(404, "academic_year_not_found", "No current academic year is set.")
    return row


@router.get("/academic-years/{year_id}", response_model=AcademicYearOut)
def get_academic_year(
    year_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("masters.read")),
) -> AcademicYear:
    row = db.scalar(
        select(AcademicYear).where(AcademicYear.id == year_id, AcademicYear.campus_id == user.campus_id)
    )
    if row is None:
        fail(404, "academic_year_not_found", "Academic year not found.")
    return row


@router.patch("/academic-years/{year_id}", response_model=AcademicYearOut)
def update_academic_year(
    year_id: UUID,
    body: AcademicYearUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("masters.write")),
) -> AcademicYear:
    row = db.scalar(
        select(AcademicYear).where(AcademicYear.id == year_id, AcademicYear.campus_id == user.campus_id)
    )
    if row is None:
        fail(404, "academic_year_not_found", "Academic year not found.")
    if body.name is not None:
        name = body.name.strip()
        clash = db.scalar(
            select(AcademicYear).where(
                AcademicYear.campus_id == user.campus_id,
                AcademicYear.name == name,
                AcademicYear.id != year_id,
            )
        )
        if clash is not None:
            fail(409, "academic_year_exists", "That academic year already exists on this campus.")
        row.name = name
    if body.start_date is not None:
        row.start_date = body.start_date
    if body.end_date is not None:
        row.end_date = body.end_date
    if body.start_date and body.end_date and body.end_date < body.start_date:
        fail(400, "validation_error", "end_date must be on or after start_date.")
    if body.is_active is not None:
        row.is_active = body.is_active
        if not body.is_active:
            row.is_current = False
    if body.is_current is True:
        _clear_current_years(db, user.campus_id)
        row.is_current = True
        row.is_active = True
    elif body.is_current is False:
        row.is_current = False
    write_audit(
        db,
        action="ACADEMIC_YEAR_UPDATED",
        entity_type="academic_year",
        entity_id=str(row.id),
        actor_id=user.id,
        campus_id=user.campus_id,
        details=row.name,
    )
    db.commit()
    db.refresh(row)
    return row


@router.delete("/academic-years/{year_id}", response_model=AcademicYearOut)
def deactivate_academic_year(
    year_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("masters.write")),
) -> AcademicYear:
    return update_academic_year(year_id, AcademicYearUpdate(is_active=False, is_current=False), db, user)


@router.get("/financial-years", response_model=list[FinancialYearOut])
def list_financial_years(
    include_inactive: bool = Query(default=False),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("masters.read")),
) -> list[FinancialYear]:
    q = select(FinancialYear).where(FinancialYear.campus_id == user.campus_id)
    if not include_inactive:
        q = q.where(FinancialYear.is_active.is_(True))
    return list(db.scalars(q.order_by(FinancialYear.is_current.desc(), FinancialYear.name.desc())).all())


@router.post("/financial-years", response_model=FinancialYearOut, status_code=201)
def create_financial_year(
    body: FinancialYearCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("masters.write")),
) -> FinancialYear:
    _assert_april_march(body.start_date, body.end_date)
    name = body.name.strip()
    existing = db.scalar(
        select(FinancialYear).where(FinancialYear.campus_id == user.campus_id, FinancialYear.name == name)
    )
    if existing is not None:
        fail(409, "financial_year_exists", "That financial year already exists on this campus.")
    if body.is_current:
        _clear_current_financial_years(db, user.campus_id)
    row = FinancialYear(
        campus_id=user.campus_id,
        name=name,
        start_date=body.start_date,
        end_date=body.end_date,
        is_current=body.is_current,
        is_active=True,
    )
    db.add(row)
    db.flush()
    write_audit(
        db,
        action="FINANCIAL_YEAR_CREATED",
        entity_type="financial_year",
        entity_id=str(row.id),
        actor_id=user.id,
        campus_id=user.campus_id,
        details=name,
    )
    db.commit()
    db.refresh(row)
    return row


@router.get("/financial-years/current", response_model=FinancialYearOut)
def get_current_financial_year(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("masters.read")),
) -> FinancialYear:
    row = db.scalar(
        select(FinancialYear).where(
            FinancialYear.campus_id == user.campus_id,
            FinancialYear.is_current.is_(True),
            FinancialYear.is_active.is_(True),
        )
    )
    if row is None:
        fail(404, "financial_year_not_found", "No current financial year is set.")
    return row


@router.get("/financial-years/{year_id}", response_model=FinancialYearOut)
def get_financial_year(
    year_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("masters.read")),
) -> FinancialYear:
    row = db.scalar(
        select(FinancialYear).where(FinancialYear.id == year_id, FinancialYear.campus_id == user.campus_id)
    )
    if row is None:
        fail(404, "financial_year_not_found", "Financial year not found.")
    return row


@router.patch("/financial-years/{year_id}", response_model=FinancialYearOut)
def update_financial_year(
    year_id: UUID,
    body: FinancialYearUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("masters.write")),
) -> FinancialYear:
    row = db.scalar(
        select(FinancialYear).where(FinancialYear.id == year_id, FinancialYear.campus_id == user.campus_id)
    )
    if row is None:
        fail(404, "financial_year_not_found", "Financial year not found.")
    if body.name is not None:
        name = body.name.strip()
        clash = db.scalar(
            select(FinancialYear).where(
                FinancialYear.campus_id == user.campus_id,
                FinancialYear.name == name,
                FinancialYear.id != year_id,
            )
        )
        if clash is not None:
            fail(409, "financial_year_exists", "That financial year already exists on this campus.")
        row.name = name
    start = body.start_date if body.start_date is not None else row.start_date
    end = body.end_date if body.end_date is not None else row.end_date
    _assert_april_march(start, end)
    row.start_date = start
    row.end_date = end
    if body.is_active is not None:
        row.is_active = body.is_active
        if not body.is_active:
            row.is_current = False
    if body.is_current is True:
        _clear_current_financial_years(db, user.campus_id)
        row.is_current = True
        row.is_active = True
    elif body.is_current is False:
        row.is_current = False
    write_audit(
        db,
        action="FINANCIAL_YEAR_UPDATED",
        entity_type="financial_year",
        entity_id=str(row.id),
        actor_id=user.id,
        campus_id=user.campus_id,
        details=row.name,
    )
    db.commit()
    db.refresh(row)
    return row


@router.post("/financial-years/{year_id}/set-current", response_model=FinancialYearOut)
def set_current_financial_year(
    year_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("masters.write")),
) -> FinancialYear:
    return update_financial_year(year_id, FinancialYearUpdate(is_current=True), db, user)


# Roles that may be a class teacher. A class teacher is a LOGIN (users.id) on this campus.
_CLASS_TEACHER_ROLES = ("teacher", "coordinator")


def _get_class(db: Session, user: User, class_id: UUID) -> SchoolClass:
    row = db.scalar(
        select(SchoolClass).where(SchoolClass.id == class_id, SchoolClass.campus_id == user.campus_id)
    )
    if row is None:
        fail(404, "class_not_found", "Class not found.")
    return row


def _class_outs(db: Session, rows: list[SchoolClass]) -> list[ClassOut]:
    """ClassOut with the derived capacity (sum of the class's active sections that have one)."""
    totals: dict = {}
    if rows:
        totals = dict(
            db.execute(
                select(Section.class_id, func.sum(Section.capacity))
                .where(
                    Section.class_id.in_([row.id for row in rows]),
                    Section.is_active.is_(True),
                    Section.capacity.is_not(None),
                )
                .group_by(Section.class_id)
            ).all()
        )
    outs: list[ClassOut] = []
    for row in rows:
        out = ClassOut.model_validate(row)
        total = totals.get(row.id)
        out.capacity = int(total) if total is not None else None
        outs.append(out)
    return outs


def _teacher_labels(db: Session, user_ids: set) -> dict:
    """{user_id: (display name or None, email)} for the given logins. Read-only, display only."""
    if not user_ids:
        return {}
    emails = dict(db.execute(select(User.id, User.email).where(User.id.in_(user_ids))).all())
    names: dict = {}
    for employee in db.scalars(select(HrEmployee).where(HrEmployee.user_id.in_(user_ids))).all():
        full = f"{employee.first_name} {employee.last_name}".strip()
        if full:
            names[employee.user_id] = full
    return {uid: (names.get(uid), emails.get(uid)) for uid in user_ids}


def _section_outs(db: Session, rows: list[Section]) -> list[SectionOut]:
    labels = _teacher_labels(db, {row.class_teacher_user_id for row in rows if row.class_teacher_user_id})
    outs: list[SectionOut] = []
    for row in rows:
        out = SectionOut.model_validate(row)
        name, email = labels.get(row.class_teacher_user_id, (None, None))
        out.class_teacher_name = name
        out.class_teacher_email = email
        outs.append(out)
    return outs


def _resolve_class_teacher(db: Session, actor: User, teacher_user_id: UUID) -> User:
    """The login must exist on the actor's campus, be active, and hold a teaching role."""
    teacher = db.scalar(
        select(User).where(User.id == teacher_user_id, User.campus_id == actor.campus_id)
    )
    if teacher is None:
        fail(404, "class_teacher_not_found", "That teacher was not found on this campus.")
    if not teacher.is_active:
        fail(409, "class_teacher_inactive", "That login is deactivated and cannot be a class teacher.")
    role_code = db.scalar(select(Role.code).where(Role.id == teacher.role_id))
    if role_code not in _CLASS_TEACHER_ROLES:
        fail(409, "class_teacher_role", "Only a teacher or coordinator login can be a class teacher.")
    return teacher


def _clean_room(value: str | None) -> str | None:
    cleaned = (value or "").strip()
    return cleaned or None


@router.get("/classes", response_model=list[ClassOut])
def list_classes(
    academic_year_id: UUID | None = Query(default=None),
    include_inactive: bool = Query(default=False),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("masters.read")),
) -> list[ClassOut]:
    q = select(SchoolClass).where(SchoolClass.campus_id == user.campus_id)
    if academic_year_id is not None:
        q = q.where(SchoolClass.academic_year_id == academic_year_id)
    if not include_inactive:
        q = q.where(SchoolClass.is_active.is_(True))
    return _class_outs(db, list(db.scalars(q.order_by(SchoolClass.name.asc())).all()))


@router.post("/classes", response_model=ClassOut, status_code=201)
def create_class(
    body: ClassCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("masters.write")),
) -> ClassOut:
    name = body.name.strip()

    year_id = body.academic_year_id
    if year_id is not None:
        year = db.scalar(
            select(AcademicYear).where(AcademicYear.id == year_id, AcademicYear.campus_id == user.campus_id)
        )
        if year is None:
            fail(404, "academic_year_not_found", "Academic year not found.")
    else:
        current = db.scalar(
            select(AcademicYear).where(
                AcademicYear.campus_id == user.campus_id, AcademicYear.is_current.is_(True)
            )
        )
        if current is None:
            fail(
                409,
                "academic_year_required",
                "Choose an academic year, or mark one as current, before adding a class.",
            )
        year_id = current.id

    existing = db.scalar(
        select(SchoolClass).where(
            SchoolClass.campus_id == user.campus_id,
            SchoolClass.academic_year_id == year_id,
            SchoolClass.name == name,
        )
    )
    if existing is not None:
        fail(
            409,
            "class_exists",
            "That class already exists in this academic year."
            + ("" if existing.is_active else " It is deactivated; reactivate it instead."),
        )

    section_name = body.section.strip().upper() if body.section and body.section.strip() else None
    row = SchoolClass(
        campus_id=user.campus_id,
        academic_year_id=year_id,
        name=name,
        section=section_name,
    )
    db.add(row)
    db.flush()
    if section_name:
        db.add(Section(campus_id=user.campus_id, class_id=row.id, name=section_name))
    write_audit(
        db,
        action="CLASS_CREATED",
        entity_type="school_class",
        entity_id=str(row.id),
        actor_id=user.id,
        campus_id=user.campus_id,
        details=name,
    )
    try:
        db.commit()
    except IntegrityError:  # two requests raced past the check above; the database constraint won
        db.rollback()
        fail(409, "class_exists", "That class already exists in this academic year.")
    db.refresh(row)
    return _class_outs(db, [row])[0]


@router.patch("/classes/{class_id}", response_model=ClassOut)
def update_class(
    class_id: UUID,
    body: ClassUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("masters.write")),
) -> ClassOut:
    row = _get_class(db, user, class_id)
    if body.is_active is None:
        fail(422, "nothing_to_update", "Nothing to change. Send is_active to deactivate or reactivate.")
    if body.is_active != row.is_active:
        row.is_active = body.is_active
        write_audit(
            db,
            action="CLASS_REACTIVATED" if body.is_active else "CLASS_DEACTIVATED",
            entity_type="school_class",
            entity_id=str(row.id),
            actor_id=user.id,
            campus_id=user.campus_id,
            details=row.name,
        )
        db.commit()
        db.refresh(row)
    return _class_outs(db, [row])[0]


@router.delete("/classes/{class_id}", response_model=ClassOut)
def delete_class(
    class_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("masters.write")),
) -> ClassOut:
    """Permanent delete, only for a class nothing refers to. Otherwise deactivate it."""
    row = _get_class(db, user, class_id)
    references = class_dependencies.class_references(db, user.campus_id, row.name)
    if references:
        fail(
            409,
            "class_in_use",
            f"{row.name} is used by {class_dependencies.describe(references)}, so it cannot be deleted. "
            "Deactivate it instead; those records stay linked to it.",
        )
    out = _class_outs(db, [row])[0]
    db.execute(delete(Section).where(Section.class_id == row.id))
    db.delete(row)
    write_audit(
        db,
        action="CLASS_DELETED",
        entity_type="school_class",
        entity_id=str(row.id),
        actor_id=user.id,
        campus_id=user.campus_id,
        details=row.name,
    )
    db.commit()
    return out


@router.get("/sections", response_model=list[SectionOut])
def list_sections(
    class_id: UUID | None = Query(default=None),
    include_inactive: bool = Query(default=False),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("masters.read")),
) -> list[SectionOut]:
    q = select(Section).where(Section.campus_id == user.campus_id)
    if class_id is not None:
        q = q.where(Section.class_id == class_id)
    if not include_inactive:
        q = q.where(Section.is_active.is_(True)).where(
            Section.class_id.in_(select(SchoolClass.id).where(SchoolClass.is_active.is_(True)))
        )
    return _section_outs(db, list(db.scalars(q.order_by(Section.name.asc())).all()))


@router.post("/sections", response_model=SectionOut, status_code=201)
def create_section(
    body: SectionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("masters.write")),
) -> SectionOut:
    school_class = _get_class(db, user, body.class_id)
    if not school_class.is_active:
        fail(409, "class_inactive", "That class is deactivated. Reactivate it before adding sections.")
    name = body.name.strip().upper()
    existing = db.scalar(
        select(Section).where(
            Section.campus_id == user.campus_id,
            Section.class_id == body.class_id,
            Section.name == name,
        )
    )
    if existing is not None:
        fail(409, "section_exists", "That section already exists for this class.")
    if body.class_teacher_user_id is not None:
        _resolve_class_teacher(db, user, body.class_teacher_user_id)
    row = Section(
        campus_id=user.campus_id,
        class_id=body.class_id,
        name=name,
        is_active=True,
        capacity=body.capacity,
        room_number=_clean_room(body.room_number),
        class_teacher_user_id=body.class_teacher_user_id,
    )
    db.add(row)
    db.flush()
    if not school_class.section:
        school_class.section = name
    write_audit(
        db,
        action="SECTION_CREATED",
        entity_type="section",
        entity_id=str(row.id),
        actor_id=user.id,
        campus_id=user.campus_id,
        details=f"{school_class.name}-{name}",
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        fail(409, "section_exists", "That section already exists for this class.")
    db.refresh(row)
    return _section_outs(db, [row])[0]


@router.get("/sections/{section_id}", response_model=SectionOut)
def get_section(
    section_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("masters.read")),
) -> SectionOut:
    row = db.scalar(
        select(Section).where(Section.id == section_id, Section.campus_id == user.campus_id)
    )
    if row is None:
        fail(404, "section_not_found", "Section not found.")
    return _section_outs(db, [row])[0]


@router.patch("/sections/{section_id}", response_model=SectionOut)
def update_section(
    section_id: UUID,
    body: SectionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("masters.write")),
) -> SectionOut:
    row = db.scalar(
        select(Section).where(Section.id == section_id, Section.campus_id == user.campus_id)
    )
    if row is None:
        fail(404, "section_not_found", "Section not found.")
    sent = body.model_fields_set
    changed: list[str] = []

    if body.name is not None:
        name = body.name.strip().upper()
        if name != row.name:
            clash = db.scalar(
                select(Section).where(
                    Section.campus_id == user.campus_id,
                    Section.class_id == row.class_id,
                    Section.name == name,
                    Section.id != section_id,
                )
            )
            if clash is not None:
                fail(409, "section_exists", "That section already exists for this class.")
            school_class = db.get(SchoolClass, row.class_id)
            references = class_dependencies.section_references(
                db, user.campus_id, school_class.name, row.name
            )
            if references:
                fail(
                    409,
                    "section_in_use",
                    f"Section {row.name} is used by {class_dependencies.describe(references)}, so it cannot "
                    "be renamed. Add a new section and deactivate this one instead.",
                )
            row.name = name
            changed.append("name")
    if body.is_active is not None and body.is_active != row.is_active:
        row.is_active = body.is_active
        changed.append("is_active")
    if "capacity" in sent and body.capacity != row.capacity:
        row.capacity = body.capacity
        changed.append("capacity")
    if "room_number" in sent and _clean_room(body.room_number) != row.room_number:
        row.room_number = _clean_room(body.room_number)
        changed.append("room_number")
    if "class_teacher_user_id" in sent and body.class_teacher_user_id != row.class_teacher_user_id:
        if body.class_teacher_user_id is not None:
            _resolve_class_teacher(db, user, body.class_teacher_user_id)
        row.class_teacher_user_id = body.class_teacher_user_id
        changed.append("class_teacher")

    if changed:
        write_audit(
            db,
            action="SECTION_UPDATED",
            entity_type="section",
            entity_id=str(row.id),
            actor_id=user.id,
            campus_id=user.campus_id,
            details=f"{row.name}: {', '.join(changed)}",
        )
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            fail(409, "section_exists", "That section already exists for this class.")
        db.refresh(row)
    return _section_outs(db, [row])[0]


@router.delete("/sections/{section_id}", response_model=SectionOut)
def deactivate_section(
    section_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("masters.write")),
) -> SectionOut:
    return update_section(section_id, SectionUpdate(is_active=False), db, user)


@router.get("/subjects", response_model=list[SubjectOut])
def list_subjects(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("masters.read")),
) -> list[Subject]:
    return list(db.scalars(select(Subject).where(Subject.campus_id == user.campus_id)).all())


@router.post("/subjects", response_model=SubjectOut, status_code=201)
def create_subject(
    body: SubjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("masters.write")),
) -> Subject:
    code = body.code.strip().upper()
    existing = db.scalar(select(Subject).where(Subject.campus_id == user.campus_id, Subject.code == code))
    if existing is not None:
        fail(409, "subject_exists", "That subject code already exists on this campus.")
    row = Subject(campus_id=user.campus_id, code=code, name=body.name.strip())
    db.add(row)
    db.flush()
    write_audit(
        db,
        action="SUBJECT_CREATED",
        entity_type="subject",
        entity_id=str(row.id),
        actor_id=user.id,
        campus_id=user.campus_id,
        details=code,
    )
    db.commit()
    db.refresh(row)
    return row
