"""Administrator Documents: secure student and employee document folders.

Covers storage and retrieval, file validation, replacing and removing files, who may read or change
them, that the generic download route honours those permissions, and that every change is audited.
Seeded logins come from settings; no credential is hard-coded here.
"""

import os
import uuid
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-phase0-local"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.core.config import settings
from app.core.database import SessionLocal
from app.main import app
from app.models import AuditLog, Campus, DocumentItem, DocumentRecord, FileAsset, HrEmployee, Student
from app.services.files import _uploads_dir

ADMIN = (settings.admin_seed_email, settings.admin_seed_password)
HR = (settings.hr_seed_email, settings.hr_seed_password)
TEACHER = (settings.teacher_seed_email, settings.teacher_seed_password)

PDF = b"%PDF-1.4\n% test document\n"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
JPG = b"\xff\xd8\xff\xe0" + b"\x00" * 32


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


def _login(client, who):
    response = client.post("/api/v1/auth/login", json={"email": who[0], "password": who[1]})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _student():
    with SessionLocal() as db:
        campus = db.scalar(select(Campus))
        tag = uuid.uuid4().hex[:8]
        row = Student(
            campus_id=campus.id, admission_number=f"ADM-{tag}", full_name=f"Doc Student {tag}", class_name="Grade 4"
        )
        db.add(row)
        db.commit()
        return str(row.id), row.admission_number


def _employee():
    with SessionLocal() as db:
        campus = db.scalar(select(Campus))
        tag = uuid.uuid4().hex[:8]
        row = HrEmployee(
            campus_id=campus.id,
            employee_code=f"DOC-{tag}",
            first_name="Doc",
            last_name=f"Employee {tag}",
            email=f"doc.{tag}@example.com",
        )
        db.add(row)
        db.commit()
        return row.employee_code


def _put(client, headers, kind, ref, label, content=PDF, name="proof.pdf", **form):
    files = {"file": (name, content, "application/octet-stream")} if content is not None else None
    return client.put(
        f"/api/v1/documents/{kind}/{ref}/items", data={"label": label, **form}, files=files, headers=headers
    )


def _all_four(client, admin, student_id):
    for code in ("aadhaar", "birth", "tc", "marksheet"):
        response = _put(client, admin, "students", student_id, code)
        assert response.status_code == 200, response.text
    return response.json()


def _audit_count(action):
    with SessionLocal() as db:
        return db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == action))


# --- students ------------------------------------------------------------------------------------


def test_student_folder_is_in_progress_until_all_four_documents_are_in(client):
    admin = _login(client, ADMIN)
    student_id, admission = _student()
    first = _put(client, admin, "students", student_id, "aadhaar")
    assert first.status_code == 200, first.text
    record = first.json()
    assert record["status"] == "In Progress" and record["subject_ref"] == admission
    assert [item["key"] for item in record["items"]] == ["aadhaar"]
    assert record["items"][0]["status"] == "Submitted" and record["items"][0]["file_name"] == "proof.pdf"

    done = _all_four(client, admin, student_id)
    assert done["status"] == "Completed"
    assert sorted(item["label"] for item in done["items"]) == ["Aadhaar/ID Proof", "Birth Certificate", "Mark Sheet", "TC"]
    listed = client.get("/api/v1/documents/students", headers=admin).json()
    assert [row["subject_id"] for row in listed].count(student_id) == 1


def test_the_stored_file_comes_back_byte_for_byte_with_a_server_chosen_type(client):
    admin = _login(client, ADMIN)
    student_id, _ = _student()
    record = _put(client, admin, "students", student_id, "birth", content=PNG, name="birth.png").json()
    item = record["items"][0]
    assert item["content_type"] == "image/png"  # from the extension and signature, not the client header
    download = client.get(item["download_url"], headers=admin)
    assert download.status_code == 200 and download.content == PNG
    with SessionLocal() as db:
        stored = db.get(FileAsset, uuid.UUID(item["file_id"]))
        assert stored.stored_name != "birth.png" and stored.resource_type == "student_document"


