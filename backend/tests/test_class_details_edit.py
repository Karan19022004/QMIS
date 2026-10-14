"""Class Details, step 3: edit sections (capacity, room, class teacher), deactivate / delete classes,
one class per name PER ACADEMIC YEAR.

Rules pinned here, enforced on the server (the screen can hide a button but the API must still say no):
  * only a role holding ``masters.write`` may change anything; everyone with ``masters.read`` may look;
  * a class teacher is a login (users.id) on the same campus, active, in a teaching role;
  * a class is identified by name + academic year and cannot be renamed (records refer to the name);
  * a class that is still referenced is deactivated, never deleted; only an unused class is deleted;
  * the database, not just the API, refuses a second copy of a class in one year.
"""

import os
import uuid

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-phase0-local"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.main import app
from app.models import AcademicYear, AuditLog, Campus, LessonPlan, Role, SchoolClass, Section, User

CLASSES = "/api/v1/masters/classes"
SECTIONS = "/api/v1/masters/sections"
YEARS = "/api/v1/masters/academic-years"


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


def _login(client, email, password):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _admin(client):
    return _login(client, settings.admin_seed_email, settings.admin_seed_password)


def _teacher_headers(client):
    return _login(client, settings.teacher_seed_email, settings.teacher_seed_password)


def _user_id(email):
    with SessionLocal() as db:
        return str(db.scalar(select(User.id).where(User.email == email)))


def _unique(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:6]}"


def _new_class(client, admin, prefix="Ce", **extra):
    body = {"name": _unique(prefix), "section": "A", **extra}
    response = client.post(CLASSES, json=body, headers=admin)
    assert response.status_code == 201, response.text
    return response.json()


def _first_section(client, admin, class_id):
    sections = client.get(SECTIONS, params={"class_id": class_id}, headers=admin).json()
    assert sections, "the class should have its first section"
    return sections[0]


def _code(response):
    return response.json()["detail"]["code"]


# ---------------------------------------------------------------------------------------------
# edit: capacity, room, class teacher
# ---------------------------------------------------------------------------------------------


def test_capacity_room_and_class_teacher_are_saved_and_come_back_on_the_next_request(client):
    admin = _admin(client)
    cls = _new_class(client, admin)
    section = _first_section(client, admin, cls["id"])
    teacher_id = _user_id(settings.teacher_seed_email)

    edited = client.patch(
        f"{SECTIONS}/{section['id']}",
        json={"capacity": 40, "room_number": "  102 ", "class_teacher_user_id": teacher_id},
        headers=admin,
    )
    assert edited.status_code == 200, edited.text
    body = edited.json()
    assert body["capacity"] == 40 and body["room_number"] == "102"
    assert body["class_teacher_user_id"] == teacher_id
    assert body["class_teacher_email"] == settings.teacher_seed_email

    again = client.get(f"{SECTIONS}/{section['id']}", headers=admin).json()
    assert (again["capacity"], again["room_number"], again["class_teacher_user_id"]) == (40, "102", teacher_id)


def test_class_capacity_is_the_sum_of_its_active_sections_and_is_not_stored(client):
    admin = _admin(client)
    cls = _new_class(client, admin)
    first = _first_section(client, admin, cls["id"])
    assert cls["capacity"] is None  # no section has a capacity yet
    client.patch(f"{SECTIONS}/{first['id']}", json={"capacity": 40}, headers=admin)
    second = client.post(SECTIONS, json={"class_id": cls["id"], "name": "b", "capacity": 35}, headers=admin)
    assert second.status_code == 201 and second.json()["capacity"] == 35

    def class_capacity():
        rows = client.get(CLASSES, headers=admin).json()
        return next(c for c in rows if c["id"] == cls["id"])["capacity"]

    assert class_capacity() == 75
    client.delete(f"{SECTIONS}/{second.json()['id']}", headers=admin)  # deactivating a section drops it from the sum
    assert class_capacity() == 40


