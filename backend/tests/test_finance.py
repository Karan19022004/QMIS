import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-finance-ok"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


def _login(client: TestClient, email: str, password: str) -> dict:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_accounthead_can_save_finance_state(client):
    headers = _login(client, "accounthead@qmis.edu", "accounts123")
    # Suite shares one in-memory DB — clear any prior E2E/finance seed first.
    reset = client.post("/api/v1/finance/state/reset", headers=headers)
    assert reset.status_code == 200, reset.text
    empty = client.get("/api/v1/finance/state", headers=headers)
    assert empty.status_code == 200, empty.text
    assert empty.json()["seeded"] is False

    payload = {
        "data": {
            "feeCategories": [{"id": "CAT-TUITION", "name": "Tuition Fee", "code": "TUITION", "active": True}],
            "feeStructures": [],
            "fineRules": [],
            "bankAccounts": [{"id": "BANK-1", "name": "SBI", "enabled": True}],
            "posTerminals": [],
            "concessions": [],
            "installments": [
                {
                    "id": "INST-1",
                    "studentId": "STU-1",
                    "feeAmount": 1000,
                    "paidAmount": 0,
                    "balanceAmount": 1000,
                    "status": "UNPAID",
                }
            ],
            "annualBudget": [],
            "transactions": [
                {
                    "id": "TXN-1",
                    "transactionNo": "TXN-0001",
                    "direction": "IN",
                    "amount": 500,
                    "status": "POSTED",
                    "sourceModule": "FEES",
                }
            ],
            "receipts": [{"id": "RCP-1", "receiptNo": "REC-0001", "amountPaid": 500}],
            "cheques": [],
            "paymentLinks": [],
            "auditLog": [],
            "glEntries": [],
            "dayBookEntries": [],
            "cashBookEntries": [],
            "bankBookEntries": [],
            "onlineBookEntries": [],
            "reconciliationItems": [],
            "students": [{"id": "STU-1", "name": "Test Student", "admissionNo": "ADM-1", "className": "Grade 1"}],
            "sequence": {"pay": 2, "rec": 2, "txn": 2, "voucher": 1, "link": 1},
            "meta": {"seeded": True},
        }
    }
    saved = client.put("/api/v1/finance/state", json=payload, headers=headers)
    assert saved.status_code == 200, saved.text
    body = saved.json()
    assert body["seeded"] is True
    assert body["data"]["receipts"][0]["receiptNo"] == "REC-0001"
    assert body["savedAt"]

    again = client.get("/api/v1/finance/state", headers=headers)
    assert again.status_code == 200
    assert again.json()["data"]["transactions"][0]["amount"] == 500

    receipts = client.get("/api/v1/finance/receipts", headers=headers)
    assert receipts.status_code == 200
    assert receipts.json()[0]["id"] == "RCP-1"


def test_hr_cannot_write_finance(client):
    headers = _login(client, "hr@qmis.edu", "hr12345")
    denied = client.put(
        "/api/v1/finance/state",
        json={"data": {"feeCategories": [], "meta": {"seeded": True}}},
        headers=headers,
    )
    assert denied.status_code == 403


def test_parent_fees_are_scoped_and_full_ledger_is_denied(client):
    admin = _login(client, "admin@qmis.edu", "admin123")
    enquiry = client.post(
        "/api/v1/admissions/enquiries",
        json={
            "name": "Fee Child",
            "mobile_number": "9000000001",
            "class_name": "Grade 1",
            "email": "parent.fees@example.com",
            "source": "Walk-in",
            "city": "Madurai",
        },
        headers=admin,
    )
    assert enquiry.status_code == 201, enquiry.text
    converted = client.post(
        f"/api/v1/admissions/enquiries/{enquiry.json()['id']}/convert",
        headers=admin,
    )
    assert converted.status_code == 200, converted.text
    admission_id = converted.json()["id"]
    enrolled = client.post(
        f"/api/v1/admissions/{admission_id}/enroll",
        json={
            "parent_account_email": "parent.fees@example.com",
            "parent_account_password": "Parent-Test-2026",
        },
        headers=admin,
    )
    assert enrolled.status_code == 200, enrolled.text
    student_code = enrolled.json()["student_code"]

    login = client.post(
        "/api/v1/auth/login",
        json={"email": "parent.fees@example.com", "password": "Parent-Test-2026"},
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    changed = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "Parent-Test-2026", "new_password": "Parent-Test-2027"},
    )
    assert changed.status_code == 200, changed.text
    parent = _login(client, "parent.fees@example.com", "Parent-Test-2027")

    denied = client.get("/api/v1/finance/state", headers=parent)
    assert denied.status_code == 403, denied.text

    mine = client.get("/api/v1/finance/my-fees", headers=parent)
    assert mine.status_code == 200, mine.text
    body = mine.json()["data"]
    assert body["meta"]["scopedFor"] == "parent"
    assert len(body["students"]) == 1
    assert body["students"][0]["admissionNo"] == student_code

    transport = client.get("/api/v1/ops/my-transport", headers=parent)
    assert transport.status_code == 200, transport.text
    assert transport.json()["assignments"] == []

    teacher = _login(client, "teacher@qmis.edu", "teacher123")
    assert client.get("/api/v1/finance/my-fees", headers=teacher).status_code == 403
    assert client.get("/api/v1/ops/my-transport", headers=teacher).status_code == 403