@pytest.mark.parametrize(
    "name,content,status",
    [
        pytest.param("proof.pdf", b"MZ not really a pdf", 415, id="signature-does-not-match-extension"),
        pytest.param("proof.png", PDF, 415, id="pdf-bytes-named-png"),
        pytest.param("proof.txt", b"plain text", 415, id="text-file"),
        pytest.param("proof.exe", b"MZ\x90\x00", 415, id="executable"),
        pytest.param("proof.pdf", b"", 422, id="empty"),
        pytest.param("proof.pdf", "TOO_BIG", 413, id="over-5-mb"),
    ],
)
def test_invalid_uploads_are_refused_and_nothing_is_stored(client, name, content, status):
    if content == "TOO_BIG":
        content = PDF + b"x" * (5 * 1024 * 1024)
    admin = _login(client, ADMIN)
    student_id, _ = _student()
    with SessionLocal() as db:
        before = db.scalar(select(func.count()).select_from(FileAsset))
    refused = _put(client, admin, "students", student_id, "tc", content=content, name=name)
    assert refused.status_code == status, refused.text
    assert client.get(f"/api/v1/documents/students/{student_id}", headers=admin).status_code == 404
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(FileAsset)) == before


def test_unknown_student_unknown_type_and_missing_file_are_refused(client):
    admin = _login(client, ADMIN)
    student_id, _ = _student()
    assert _put(client, admin, "students", str(uuid.uuid4()), "tc").status_code == 404
    assert _put(client, admin, "students", "not-a-uuid", "tc").status_code == 404
    assert _put(client, admin, "students", student_id, "passport").status_code == 422
    assert _put(client, admin, "students", student_id, "tc", content=None).status_code == 422
    assert client.get("/api/v1/documents/classmates", headers=admin).status_code == 404


def test_replacing_a_document_removes_the_old_file_completely(client):
    admin = _login(client, ADMIN)
    student_id, _ = _student()
    old = _put(client, admin, "students", student_id, "tc").json()["items"][0]
    with SessionLocal() as db:
        old_path = _uploads_dir() / db.get(FileAsset, uuid.UUID(old["file_id"])).stored_name
    assert old_path.is_file()

    replaced = _put(client, admin, "students", student_id, "tc", content=JPG, name="tc.jpg").json()
    assert len(replaced["items"]) == 1 and replaced["items"][0]["file_id"] != old["file_id"]
    assert not old_path.exists()
    assert client.get(old["download_url"], headers=admin).status_code == 404
    assert client.get(replaced["items"][0]["download_url"], headers=admin).content == JPG
    assert _audit_count("DOCUMENT_REPLACED") >= 1


def test_a_student_status_cannot_be_set_by_hand(client):
    admin = _login(client, ADMIN)
    student_id, _ = _student()
    _put(client, admin, "students", student_id, "tc")
    refused = client.patch(
        f"/api/v1/documents/students/{student_id}", json={"status": "Completed"}, headers=admin
    )
    assert refused.status_code == 422 and refused.json()["detail"]["code"] == "status_is_automatic"
    ok = client.patch(
        f"/api/v1/documents/students/{student_id}", json={"submitted_date": "2026-09-01"}, headers=admin
    )
    assert ok.status_code == 200 and ok.json()["submitted_date"] == "2026-09-01"


def test_removing_one_document_then_the_folder_deletes_the_files(client):
    admin = _login(client, ADMIN)
    student_id, _ = _student()
    record = _all_four(client, admin, student_id)
    victim, rest = record["items"][0], record["items"][1:]
    removed = client.delete(f"/api/v1/documents/students/{student_id}/items/{victim['id']}", headers=admin)
    assert removed.status_code == 200 and removed.json()["record"]["status"] == "In Progress"
    assert client.get(victim["download_url"], headers=admin).status_code == 404
    assert client.get(rest[0]["download_url"], headers=admin).status_code == 200

    assert client.delete(f"/api/v1/documents/students/{student_id}", headers=admin).status_code == 204
    for item in rest:
        assert client.get(item["download_url"], headers=admin).status_code == 404
    assert client.get(f"/api/v1/documents/students/{student_id}", headers=admin).status_code == 404
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(DocumentRecord).where(DocumentRecord.student_id == uuid.UUID(student_id))) == 0
    assert _audit_count("DOCUMENT_RECORD_REMOVED") >= 1