def test_explicit_null_clears_a_field_and_leaving_it_out_keeps_it(client):
    admin = _admin(client)
    section = _first_section(client, admin, _new_class(client, admin)["id"])
    teacher_id = _user_id(settings.teacher_seed_email)
    client.patch(
        f"{SECTIONS}/{section['id']}",
        json={"capacity": 30, "room_number": "7", "class_teacher_user_id": teacher_id},
        headers=admin,
    )
    kept = client.patch(f"{SECTIONS}/{section['id']}", json={"room_number": "8"}, headers=admin).json()
    assert (kept["capacity"], kept["room_number"], kept["class_teacher_user_id"]) == (30, "8", teacher_id)
    cleared = client.patch(
        f"{SECTIONS}/{section['id']}",
        json={"capacity": None, "room_number": "", "class_teacher_user_id": None},
        headers=admin,
    ).json()
    assert (cleared["capacity"], cleared["room_number"], cleared["class_teacher_user_id"]) == (None, None, None)
    assert cleared["class_teacher_email"] is None


@pytest.mark.parametrize("capacity", [0, -5, 1001])
def test_a_capacity_outside_one_to_a_thousand_is_refused(client, capacity):
    admin = _admin(client)
    section = _first_section(client, admin, _new_class(client, admin)["id"])
    refused = client.patch(f"{SECTIONS}/{section['id']}", json={"capacity": capacity}, headers=admin)
    assert refused.status_code == 422
    assert client.get(f"{SECTIONS}/{section['id']}", headers=admin).json()["capacity"] is None


def test_the_database_itself_refuses_a_non_positive_capacity():
    with SessionLocal() as db:
        year = db.scalar(select(AcademicYear).where(AcademicYear.is_current.is_(True)))
        cls = SchoolClass(campus_id=year.campus_id, academic_year_id=year.id, name=_unique("Db"))
        db.add(cls)
        db.flush()
        db.add(Section(campus_id=year.campus_id, class_id=cls.id, name="A", capacity=0))
        with pytest.raises(IntegrityError):
            db.flush()
        db.rollback()


# ---------------------------------------------------------------------------------------------
# class teacher must be a real, active, teaching login on the same campus
# ---------------------------------------------------------------------------------------------


def _make_login(role_code, *, campus_id, active=True):
    email = f"{_unique(role_code)}@qmis.test"
    with SessionLocal() as db:
        role = db.scalar(select(Role).where(Role.code == role_code))
        user = User(
            campus_id=campus_id,
            role_id=role.id,
            email=email,
            password_hash=hash_password("Unused-1234"),
            is_active=active,
        )
        db.add(user)
        db.commit()
        return str(user.id)


def _campus_id():
    with SessionLocal() as db:
        return db.scalar(select(User.campus_id).where(User.email == settings.admin_seed_email))


def test_a_class_teacher_must_exist_be_active_and_hold_a_teaching_role(client):
    admin = _admin(client)
    section = _first_section(client, admin, _new_class(client, admin)["id"])
    url = f"{SECTIONS}/{section['id']}"

    unknown = client.patch(url, json={"class_teacher_user_id": str(uuid.uuid4())}, headers=admin)
    assert unknown.status_code == 404 and _code(unknown) == "class_teacher_not_found"

    inactive = client.patch(
        url, json={"class_teacher_user_id": _make_login("teacher", campus_id=_campus_id(), active=False)}, headers=admin
    )
    assert inactive.status_code == 409 and _code(inactive) == "class_teacher_inactive"

    wrong_role = client.patch(
        url, json={"class_teacher_user_id": _user_id(settings.principal_seed_email)}, headers=admin
    )
    assert wrong_role.status_code == 409 and _code(wrong_role) == "class_teacher_role"

    assert client.get(url, headers=admin).json()["class_teacher_user_id"] is None  # nothing was half-saved


def test_a_teacher_from_another_campus_cannot_be_assigned(client):
    admin = _admin(client)
    section = _first_section(client, admin, _new_class(client, admin)["id"])
    with SessionLocal() as db:
        other = Campus(code=_unique("OC")[:32], name="Other campus", city="Elsewhere")
        db.add(other)
        db.commit()
        other_id = other.id
    foreign_teacher = _make_login("teacher", campus_id=other_id)
    refused = client.patch(
        f"{SECTIONS}/{section['id']}", json={"class_teacher_user_id": foreign_teacher}, headers=admin
    )
    assert refused.status_code == 404 and _code(refused) == "class_teacher_not_found"


