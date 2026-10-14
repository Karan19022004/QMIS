"""Administrator Announcements: sending, who sees a notice, acknowledgements, replies, attachments.

Seeded logins come from settings; no credential is hard-coded here.
"""

import os
import uuid

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-phase0-local"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.database import SessionLocal
from app.main import app
from app.models import Announcement, AuditLog, Campus, FileAsset
from app.services.announcements import CATEGORIES, DEFAULT_AUDIENCE

ADMIN = (settings.admin_seed_email, settings.admin_seed_password)
HR = (settings.hr_seed_email, settings.hr_seed_password)
PRINCIPAL = (settings.principal_seed_email, settings.principal_seed_password)
TEACHER = (settings.teacher_seed_email, settings.teacher_seed_password)
COORDINATOR = (settings.coordinator_seed_email, settings.coordinator_seed_password)
ACCOUNT_HEAD = (settings.accounthead_seed_email, settings.accounthead_seed_password)

PDF = b"%PDF-1.4\n% notice attachment\n"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


def _login(client, who):
    response = client.post("/api/v1/auth/login", json={"email": who[0], "password": who[1]})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _send(client, headers, *, title=None, category="General Announcement", message="Please read.", **extra):
    data = {"title": title or f"Notice {uuid.uuid4().hex[:8]}", "category": category, "message": message, **extra}
    files = extra.pop("files", None)
    data.pop("files", None)
    return client.post("/api/v1/announcements", data=data, files=files, headers=headers)


def _send_ok(client, headers, **kwargs):
    response = _send(client, headers, **kwargs)
    assert response.status_code == 201, response.text
    return response.json()


def _count(model):
    with SessionLocal() as db:
        return db.scalar(select(func.count()).select_from(model))


def _audit_count(action):
    with SessionLocal() as db:
        return db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == action))


# --- sending ---------------------------------------------------------------------------------


def test_admin_sends_an_announcement_and_it_is_listed(client):
    admin = _login(client, ADMIN)
    made = _send_ok(client, admin, title="Annual Day schedule", category="Examination", message="Rehearsals begin Monday.")
    assert made["id"].startswith("AN-") and made["title"] == "Annual Day schedule"
    assert made["category"] == "Examination" and made["sentBy"] == "Admin" and made["senderRole"] == "admin"
    assert made["attachmentName"] == "" and made["acknowledged"] is False and made["replies"] == []
    assert "audience" not in made  # who it went to is the server's business

    listed = client.get("/api/v1/announcements", headers=admin).json()
    assert made["id"] in [row["id"] for row in listed]
    one = client.get(f"/api/v1/announcements/{made['id']}", headers=admin).json()
    assert one["message"] == "Rehearsals begin Monday."
    assert client.get(f"/api/v1/announcements/{made['uuid']}", headers=admin).json()["id"] == made["id"]


def test_codes_are_sequential_and_unique(client):
    admin = _login(client, ADMIN)
    first = _send_ok(client, admin)["id"]
    second = _send_ok(client, admin)["id"]
    assert int(second.split("-")[1]) == int(first.split("-")[1]) + 1


def test_sent_by_and_audience_come_from_the_server_not_the_request(client):
    admin = _login(client, ADMIN)
    made = _send_ok(client, admin, sent_by="Director", sender_role="director", audience="accounthead")
    assert made["sentBy"] == "Admin" and made["senderRole"] == "admin"
    with SessionLocal() as db:
        row = db.scalar(select(Announcement).where(Announcement.code == made["id"]))
        assert row.audience == DEFAULT_AUDIENCE and "accounthead" not in row.audience


def test_defaults_to_today_and_accepts_a_date_within_the_window(client):
    admin = _login(client, ADMIN)
    assert _send_ok(client, admin)["announcementDate"]
    assert _send_ok(client, admin, announcement_date="2026-10-20")["announcementDate"] == "2026-10-20"


@pytest.mark.parametrize(
    ("overrides", "code"),
    [
        ({"title": "   "}, "title_required"),
        ({"title": "x" * 201}, "title_too_long"),
        ({"category": "Not A Category"}, "invalid_category"),
        ({"category": " "}, "invalid_category"),
        ({"message": "  "}, "message_required"),
        ({"message": "m" * 5001}, "message_too_long"),
        ({"announcement_date": "2031-01-01"}, "invalid_date"),
        ({"announcement_date": "2019-01-01"}, "invalid_date"),
    ],
)
def test_invalid_announcements_are_refused_and_nothing_is_saved(client, overrides, code):
    admin = _login(client, ADMIN)
    before = _count(Announcement)
    response = _send(client, admin, **overrides)
    assert response.status_code == 422, response.text
    assert response.json()["detail"]["code"] == code
    assert _count(Announcement) == before


def test_every_listed_category_is_accepted_and_the_list_is_served(client):
    admin = _login(client, ADMIN)
    assert client.get("/api/v1/announcements/categories", headers=admin).json() == CATEGORIES
    for category in CATEGORIES:
        assert _send(client, admin, category=category).status_code == 201


