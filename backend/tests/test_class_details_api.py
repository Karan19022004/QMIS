"""Behaviours the Administrator Class Details screen depends on (existing masters API, no new routes).

The screen lists classes with their sections and academic year, creates a class with its first
section, adds further sections to an existing class (so a retry after a partial failure is safe),
and filters by academic year. These tests pin that contract.
"""

import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-phase0-local"

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

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


def _name(client, prefix):
    return f"{prefix}-{len(client.get(CLASSES, headers=_admin(client)).json())}-{os.urandom(2).hex()}"


def test_a_new_class_defaults_to_the_current_year_and_gets_its_first_section(client):
    admin = _admin(client)
    current = client.get(f"{YEARS}/current", headers=admin).json()
    name = _name(client, "Cd")
    created = client.post(CLASSES, json={"name": name, "section": "a"}, headers=admin)
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["academic_year_id"] == current["id"] and body["section"] == "A"
    sections = client.get(SECTIONS, params={"class_id": body["id"]}, headers=admin).json()
    assert [s["name"] for s in sections] == ["A"]


def test_the_year_filter_returns_only_that_years_classes(client):
    admin = _admin(client)
    current = client.get(f"{YEARS}/current", headers=admin).json()
    other = client.post(YEARS, json={"name": f"2099-{os.urandom(2).hex()}"}, headers=admin)
    assert other.status_code == 201, other.text
    in_current = client.post(CLASSES, json={"name": _name(client, "InCur")}, headers=admin).json()
    in_other = client.post(
        CLASSES, json={"name": _name(client, "InOth"), "academic_year_id": other.json()["id"]}, headers=admin
    ).json()
    cur_ids = {c["id"] for c in client.get(CLASSES, params={"academic_year_id": current["id"]}, headers=admin).json()}
    oth_ids = {c["id"] for c in client.get(CLASSES, params={"academic_year_id": other.json()["id"]}, headers=admin).json()}
    assert in_current["id"] in cur_ids and in_other["id"] not in cur_ids
    assert oth_ids == {in_other["id"]}
    everything = {c["id"] for c in client.get(CLASSES, headers=admin).json()}
    assert {in_current["id"], in_other["id"]} <= everything


def test_an_unknown_academic_year_is_refused_and_nothing_is_created(client):
    admin = _admin(client)
    name = _name(client, "Ghost")
    before = len(client.get(CLASSES, headers=admin).json())
    refused = client.post(
        CLASSES, json={"name": name, "academic_year_id": "22222222-2222-2222-2222-222222222222"}, headers=admin
    )
    assert refused.status_code == 404 and refused.json()["detail"]["code"] == "academic_year_not_found"
    assert len(client.get(CLASSES, headers=admin).json()) == before


def test_duplicates_are_conflicts_with_a_stable_code_so_a_retry_can_skip_them(client):
    admin = _admin(client)
    name = _name(client, "Dup")
    created = client.post(CLASSES, json={"name": name, "section": "A"}, headers=admin).json()
    again = client.post(CLASSES, json={"name": name}, headers=admin)
    assert again.status_code == 409 and again.json()["detail"]["code"] == "class_exists"
    extra = client.post(SECTIONS, json={"class_id": created["id"], "name": "b"}, headers=admin)
    assert extra.status_code == 201 and extra.json()["name"] == "B"
    repeat = client.post(SECTIONS, json={"class_id": created["id"], "name": "B"}, headers=admin)
    assert repeat.status_code == 409 and repeat.json()["detail"]["code"] == "section_exists"
    names = sorted(s["name"] for s in client.get(SECTIONS, params={"class_id": created["id"]}, headers=admin).json())
    assert names == ["A", "B"]


def test_a_section_for_a_class_that_does_not_exist_is_a_404(client):
    admin = _admin(client)
    refused = client.post(SECTIONS, json={"class_id": "33333333-3333-3333-3333-333333333333", "name": "A"}, headers=admin)
    assert refused.status_code == 404 and refused.json()["detail"]["code"] == "class_not_found"


def test_only_users_with_masters_write_can_create_but_others_can_read(client):
    teacher = _login(client, settings.teacher_seed_email, settings.teacher_seed_password)
    assert client.post(CLASSES, json={"name": "NotAllowed"}, headers=teacher).status_code == 403
    assert client.post(SECTIONS, json={"class_id": "33333333-3333-3333-3333-333333333333", "name": "A"}, headers=teacher).status_code == 403
    assert client.get(CLASSES, headers=teacher).status_code == 200
    assert client.get(CLASSES).status_code == 401
    assert client.post(CLASSES, json={"name": "Anon"}).status_code == 401


def test_the_api_has_no_class_update_or_delete_so_the_screen_must_not_offer_them(client):
    admin = _admin(client)
    created = client.post(CLASSES, json={"name": _name(client, "NoDel")}, headers=admin).json()
    assert client.delete(f"{CLASSES}/{created['id']}", headers=admin).status_code in (404, 405)
    assert client.patch(f"{CLASSES}/{created['id']}", json={"name": "X"}, headers=admin).status_code in (404, 405)