def test_the_last_document_removed_removes_the_folder(client):
    admin = _login(client, ADMIN)
    student_id, _ = _student()
    only = _put(client, admin, "students", student_id, "tc").json()["items"][0]
    gone = client.delete(f"/api/v1/documents/students/{student_id}/items/{only['id']}", headers=admin)
    assert gone.status_code == 200 and gone.json()["record"] is None
    assert client.get(f"/api/v1/documents/students/{student_id}", headers=admin).status_code == 404


# --- employees ---------------------------------------------------------------------------------


def test_employee_labels_are_free_text_and_unique_ignoring_case_and_spacing(client):
    admin = _login(client, ADMIN)
    code = _employee()
    first = _put(client, admin, "employees", code, "Experience  Letter", status="Approved")
    assert first.status_code == 200, first.text
    again = _put(client, admin, "employees", code, "experience letter", content=PNG, name="exp.png").json()
    assert len(again["items"]) == 1 and again["items"][0]["file_name"] == "exp.png"
    assert again["items"][0]["status"] == "Approved"  # status kept when only the file changes
    _put(client, admin, "employees", code, "PAN Card", status="Pending")
    record = client.get(f"/api/v1/documents/employees/{code}", headers=admin).json()
    # the first spelling (spaces collapsed) is kept as the display label
    assert {item["label"] for item in record["items"]} == {"Experience Letter", "PAN Card"}


def test_employee_status_and_record_status_are_validated(client):
    admin = _login(client, ADMIN)
    code = _employee()
    assert _put(client, admin, "employees", code, "PAN Card", status="Verified").status_code == 422
    assert _put(client, admin, "employees", code, "   ").status_code == 422
    assert _put(client, admin, "employees", code, "x" * 81).status_code == 422
    _put(client, admin, "employees", code, "PAN Card")
    bad = client.patch(f"/api/v1/documents/employees/{code}", json={"status": "Done"}, headers=admin)
    assert bad.status_code == 422
    good = client.patch(f"/api/v1/documents/employees/{code}", json={"status": "Completed"}, headers=admin)
    assert good.status_code == 200 and good.json()["status"] == "Completed"
    assert _put(client, admin, "employees", "NO-SUCH-CODE", "PAN Card").status_code == 404


def test_status_only_change_keeps_the_stored_file(client):
    admin = _login(client, ADMIN)
    code = _employee()
    original = _put(client, admin, "employees", code, "PAN Card").json()["items"][0]
    updated = _put(client, admin, "employees", code, "PAN Card", content=None, status="Approved").json()["items"][0]
    assert updated["status"] == "Approved" and updated["file_id"] == original["file_id"]


# --- who may do what ---------------------------------------------------------------------------


def test_teachers_have_no_access_to_either_kind_of_document(client):
    admin = _login(client, ADMIN)
    teacher = _login(client, TEACHER)
    student_id, _ = _student()
    code = _employee()
    student_item = _put(client, admin, "students", student_id, "aadhaar").json()["items"][0]
    employee_item = _put(client, admin, "employees", code, "PAN Card").json()["items"][0]
    for kind, ref in (("students", student_id), ("employees", code)):
        assert client.get(f"/api/v1/documents/{kind}", headers=teacher).status_code == 403
        assert client.get(f"/api/v1/documents/{kind}/{ref}", headers=teacher).status_code == 403
        assert _put(client, teacher, kind, ref, "aadhaar" if kind == "students" else "PAN Card").status_code == 403
        assert client.delete(f"/api/v1/documents/{kind}/{ref}", headers=teacher).status_code == 403
    # the generic file route follows the folder's rule, with a header or with the ?token= form
    for item in (student_item, employee_item):
        assert client.get(item["download_url"], headers=teacher).status_code == 403
        token = teacher["Authorization"].split(" ", 1)[1]
        assert client.get(f"{item['download_url']}?token={token}").status_code == 403
    assert client.get("/api/v1/documents/students").status_code == 401