def test_parent_payment_is_confirmed_by_the_ledger(client):
    admin = _login(client, "admin@qmis.edu", "admin123")
    enquiry = client.post(
        "/api/v1/admissions/enquiries",
        json={
            "name": "Pay Child",
            "mobile_number": "9000000002",
            "class_name": "Grade 2",
            "email": "parent.pay@example.com",
            "source": "Walk-in",
            "city": "Madurai",
        },
        headers=admin,
    )
    assert enquiry.status_code == 201, enquiry.text
    converted = client.post(
        f"/api/v1/admissions/enquiries/{enquiry.json()['id']}/convert",
        headers=admin,
    )
    assert converted.status_code == 200, converted.text
    enrolled = client.post(
        f"/api/v1/admissions/{converted.json()['id']}/enroll",
        json={
            "parent_account_email": "parent.pay@example.com",
            "parent_account_password": "Parent-Test-2026",
        },
        headers=admin,
    )
    assert enrolled.status_code == 200, enrolled.text
    first = client.post(
        "/api/v1/auth/login",
        json={"email": "parent.pay@example.com", "password": "Parent-Test-2026"},
    )
    token = first.json()["access_token"]
    changed = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "Parent-Test-2026", "new_password": "Parent-Test-2027"},
    )
    assert changed.status_code == 200, changed.text
    parent = _login(client, "parent.pay@example.com", "Parent-Test-2027")
    child = client.get("/api/v1/parents/me/children", headers=parent).json()[0]
    account = _login(client, "accounthead@qmis.edu", "accounts123")
    saved = client.put(
        "/api/v1/finance/state",
        headers=account,
        json={
            "data": {
                "students": [{"id": child["id"], "name": child["name"], "admissionNo": child["admissionNumber"]}],
                "installments": [{
                    "id": "INST-PAY-1",
                    "studentId": child["id"],
                    "feeHead": "Tuition",
                    "installmentLabel": "Term 1",
                    "feeAmount": 1000,
                    "concessionAmount": 0,
                    "fineAmount": 0,
                    "netAmount": 1000,
                    "paidAmount": 0,
                    "balanceAmount": 1000,
                    "status": "UNPAID",
                }],
                "receipts": [],
                "transactions": [],
                "meta": {"seeded": True},
            }
        },
    )
    assert saved.status_code == 200, saved.text
    paid = client.post(
        "/api/v1/finance/actions/pay-my-fees",
        headers=parent,
        json={
            "studentId": child["id"],
            "paymentMode": "UPI",
            "allocations": [{"installmentId": "INST-PAY-1", "amount": 1000}],
        },
    )
    assert paid.status_code == 200, paid.text
    assert paid.json()["receipt"]["receiptNo"]
    again = client.get("/api/v1/finance/my-fees", headers=parent)
    installment = again.json()["data"]["installments"][0]
    assert float(installment["paidAmount"]) == 1000
    assert installment["status"] == "PAID"


def test_finance_reset(client):
    headers = _login(client, "admin@qmis.edu", "admin123")
    client.put(
        "/api/v1/finance/state",
        json={"data": {"feeCategories": [{"id": "X"}], "meta": {"seeded": True}}},
        headers=headers,
    )
    reset = client.post("/api/v1/finance/state/reset", headers=headers)
    assert reset.status_code == 200
    assert reset.json()["seeded"] is False
