from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models import AcademicYear, Campus, FinancialYear, Permission, Role, RolePermission, User
from app.permissions.matrix import ALL_ROLES, PERMISSIONS, ROLE_PERMISSIONS
from app.services.audit import write_audit


def seed_reference_data(db: Session) -> None:
    campus = db.scalar(select(Campus).where(Campus.code == "QMIS-MDU"))
    created_campus = campus is None
    if campus is None:
        campus = Campus(
            code="QMIS-MDU",
            name="Queen Mira International School",
            city="Madurai",
        )
        db.add(campus)
        db.flush()

    _seed_current_academic_year(db, campus)
    _seed_current_financial_year(db, campus)

    roles_by_code: dict[str, Role] = {role.code: role for role in db.scalars(select(Role)).all()}
    for code, name in ALL_ROLES:
        if code not in roles_by_code:
            role = Role(code=code, name=name)
            db.add(role)
            roles_by_code[code] = role
    db.flush()

    perms_by_code: dict[str, Permission] = {
        item.code: item for item in db.scalars(select(Permission)).all()
    }
    for code, description in PERMISSIONS:
        if code not in perms_by_code:
            item = Permission(code=code, description=description)
            db.add(item)
            perms_by_code[code] = item
    db.flush()

    existing_links = {
        (row.role_id, row.permission_id) for row in db.scalars(select(RolePermission)).all()
    }
    for role_code, codes in ROLE_PERMISSIONS.items():
        role = roles_by_code[role_code]
        for perm_code in codes:
            perm = perms_by_code[perm_code]
            key = (role.id, perm.id)
            if key not in existing_links:
                db.add(RolePermission(role_id=role.id, permission_id=perm.id))
                existing_links.add(key)

    # Demo logins have well-known passwords, so they exist only in explicit development mode.
    if settings.seed_demo_accounts:
        _seed_demo_users(db, campus, roles_by_code)
    if created_campus:
        write_audit(
            db,
            action="REFERENCE_SEEDED",
            entity_type="campus",
            entity_id=str(campus.id),
            campus_id=campus.id,
            details="Madurai campus, roles, and permissions",
        )
    db.commit()


def _seed_demo_users(db: Session, campus: Campus, roles_by_code: dict[str, Role]) -> None:
    _seed_user(
        db,
        campus=campus,
        role=roles_by_code["admin"],
        email=settings.admin_seed_email,
        password=settings.admin_seed_password,
    )
    _seed_user(
        db,
        campus=campus,
        role=roles_by_code["hr"],
        email=settings.hr_seed_email,
        password=settings.hr_seed_password,
    )
    _seed_user(
        db,
        campus=campus,
        role=roles_by_code["accounthead"],
        email=settings.accounthead_seed_email,
        password=settings.accounthead_seed_password,
    )
    _seed_user(
        db,
        campus=campus,
        role=roles_by_code["finance_assistant"],
        email=settings.finance_assistant_seed_email,
        password=settings.finance_assistant_seed_password,
    )
    # Academics / approvals logins used by Full Panel Test Guide
    for role_code, email, password in (
        ("teacher", settings.teacher_seed_email, settings.teacher_seed_password),
        ("coordinator", settings.coordinator_seed_email, settings.coordinator_seed_password),
        ("principal", settings.principal_seed_email, settings.principal_seed_password),
        ("prm", settings.prm_seed_email, settings.prm_seed_password),
        ("director", settings.director_seed_email, settings.director_seed_password),
    ):
        if role_code in roles_by_code:
            _seed_user(
                db,
                campus=campus,
                role=roles_by_code[role_code],
                email=email,
                password=password,
            )


def _seed_current_academic_year(db: Session, campus: Campus) -> None:
    existing = db.scalar(
        select(AcademicYear).where(AcademicYear.campus_id == campus.id, AcademicYear.name == "2026-27")
    )
    if existing is not None:
        return
    has_current = db.scalar(
        select(AcademicYear).where(AcademicYear.campus_id == campus.id, AcademicYear.is_current.is_(True))
    )
    db.add(
        AcademicYear(
            campus_id=campus.id,
            name="2026-27",
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
            is_current=has_current is None,
            is_active=True,
        )
    )


def _seed_current_financial_year(db: Session, campus: Campus) -> None:
    """April–March financial year — intentionally separate from academic year rows."""
    existing = db.scalar(
        select(FinancialYear).where(FinancialYear.campus_id == campus.id, FinancialYear.name == "FY 2026-27")
    )
    if existing is not None:
        return
    has_current = db.scalar(
        select(FinancialYear).where(
            FinancialYear.campus_id == campus.id, FinancialYear.is_current.is_(True)
        )
    )
    db.add(
        FinancialYear(
            campus_id=campus.id,
            name="FY 2026-27",
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
            is_current=has_current is None,
            is_active=True,
        )
    )


def _seed_user(db: Session, *, campus: Campus, role: Role, email: str, password: str) -> None:
    existing = db.scalar(select(User).where(User.email == email.lower()))
    if existing is not None:
        return
    db.add(
        User(
            campus_id=campus.id,
            role_id=role.id,
            email=email.lower(),
            password_hash=hash_password(password),
            is_active=True,
            must_change_password=False,
        )
    )