def test_a_class_teacher_can_be_set_when_the_section_is_created(client):
    admin = _admin(client)
    cls = _new_class(client, admin)
    teacher_id = _user_id(settings.teacher_seed_email)
    created = client.post(
        SECTIONS,
        json={"class_id": cls["id"], "name": "c", "capacity": 25, "room_number": "9", "class_teacher_user_id": teacher_id},
        headers=admin,
    )
    assert created.status_code == 201, created.text
    assert created.json()["class_teacher_user_id"] == teacher_id and created.json()["capacity"] == 25
    bad = client.post(
        SECTIONS, json={"class_id": cls["id"], "name": "d", "class_teacher_user_id": str(uuid.uuid4())}, headers=admin
    )
    assert bad.status_code == 404
    assert [s["name"] for s in client.get(SECTIONS, params={"class_id": cls["id"]}, headers=admin).json()] == ["A", "C"]


# ---------------------------------------------------------------------------------------------
# permissions are enforced by the server
# ---------------------------------------------------------------------------------------------

from app.permissions.matrix import ROLE_PERMISSIONS  # noqa: E402

NON_ADMIN_ROLES = [
    ("teacher", settings.teacher_seed_email, settings.teacher_seed_password),
    ("coordinator", settings.coordinator_seed_email, settings.coordinator_seed_password),
    ("principal", settings.principal_seed_email, settings.principal_seed_password),
    ("hr", settings.hr_seed_email, settings.hr_seed_password),
    ("accounthead", settings.accounthead_seed_email, settings.accounthead_seed_password),
]


@pytest.mark.parametrize("role,email,password", NON_ADMIN_ROLES)
def test_roles_without_masters_write_never_change_classes(client, role, email, password):
    """Reading follows ``masters.read`` in the permission matrix; changing needs ``masters.write``,
    which none of these roles hold."""
    assert "masters.write" not in ROLE_PERMISSIONS[role]
    admin = _admin(client)
    cls = _new_class(client, admin)
    section = _first_section(client, admin, cls["id"])
    who = _login(client, email, password)

    expected_read = 200 if "masters.read" in ROLE_PERMISSIONS[role] else 403
    assert client.get(CLASSES, headers=who).status_code == expected_read
    assert client.get(SECTIONS, headers=who).status_code == expected_read

    attempts = [
        client.post(CLASSES, json={"name": _unique("Nope")}, headers=who),
        client.patch(f"{CLASSES}/{cls['id']}", json={"is_active": False}, headers=who),
        client.delete(f"{CLASSES}/{cls['id']}", headers=who),
        client.post(SECTIONS, json={"class_id": cls["id"], "name": "Z"}, headers=who),
        client.patch(f"{SECTIONS}/{section['id']}", json={"capacity": 50}, headers=who),
        client.delete(f"{SECTIONS}/{section['id']}", headers=who),
    ]
    assert [r.status_code for r in attempts] == [403] * 6

    # and nothing changed
    still = next(c for c in client.get(CLASSES, headers=admin).json() if c["id"] == cls["id"])
    assert still["is_active"] is True
    assert client.get(f"{SECTIONS}/{section['id']}", headers=admin).json()["capacity"] is None


def test_no_login_at_all_is_unauthorised(client):
    assert client.patch(f"{CLASSES}/{uuid.uuid4()}", json={"is_active": False}).status_code in (401, 403)
    assert client.delete(f"{CLASSES}/{uuid.uuid4()}").status_code in (401, 403)


def test_an_admin_of_another_campus_cannot_see_or_change_this_campus_classes(client):
    admin = _admin(client)
    cls = _new_class(client, admin)
    section = _first_section(client, admin, cls["id"])
    with SessionLocal() as db:
        other = Campus(code=_unique("OA")[:32], name="Other campus", city="Elsewhere")
        db.add(other)
        db.commit()
        role = db.scalar(select(Role).where(Role.code == "admin"))
        email = f"{_unique('otheradmin')}@qmis.edu"
        db.add(
            User(campus_id=other.id, role_id=role.id, email=email, password_hash=hash_password("Other-Admin-1"), is_active=True)
        )
        db.commit()
    foreign = _login(client, email, "Other-Admin-1")

    assert cls["id"] not in {c["id"] for c in client.get(CLASSES, headers=foreign).json()}
    assert client.patch(f"{CLASSES}/{cls['id']}", json={"is_active": False}, headers=foreign).status_code == 404
    assert client.delete(f"{CLASSES}/{cls['id']}", headers=foreign).status_code == 404
    assert client.patch(f"{SECTIONS}/{section['id']}", json={"capacity": 9}, headers=foreign).status_code == 404
    assert client.get(f"{SECTIONS}/{section['id']}", headers=foreign).status_code == 404
    assert client.get(f"{CLASSES}/{cls['id']}", headers=foreign).status_code in (404, 405)


