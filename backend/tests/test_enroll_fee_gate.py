"""Backend enrolment requires Waived/zero fee or a verified Finance admission receipt."""

import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-enroll-fee"
os.environ["ENVIRONMENT"] = "development"

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.database import SessionLocal
from app.main import app
from app.models import Admission, FinanceRecord, User
from sqlalchemy import select
from tests.conftest import reset_sqlite_memory_schema

ADMIN = (settings.admin_seed_email, settings.admin_seed_password)


@pytest.fixture()
def client():
    reset_sqlite_memory_schema()
    with TestClient(app) as test_client:
        yield test_client


def _login(client):
    from auth_test_helpers import login_headers

    return login_headers(client, *ADMIN)


def _create_admission(client, headers, *, tag: str, fees_group: str, registration_fees: str = "5000"):
    created = client.post(
        "/api/v1/admissions",
        headers=headers,
        json={
            "first_name": f"Fee{tag}",
            "last_name": "Gate",
            "mobile_number": "9000099999",
            "class_name": "Grade 5",
            "father_name": "Parent Fee",
            "parent_account_email": f"parent.fee.{tag.lower()}@example.com",
            "registration_fees": registration_fees,
            "fees_group": fees_group,
        },
    )
    assert created.status_code in (200, 201), created.text
    return created.json()


def _put_admission_receipt(*, admission_code: str, student_name: str, amount: float = 5000, status: str = "Issued"):
    with SessionLocal() as db:
        admin = db.scalar(select(User).where(User.email == ADMIN[0]))
        assert admin is not None
        body = {
            "receipts": [
                {
                    "id": "RCP-TEST-1",
                    "receiptNo": "REC-TEST-1",
                    "studentId": admission_code,
                    "admissionNo": admission_code,
                    "studentName": student_name,
                    "feeHeads": ["Admission Fee"],
                    "amountPaid": amount,
                    "status": status,
                    "paymentMode": "CASH",
                }
            ],
            "students": [],
            "transactions": [],
        }
        row = db.scalar(
            select(FinanceRecord).where(
                FinanceRecord.campus_id == admin.campus_id,
                FinanceRecord.collection == "snapshot",
                FinanceRecord.public_id == "current",
            )
        )
        if row is None:
            db.add(
                FinanceRecord(
                    campus_id=admin.campus_id,
                    collection="snapshot",
                    public_id="current",
                    body=body,
                )
            )
        else:
            row.body = body
        db.commit()


def test_enroll_blocked_when_fee_pending(client):
    headers = _login(client)
    created = _create_admission(client, headers, tag="Pend", fees_group="Tuition, RegFeeStatus:Pending")
    blocked = client.post(
        f"/api/v1/admissions/{created['id']}/enroll",
        headers=headers,
        json={
            "parent_account_email": "parent.fee.pend@example.com",
            "parent_account_password": "Parent-Test-2026",
        },
    )
    assert blocked.status_code == 409, blocked.text
    assert blocked.json()["detail"]["code"] == "fee_pending"


def test_enroll_blocked_when_paid_token_without_receipt(client):
    """Frontend Paid token alone is not trusted."""
    headers = _login(client)
    created = _create_admission(client, headers, tag="Tokn", fees_group="RegFeeStatus:Paid")
    blocked = client.post(
        f"/api/v1/admissions/{created['id']}/enroll",
        headers=headers,
        json={
            "parent_account_email": "parent.fee.tokn@example.com",
            "parent_account_password": "Parent-Test-2026",
        },
    )
    assert blocked.status_code == 409, blocked.text
    assert blocked.json()["detail"]["code"] == "fee_pending"


def test_enroll_blocked_when_receipt_held_or_mismatched(client):
    headers = _login(client)
    created = _create_admission(client, headers, tag="Held", fees_group="")
    with SessionLocal() as db:
        admission = db.get(Admission, created["id"]) if False else None
    # Prefer code from response
    code = created.get("admission_code") or created.get("admissionCode")
    if not code:
        with SessionLocal() as db:
            from uuid import UUID
            admission = db.get(Admission, UUID(str(created["id"])))
            code = admission.admission_code
    _put_admission_receipt(admission_code=code, student_name="FeeHeld Gate", status="Held")
    blocked = client.post(
        f"/api/v1/admissions/{created['id']}/enroll",
        headers=headers,
        json={
            "parent_account_email": "parent.fee.held@example.com",
            "parent_account_password": "Parent-Test-2026",
        },
    )
    assert blocked.status_code == 409, blocked.text

    _put_admission_receipt(admission_code="OTHER-ADM", student_name="Someone Else", status="Issued")
    blocked2 = client.post(
        f"/api/v1/admissions/{created['id']}/enroll",
        headers=headers,
        json={
            "parent_account_email": "parent.fee.held@example.com",
            "parent_account_password": "Parent-Test-2026",
        },
    )
    assert blocked2.status_code == 409, blocked2.text


def test_enroll_allowed_when_verified_receipt_matches(client):
    headers = _login(client)
    created = _create_admission(client, headers, tag="Paid", fees_group="")
    with SessionLocal() as db:
        from uuid import UUID
        admission = db.get(Admission, UUID(str(created["id"])))
        code = admission.admission_code
        name = f"{admission.first_name} {admission.last_name}".strip()
    _put_admission_receipt(admission_code=code, student_name=name, status="Issued")
    ok = client.post(
        f"/api/v1/admissions/{created['id']}/enroll",
        headers=headers,
        json={
            "parent_account_email": "parent.fee.paid@example.com",
            "parent_account_password": "Parent-Test-2026",
        },
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["admission"]["status"] == "Enrolled"


def test_enroll_allowed_when_fee_waived(client):
    headers = _login(client)
    created = _create_admission(client, headers, tag="Waiv", fees_group="RegFeeStatus:Waived")
    ok = client.post(
        f"/api/v1/admissions/{created['id']}/enroll",
        headers=headers,
        json={
            "parent_account_email": "parent.fee.waiv@example.com",
            "parent_account_password": "Parent-Test-2026",
        },
    )
    assert ok.status_code == 200, ok.text


def test_enroll_allowed_when_registration_fee_zero(client):
    headers = _login(client)
    created = _create_admission(
        client,
        headers,
        tag="Zero",
        fees_group="Tuition",
        registration_fees="0",
    )
    ok = client.post(
        f"/api/v1/admissions/{created['id']}/enroll",
        headers=headers,
        json={
            "parent_account_email": "parent.fee.zero@example.com",
            "parent_account_password": "Parent-Test-2026",
        },
    )
    assert ok.status_code == 200, ok.text