def test_hr_manages_employee_documents_but_cannot_touch_student_documents(client):
    admin = _login(client, ADMIN)
    hr = _login(client, HR)
    student_id, _ = _student()
    code = _employee()
    student_item = _put(client, admin, "students", student_id, "aadhaar").json()["items"][0]
    made = _put(client, hr, "employees", code, "Offer Letter", status="Approved")
    assert made.status_code == 200, made.text
    item = made.json()["items"][0]
    assert client.get(item["download_url"], headers=hr).status_code == 200
    assert client.get("/api/v1/documents/employees", headers=hr).status_code == 200
    assert client.get("/api/v1/documents/students", headers=hr).status_code == 403
    assert _put(client, hr, "students", student_id, "tc").status_code == 403
    assert client.get(student_item["download_url"], headers=hr).status_code == 403


def test_orphan_uploads_are_not_campus_wide_readable(client):
    """Generic /files downloads require uploader or elevated staff — closes campus IDOR."""
    hr = _login(client, HR)
    teacher = _login(client, TEACHER)
    uploaded = client.post(
        "/api/v1/files",
        files={"file": ("note.txt", b"plain note", "text/plain")},
        data={"resource_type": "hr_document"},
        headers=hr,
    )
    assert uploaded.status_code == 201, uploaded.text
    assert client.get(uploaded.json()["download_url"], headers=hr).content == b"plain note"
    assert client.get(uploaded.json()["download_url"], headers=teacher).status_code == 403


def test_every_change_is_audited_without_the_file_contents(client):
    admin = _login(client, ADMIN)
    student_id, admission = _student()
    before = _audit_count("DOCUMENT_UPLOADED")
    _put(client, admin, "students", student_id, "aadhaar")
    assert _audit_count("DOCUMENT_UPLOADED") == before + 1
    with SessionLocal() as db:
        entry = db.scalars(
            select(AuditLog).where(AuditLog.action == "DOCUMENT_UPLOADED").order_by(AuditLog.created_at.desc())
        ).first()
        assert admission in (entry.details or "") and "%PDF" not in (entry.details or "")


def test_database_refuses_a_folder_with_two_owners_or_a_duplicate_label(client):
    from sqlalchemy.exc import IntegrityError

    student_id, _ = _student()
    code = _employee()
    with SessionLocal() as db:
        campus = db.scalar(select(Campus))
        employee = db.scalar(select(HrEmployee).where(HrEmployee.employee_code == code))
        db.add(
            DocumentRecord(
                campus_id=campus.id, subject_type="student", student_id=uuid.UUID(student_id), employee_id=employee.id
            )
        )
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
        file_row = FileAsset(campus_id=campus.id, original_name="a.pdf", stored_name="a", size_bytes=1)
        folder = DocumentRecord(campus_id=campus.id, subject_type="employee", employee_id=employee.id)
        db.add_all([file_row, folder])
        db.flush()
        db.add(DocumentItem(record_id=folder.id, doc_key="pan", label="PAN", file_id=file_row.id, status="Pending"))
        db.add(DocumentItem(record_id=folder.id, doc_key="pan", label="Pan", file_id=file_row.id, status="Pending"))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()


def test_uploads_folder_holds_only_server_named_files(client):
    admin = _login(client, ADMIN)
    student_id, _ = _student()
    item = _put(client, admin, "students", student_id, "aadhaar", name="../../evil name.pdf").json()["items"][0]
    with SessionLocal() as db:
        stored = db.get(FileAsset, uuid.UUID(item["file_id"])).stored_name
    assert "/" not in stored and "\\" not in stored and ".." not in stored.replace("_..", "")
    assert (_uploads_dir() / stored).resolve().parent == Path(_uploads_dir()).resolve()