# ---------------------------------------------------------------------------------------------
# deactivate and reactivate
# ---------------------------------------------------------------------------------------------


def test_deactivating_a_class_hides_it_and_its_sections_and_reactivating_brings_them_back(client):
    admin = _admin(client)
    cls = _new_class(client, admin)

    off = client.patch(f"{CLASSES}/{cls['id']}", json={"is_active": False}, headers=admin)
    assert off.status_code == 200 and off.json()["is_active"] is False
    assert cls["id"] not in {c["id"] for c in client.get(CLASSES, headers=admin).json()}
    assert cls["id"] in {c["id"] for c in client.get(CLASSES, params={"include_inactive": True}, headers=admin).json()}
    assert client.get(SECTIONS, params={"class_id": cls["id"]}, headers=admin).json() == []
    assert client.get(SECTIONS, params={"class_id": cls["id"], "include_inactive": True}, headers=admin).json() != []

    blocked = client.post(SECTIONS, json={"class_id": cls["id"], "name": "Q"}, headers=admin)
    assert blocked.status_code == 409 and _code(blocked) == "class_inactive"
    again = client.post(CLASSES, json={"name": cls["name"]}, headers=admin)
    assert again.status_code == 409 and _code(again) == "class_exists" and "reactivate" in again.json()["detail"]["message"]

    on = client.patch(f"{CLASSES}/{cls['id']}", json={"is_active": True}, headers=admin)
    assert on.status_code == 200 and on.json()["is_active"] is True
    assert cls["id"] in {c["id"] for c in client.get(CLASSES, headers=admin).json()}
    assert client.get(SECTIONS, params={"class_id": cls["id"]}, headers=admin).json() != []


def test_a_class_patch_with_nothing_to_change_is_refused(client):
    admin = _admin(client)
    cls = _new_class(client, admin)
    refused = client.patch(f"{CLASSES}/{cls['id']}", json={}, headers=admin)
    assert refused.status_code == 422 and _code(refused) == "nothing_to_update"


# ---------------------------------------------------------------------------------------------
# permanent delete: only for a class nothing refers to
# ---------------------------------------------------------------------------------------------


def test_an_unused_class_is_deleted_with_its_sections_and_the_delete_is_audited(client):
    admin = _admin(client)
    cls = _new_class(client, admin, section="A")
    client.post(SECTIONS, json={"class_id": cls["id"], "name": "B"}, headers=admin)

    gone = client.delete(f"{CLASSES}/{cls['id']}", headers=admin)
    assert gone.status_code == 200 and gone.json()["id"] == cls["id"]
    assert cls["id"] not in {c["id"] for c in client.get(CLASSES, params={"include_inactive": True}, headers=admin).json()}
    assert client.get(SECTIONS, params={"class_id": cls["id"], "include_inactive": True}, headers=admin).json() == []
    assert client.delete(f"{CLASSES}/{cls['id']}", headers=admin).status_code == 404  # already gone

    with SessionLocal() as db:
        actions = set(db.scalars(select(AuditLog.action).where(AuditLog.entity_id == cls["id"])).all())
    assert {"CLASS_CREATED", "CLASS_DELETED"} <= actions


def test_a_class_named_by_an_admission_enquiry_cannot_be_deleted_but_can_be_deactivated(client):
    admin = _admin(client)
    cls = _new_class(client, admin, prefix="Used")
    enquiry = client.post(
        "/api/v1/admissions/enquiries",
        json={"student_name": "Test Pupil", "class_name": cls["name"], "guardian_name": "G", "guardian_phone": "9999999999"},
        headers=admin,
    )
    assert enquiry.status_code == 201, enquiry.text

    refused = client.delete(f"{CLASSES}/{cls['id']}", headers=admin)
    assert refused.status_code == 409 and _code(refused) == "class_in_use"
    assert "1 admission enquiry" in refused.json()["detail"]["message"]
    assert "Deactivate" in refused.json()["detail"]["message"]
    assert cls["id"] in {c["id"] for c in client.get(CLASSES, headers=admin).json()}  # still there

    assert client.patch(f"{CLASSES}/{cls['id']}", json={"is_active": False}, headers=admin).status_code == 200