def test_unauthenticated_requests_are_refused(client):
    assert client.get("/api/v1/announcements").status_code == 401
    assert client.post("/api/v1/announcements", data={"title": "t", "category": "Staff Notice", "message": "m"}).status_code == 401


def test_roles_without_the_write_permission_cannot_send(client):
    before = _count(Announcement)
    for who in (TEACHER, COORDINATOR, ACCOUNT_HEAD):
        response = _send(client, _login(client, who))
        assert response.status_code == 403, (who[0], response.text)
    assert _count(Announcement) == before


def test_principal_and_hr_can_send(client):
    principal = _send_ok(client, _login(client, PRINCIPAL))
    hr = _send_ok(client, _login(client, HR))
    assert principal["sentBy"] == "Principal" and hr["sentBy"] == "HR"


# --- who sees a notice ------------------------------------------------------------------------


def test_audience_roles_see_it_and_other_roles_do_not(client):
    made = _send_ok(client, _login(client, ADMIN))
    teacher = _login(client, TEACHER)
    outsider = _login(client, ACCOUNT_HEAD)

    assert made["id"] in [row["id"] for row in client.get("/api/v1/announcements", headers=teacher).json()]
    assert client.get(f"/api/v1/announcements/{made['id']}", headers=teacher).status_code == 200

    assert made["id"] not in [row["id"] for row in client.get("/api/v1/announcements", headers=outsider).json()]
    assert client.get(f"/api/v1/announcements/{made['id']}", headers=outsider).status_code == 404
    assert client.post(f"/api/v1/announcements/{made['id']}/acknowledge", headers=outsider).status_code == 404
    assert client.post(f"/api/v1/announcements/{made['id']}/replies", json={"text": "hi"}, headers=outsider).status_code == 404


def test_the_sender_sees_their_own_notice_even_outside_the_audience(client):
    made = _send_ok(client, _login(client, HR))  # HR is not in the default audience
    hr = _login(client, HR)
    assert made["id"] in [row["id"] for row in client.get("/api/v1/announcements", headers=hr).json()]
    outsider = _login(client, ACCOUNT_HEAD)
    assert made["id"] not in [row["id"] for row in client.get("/api/v1/announcements", headers=outsider).json()]
    teacher = _login(client, TEACHER)  # but the audience roles do see an HR notice
    assert made["id"] in [row["id"] for row in client.get("/api/v1/announcements", headers=teacher).json()]


def test_unknown_announcement_is_404(client):
    admin = _login(client, ADMIN)
    assert client.get("/api/v1/announcements/AN-9999", headers=admin).status_code == 404
    assert client.get(f"/api/v1/announcements/{uuid.uuid4()}", headers=admin).status_code == 404


# --- acknowledgements and replies -----------------------------------------------------------------


def test_acknowledging_is_per_person_and_happens_once(client):
    made = _send_ok(client, _login(client, ADMIN))
    teacher = _login(client, TEACHER)
    coordinator = _login(client, COORDINATOR)
    before = _audit_count("ANNOUNCEMENT_ACKNOWLEDGED")

    first = client.post(f"/api/v1/announcements/{made['id']}/acknowledge", headers=teacher)
    again = client.post(f"/api/v1/announcements/{made['id']}/acknowledge", headers=teacher)
    assert first.status_code == 200 and first.json()["acknowledged"] is True
    assert again.json()["acknowledgedAt"] == first.json()["acknowledgedAt"]
    assert _audit_count("ANNOUNCEMENT_ACKNOWLEDGED") == before + 1

    mine = {row["id"]: row for row in client.get("/api/v1/announcements", headers=teacher).json()}
    theirs = {row["id"]: row for row in client.get("/api/v1/announcements", headers=coordinator).json()}
    assert mine[made["id"]]["acknowledged"] is True and theirs[made["id"]]["acknowledged"] is False


def test_replies_are_seen_by_the_sender_and_only_by_their_author_otherwise(client):
    made = _send_ok(client, _login(client, ADMIN))
    teacher = _login(client, TEACHER)
    coordinator = _login(client, COORDINATOR)
    admin = _login(client, ADMIN)
    before = _audit_count("ANNOUNCEMENT_REPLIED")

    sent = client.post(f"/api/v1/announcements/{made['id']}/replies", json={"text": "  Understood.  "}, headers=teacher)
    assert sent.status_code == 201, sent.text
    assert [(r["text"], r["by"], r["mine"]) for r in sent.json()["replies"]] == [("Understood.", "teacher", True)]
    assert _audit_count("ANNOUNCEMENT_REPLIED") == before + 1

    seen_by_sender = client.get(f"/api/v1/announcements/{made['id']}", headers=admin).json()["replies"]
    assert [(r["text"], r["by"], r["mine"]) for r in seen_by_sender] == [("Understood.", "teacher", False)]
    assert client.get(f"/api/v1/announcements/{made['id']}", headers=coordinator).json()["replies"] == []
    assert len(client.get(f"/api/v1/announcements/{made['id']}", headers=teacher).json()["replies"]) == 1