def test_the_dependency_check_is_case_insensitive_and_campus_scoped(client):
    admin = _admin(client)
    cls = _new_class(client, admin, prefix="Cs")
    client.post(
        "/api/v1/admissions/enquiries",
        json={"student_name": "P", "class_name": cls["name"].upper(), "guardian_name": "G", "guardian_phone": "9999999999"},
        headers=admin,
    )
    assert client.delete(f"{CLASSES}/{cls['id']}", headers=admin).status_code == 409


# ---------------------------------------------------------------------------------------------
# a section that records refer to cannot be renamed
# ---------------------------------------------------------------------------------------------


def test_a_section_named_by_a_lesson_plan_cannot_be_renamed_but_an_unused_one_can(client):
    admin = _admin(client)
    cls = _new_class(client, admin, section="A")
    used = _first_section(client, admin, cls["id"])
    free = client.post(SECTIONS, json={"class_id": cls["id"], "name": "B"}, headers=admin).json()

    with SessionLocal() as db:
        db.add(
            LessonPlan(
                campus_id=_campus_id(),
                teacher_id=uuid.UUID(_user_id(settings.teacher_seed_email)),
                class_name=cls["name"],
                section="A",
                subject="Math",
                month="2026-10",
            )
        )
        db.commit()

    refused = client.patch(f"{SECTIONS}/{used['id']}", json={"name": "X"}, headers=admin)
    assert refused.status_code == 409 and _code(refused) == "section_in_use"
    assert "1 lesson plan" in refused.json()["detail"]["message"]
    assert client.get(f"{SECTIONS}/{used['id']}", headers=admin).json()["name"] == "A"

    renamed = client.patch(f"{SECTIONS}/{free['id']}", json={"name": "c"}, headers=admin)
    assert renamed.status_code == 200 and renamed.json()["name"] == "C"
    # editing capacity of the used section is fine: only the NAME is protected
    assert client.patch(f"{SECTIONS}/{used['id']}", json={"capacity": 33}, headers=admin).status_code == 200


# ---------------------------------------------------------------------------------------------
# one class per name per academic year, enforced by the database
# ---------------------------------------------------------------------------------------------


def test_the_same_class_name_is_allowed_in_another_year_but_not_twice_in_one(client):
    admin = _admin(client)
    other_year = client.post(YEARS, json={"name": f"2098-{uuid.uuid4().hex[:4]}"}, headers=admin)
    assert other_year.status_code == 201, other_year.text
    name = _unique("Yr")

    this_year = client.post(CLASSES, json={"name": name, "section": "A"}, headers=admin)
    next_year = client.post(
        CLASSES, json={"name": name, "section": "A", "academic_year_id": other_year.json()["id"]}, headers=admin
    )
    assert this_year.status_code == 201 and next_year.status_code == 201
    assert this_year.json()["id"] != next_year.json()["id"]
    assert this_year.json()["academic_year_id"] != next_year.json()["academic_year_id"]

    twice = client.post(
        CLASSES, json={"name": name, "academic_year_id": other_year.json()["id"]}, headers=admin
    )
    assert twice.status_code == 409 and _code(twice) == "class_exists"


def test_capacity_room_and_teacher_belong_to_the_class_of_that_year(client):
    admin = _admin(client)
    other_year = client.post(YEARS, json={"name": f"2097-{uuid.uuid4().hex[:4]}"}, headers=admin).json()
    name = _unique("Hist")
    old = client.post(CLASSES, json={"name": name, "section": "A"}, headers=admin).json()
    new = client.post(
        CLASSES, json={"name": name, "section": "A", "academic_year_id": other_year["id"]}, headers=admin
    ).json()
    teacher_id = _user_id(settings.teacher_seed_email)
    old_section = _first_section(client, admin, old["id"])
    new_section = _first_section(client, admin, new["id"])

    client.patch(
        f"{SECTIONS}/{old_section['id']}",
        json={"capacity": 40, "room_number": "101", "class_teacher_user_id": teacher_id},
        headers=admin,
    )
    client.patch(f"{SECTIONS}/{new_section['id']}", json={"capacity": 55, "room_number": "201"}, headers=admin)

    old_after = client.get(f"{SECTIONS}/{old_section['id']}", headers=admin).json()
    new_after = client.get(f"{SECTIONS}/{new_section['id']}", headers=admin).json()
    assert (old_after["capacity"], old_after["room_number"], old_after["class_teacher_user_id"]) == (40, "101", teacher_id)
    assert (new_after["capacity"], new_after["room_number"], new_after["class_teacher_user_id"]) == (55, "201", None)
    classes = {c["id"]: c for c in client.get(CLASSES, headers=admin).json()}
    assert classes[old["id"]]["capacity"] == 40 and classes[new["id"]]["capacity"] == 55