@pytest.mark.parametrize(("text", "code"), [("   ", "reply_required"), ("r" * 1001, "reply_too_long")])
def test_invalid_replies_are_refused(client, text, code):
    made = _send_ok(client, _login(client, ADMIN))
    response = client.post(f"/api/v1/announcements/{made['id']}/replies", json={"text": text}, headers=_login(client, TEACHER))
    assert response.status_code == 422 and response.json()["detail"]["code"] == code


# --- attachments ------------------------------------------------------------------------------------


def test_attachment_is_stored_and_downloads_byte_for_byte_for_readers_only(client):
    admin = _login(client, ADMIN)
    made = _send_ok(client, admin, files={"file": ("circular.pdf", PDF, "application/octet-stream")})
    assert made["attachmentName"] == "circular.pdf" and made["attachmentUrl"].startswith("/api/v1/files/")

    teacher = _login(client, TEACHER)
    seen = client.get(f"/api/v1/announcements/{made['id']}", headers=teacher).json()
    download = client.get(seen["attachmentUrl"], headers=teacher)
    assert download.status_code == 200 and download.content == PDF

    outsider = _login(client, ACCOUNT_HEAD)
    assert client.get(seen["attachmentUrl"], headers=outsider).status_code == 404
    assert client.get(seen["attachmentUrl"]).status_code == 401
    with SessionLocal() as db:
        file = db.scalar(select(FileAsset).where(FileAsset.original_name == "circular.pdf", FileAsset.resource_type == "announcement"))
        assert file.resource_id == made["id"] and file.content_type == "application/pdf"


@pytest.mark.parametrize(
    ("name", "content", "status"),
    [
        pytest.param("notes.exe", lambda: b"MZ\x90\x00", 415, id="exe"),
        pytest.param("fake.pdf", lambda: b"not really a pdf", 415, id="wrong-signature"),
        pytest.param("page.html", lambda: b"<html></html>", 415, id="html"),
        pytest.param("empty.pdf", lambda: b"", 422, id="empty"),
        pytest.param("huge.pdf", lambda: b"%PDF-" + b"0" * (5 * 1024 * 1024), 413, id="too-large"),
    ],
)
def test_bad_attachments_are_refused_and_leave_nothing_behind(client, name, content, status):
    admin = _login(client, ADMIN)
    announcements, files = _count(Announcement), _count(FileAsset)
    response = _send(client, admin, files={"file": (name, content(), "application/pdf")})
    assert response.status_code == status, response.text
    assert _count(Announcement) == announcements and _count(FileAsset) == files


def test_a_failed_announcement_does_not_keep_its_uploaded_file(client):
    admin = _login(client, ADMIN)
    announcements, files = _count(Announcement), _count(FileAsset)
    response = _send(client, admin, category="Nope", files={"file": ("ok.pdf", PDF, "application/pdf")})
    assert response.status_code == 422
    assert _count(Announcement) == announcements and _count(FileAsset) == files


def test_png_attachment_is_accepted(client):
    made = _send_ok(client, _login(client, ADMIN), files={"file": ("poster.png", PNG, "image/png")})
    assert made["attachmentName"] == "poster.png"


# --- notifications and audit ------------------------------------------------------------------------


def test_audience_gets_a_notification_but_the_senders_role_does_not(client):
    title = f"Fee reminder {uuid.uuid4().hex[:8]}"
    made = _send_ok(client, _login(client, ADMIN), title=title)
    teacher_notes = client.get("/api/v1/notifications", headers=_login(client, TEACHER)).json()
    match = [n for n in teacher_notes if n["entityType"] == "announcement" and n["entityId"] == made["id"]]
    assert len(match) == 1 and match[0]["title"] == f"New announcement: {title}"

    admin_notes = client.get("/api/v1/notifications", headers=_login(client, ADMIN)).json()
    assert not [n for n in admin_notes if n["entityId"] == made["id"]]
    outsider_notes = client.get("/api/v1/notifications", headers=_login(client, ACCOUNT_HEAD)).json()
    assert not [n for n in outsider_notes if n["entityId"] == made["id"]]


def test_sending_is_audited_with_the_code_only(client):
    before = _audit_count("ANNOUNCEMENT_CREATED")
    made = _send_ok(client, _login(client, ADMIN), title="Confidential wording", message="secret body text")
    assert _audit_count("ANNOUNCEMENT_CREATED") == before + 1
    with SessionLocal() as db:
        entry = db.scalars(
            select(AuditLog).where(AuditLog.action == "ANNOUNCEMENT_CREATED").order_by(AuditLog.created_at.desc())
        ).first()
        assert entry.details == made["id"] and "secret" not in (entry.details or "")


# --- database rules ------------------------------------------------------------------------------------


def test_the_database_refuses_a_duplicate_code_in_a_campus(client):
    made = _send_ok(client, _login(client, ADMIN))
    with SessionLocal() as db:
        campus = db.scalar(select(Campus))
        db.add(
            Announcement(
                campus_id=campus.id,
                code=made["id"],
                title="dup",
                category="Staff Notice",
                message="m",
                sent_by="Admin",
                sender_role="admin",
                announcement_date=__import__("datetime").date.today(),
                audience=[],
            )
        )
        with pytest.raises(IntegrityError):
            db.commit()