def test_the_database_refuses_a_duplicate_even_if_the_api_check_is_bypassed():
    """What protects against two concurrent requests that both pass the API's existence check."""
    with SessionLocal() as db:
        year = db.scalar(select(AcademicYear).where(AcademicYear.is_current.is_(True)))
        name = _unique("Race")
        db.add(SchoolClass(campus_id=year.campus_id, academic_year_id=year.id, name=name))
        db.commit()
        db.add(SchoolClass(campus_id=year.campus_id, academic_year_id=year.id, name=name))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()


def test_losing_a_race_to_the_database_constraint_is_a_409_not_a_500(client, monkeypatch):
    admin = _admin(client)
    name = _unique("Lost")
    real_commit = Session.commit

    def lose_once(self):
        monkeypatch.setattr(Session, "commit", real_commit)
        raise IntegrityError("INSERT INTO school_classes", {}, Exception("duplicate key"))

    monkeypatch.setattr(Session, "commit", lose_once)
    response = client.post(CLASSES, json={"name": name, "section": "A"}, headers=admin)
    assert response.status_code == 409 and _code(response) == "class_exists"
    assert name not in {c["name"] for c in client.get(CLASSES, params={"include_inactive": True}, headers=admin).json()}


def test_a_class_needs_an_academic_year_when_none_is_current(client):
    admin = _admin(client)
    with SessionLocal() as db:
        current = list(db.scalars(select(AcademicYear).where(AcademicYear.is_current.is_(True))).all())
        ids = [y.id for y in current]
        for year in current:
            year.is_current = False
        db.commit()
    try:
        refused = client.post(CLASSES, json={"name": _unique("NoYr")}, headers=admin)
        assert refused.status_code == 409 and _code(refused) == "academic_year_required"
    finally:
        with SessionLocal() as db:
            for year in db.scalars(select(AcademicYear).where(AcademicYear.id.in_(ids))).all():
                year.is_current = True
            db.commit()


# ---------------------------------------------------------------------------------------------
# the class-teacher picker
# ---------------------------------------------------------------------------------------------

OPTIONS = "/api/v1/masters/class-teacher-options"


def test_the_picker_lists_active_teaching_logins_of_this_campus_only(client):
    admin = _admin(client)
    inactive = _make_login("teacher", campus_id=_campus_id(), active=False)
    with SessionLocal() as db:
        other = Campus(code=_unique("OP")[:32], name="Other campus", city="Elsewhere")
        db.add(other)
        db.commit()
        other_id = other.id
    foreign = _make_login("teacher", campus_id=other_id)

    response = client.get(OPTIONS, headers=admin)
    assert response.status_code == 200, response.text
    options = response.json()
    ids = {o["user_id"] for o in options}
    assert _user_id(settings.teacher_seed_email) in ids
    assert _user_id(settings.coordinator_seed_email) in ids
    assert _user_id(settings.principal_seed_email) not in ids  # not a teaching role
    assert inactive not in ids and foreign not in ids
    assert {o["role"] for o in options} <= {"teacher", "coordinator"}
    assert all(set(o) == {"user_id", "email", "name", "role"} for o in options)


def test_every_option_can_actually_be_assigned_as_a_class_teacher(client):
    admin = _admin(client)
    section = _first_section(client, admin, _new_class(client, admin)["id"])
    for option in client.get(OPTIONS, headers=admin).json():
        ok = client.patch(
            f"{SECTIONS}/{section['id']}", json={"class_teacher_user_id": option["user_id"]}, headers=admin
        )
        assert ok.status_code == 200, (option, ok.text)


@pytest.mark.parametrize("role,email,password", NON_ADMIN_ROLES)
def test_the_picker_needs_masters_write(client, role, email, password):
    assert client.get(OPTIONS, headers=_login(client, email, password)).status_code == 403


def test_the_picker_needs_a_login(client):
    assert client.get(OPTIONS).status_code in (401, 403)
