"""Live PRM Front Office regression against the configured DATABASE_URL.

Creates only marker-tagged records and deletes those same ids at the end.
Does not delete pre-existing rows. Safe for local/dev databases.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import httpx
from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.config import settings  # noqa: E402

BASE = "http://127.0.0.1:8000"
MARKER = f"PRM-REG-{int(time.time())}"
COLLECTIONS = [
    "student-gate-passes",
    "hostel-gate-passes",
    "material-gate-passes",
    "goods-received-passes",
    "student-transfers",
    "student-re-enrollments",
]

PAYLOADS = {
    "student-gate-passes": {
        "studentId": "REG-STU",
        "studentName": "Regression Student",
        "classSection": "1-A",
        "reason": "Medical",
        "date": "15-10-2026",
        "outTime": "14:00",
        "status": "Pending",
        "regressionMarker": MARKER,
    },
    "hostel-gate-passes": {
        "studentId": "REG-HST",
        "studentName": "Regression Hostel",
        "classSection": "8-A",
        "hostel": "QMIS Hostel",
        "leaveType": "Home Visit",
        "reason": "Family",
        "outDate": "15-10-2026",
        "outTime": "16:00",
        "returnDate": "16-10-2026",
        "returnTime": "18:00",
        "status": "Pending",
        "regressionMarker": MARKER,
    },
    "material-gate-passes": {
        "passType": "Non-Returnable",
        "date": "15-10-2026",
        "time": "10:00",
        "timePeriod": "AM",
        "driverName": "RegDriver",
        "vehicleNo": "TN-REG-0001",
        "materials": [{"id": "row-1", "description": "Boxes", "quantity": 2, "destination": "Store", "remarks": ""}],
        "status": "Pending",
        "regressionMarker": MARKER,
    },
    "goods-received-passes": {
        "paymentType": "CASH",
        "date": "15-10-2026",
        "time": "11:00",
        "timePeriod": "AM",
        "supplierName": "Reg Supplier",
        "billNo": "REG-BILL-1",
        "billDate": "15-10-2026",
        "materials": [{"id": "row-1", "description": "Paper", "quantity": 5, "remarks": ""}],
        "status": "Pending",
        "regressionMarker": MARKER,
    },
    "student-transfers": {
        "studentName": "Reg Transfer Student",
        "transferType": "Outward",
        "transferTo": "Another School",
        "className": "Grade 5",
        "reason": "Relocation",
        "requestedOn": "15-10-2026",
        "mdApprovalStatus": "Pending",
        "status": "In Progress",
        "regressionMarker": MARKER,
    },
    "student-re-enrollments": {
        "studentName": "Reg ReEnroll Student",
        "previousAdmissionNo": "ADM-REG-1",
        "className": "Grade 3",
        "reason": "Returned TC",
        "requestedOn": "15-10-2026",
        "status": "Pending",
        "regressionMarker": MARKER,
    },
}


def login(email: str, password: str) -> dict:
    r = httpx.post(f"{BASE}/api/v1/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def main() -> int:
    results: dict = {"marker": MARKER, "collections": {}, "rbac": {}, "admissions": {}, "db": {}}
    created: list[tuple[str, str]] = []
    admin = login(settings.admin_seed_email, settings.admin_seed_password)
    teacher = login(settings.teacher_seed_email, settings.teacher_seed_password)
    principal = login(settings.principal_seed_email, settings.principal_seed_password)
    prm_headers = None
    try:
        prm_headers = login(settings.prm_seed_email, settings.prm_seed_password)
        results["prm_seed"] = {"login": 200, "email_configured": True}
    except AssertionError as exc:
        results["prm_seed"] = {"login": "FAIL", "error": str(exc)[:200], "email_configured": True}

    # Unauthenticated
    results["rbac"]["unauth_list"] = httpx.get(f"{BASE}/api/v1/front-office/student-gate-passes", timeout=30).status_code

    # Teacher forbidden
    results["rbac"]["teacher_list"] = httpx.get(
        f"{BASE}/api/v1/front-office/student-gate-passes", headers=teacher, timeout=30
    ).status_code
    results["rbac"]["teacher_create"] = httpx.post(
        f"{BASE}/api/v1/front-office/student-gate-passes",
        headers=teacher,
        json=PAYLOADS["student-gate-passes"],
        timeout=30,
    ).status_code

    # Principal read allowed / write denied by role policy
    results["rbac"]["principal_list"] = httpx.get(
        f"{BASE}/api/v1/front-office/student-gate-passes", headers=principal, timeout=30
    ).status_code
    results["rbac"]["principal_create"] = httpx.post(
        f"{BASE}/api/v1/front-office/student-gate-passes",
        headers=principal,
        json=PAYLOADS["student-gate-passes"],
        timeout=30,
    ).status_code
    if prm_headers:
        prm_create = httpx.post(
            f"{BASE}/api/v1/front-office/student-gate-passes",
            headers=prm_headers,
            json={**PAYLOADS["student-gate-passes"], "studentName": "PRM Writer Student"},
            timeout=30,
        )
        results["rbac"]["prm_create"] = prm_create.status_code
        if prm_create.status_code in (200, 201):
            pid = prm_create.json()["id"]
            httpx.delete(f"{BASE}/api/v1/front-office/student-gate-passes/{pid}", headers=prm_headers, timeout=30)

    for collection in COLLECTIONS:
        entry: dict = {}
        payload = dict(PAYLOADS[collection])
        create = httpx.post(f"{BASE}/api/v1/front-office/{collection}", headers=admin, json=payload, timeout=30)
        entry["create"] = create.status_code
        if create.status_code not in (200, 201):
            entry["create_body"] = create.text[:200]
            results["collections"][collection] = entry
            continue
        body = create.json()
        public_id = body["id"]
        created.append((collection, public_id))
        entry["id"] = public_id

        listed = httpx.get(f"{BASE}/api/v1/front-office/{collection}", headers=admin, timeout=30)
        entry["list"] = listed.status_code
        entry["list_contains"] = any(row.get("id") == public_id for row in (listed.json() if listed.status_code == 200 else []))

        got = httpx.get(f"{BASE}/api/v1/front-office/{collection}/{public_id}", headers=admin, timeout=30)
        entry["get"] = got.status_code
        entry["get_marker"] = (got.json().get("regressionMarker") == MARKER) if got.status_code == 200 else False

        updated_payload = {**(got.json() if got.status_code == 200 else body), "status": "Updated-By-Regression", "regressionMarker": MARKER}
        put = httpx.put(
            f"{BASE}/api/v1/front-office/{collection}/{public_id}",
            headers=admin,
            json=updated_payload,
            timeout=30,
        )
        entry["update"] = put.status_code
        entry["update_status"] = put.json().get("status") if put.status_code == 200 else None

        # Invalid / missing
        missing = httpx.get(f"{BASE}/api/v1/front-office/{collection}/DOES-NOT-EXIST-{MARKER}", headers=admin, timeout=30)
        entry["get_missing"] = missing.status_code
        bad = httpx.post(f"{BASE}/api/v1/front-office/{collection}", headers=admin, content=b"not-json", timeout=30)
        entry["create_invalid_content_type"] = bad.status_code

        # DB persistence check
        engine = create_engine(settings.database_url)
        with engine.connect() as conn:
            row = conn.execute(
                text(
                    "SELECT public_id, collection, body->>'regressionMarker' AS marker, body->>'status' AS status "
                    "FROM front_office_records WHERE public_id = :pid AND collection = :col"
                ),
                {"pid": public_id, "col": collection},
            ).mappings().first()
        entry["db_row"] = dict(row) if row else None

        # Delete only our regression row
        deleted = httpx.delete(
            f"{BASE}/api/v1/front-office/{collection}/{public_id}", headers=admin, timeout=30
        )
        entry["delete"] = deleted.status_code
        after = httpx.get(f"{BASE}/api/v1/front-office/{collection}/{public_id}", headers=admin, timeout=30)
        entry["get_after_delete"] = after.status_code
        if deleted.status_code == 204:
            created = [(c, i) for c, i in created if not (c == collection and i == public_id)]

        results["collections"][collection] = entry

    # Shared admissions still live
    adm = httpx.get(f"{BASE}/api/v1/admissions", headers=admin, timeout=30)
    enq = httpx.get(f"{BASE}/api/v1/admissions/enquiries", headers=admin, timeout=30)
    if enq.status_code == 404:
        enq = httpx.get(f"{BASE}/api/v1/admissions?kind=enquiry", headers=admin, timeout=30)
    results["admissions"]["list"] = adm.status_code
    results["admissions"]["enquiries_probe"] = enq.status_code

    # Unknown collection
    results["rbac"]["unknown_collection"] = httpx.get(
        f"{BASE}/api/v1/front-office/not-a-real-collection", headers=admin, timeout=30
    ).status_code

    # Cleanup any leftovers
    for collection, public_id in list(created):
        httpx.delete(f"{BASE}/api/v1/front-office/{collection}/{public_id}", headers=admin, timeout=30)

    print(json.dumps(results, indent=2, default=str))
    # Exit non-zero if any collection CRUD failed
    bad_cols = []
    for name, entry in results["collections"].items():
        needed = [
            entry.get("create") in (200, 201),
            entry.get("list") == 200 and entry.get("list_contains"),
            entry.get("get") == 200 and entry.get("get_marker"),
            entry.get("update") == 200,
            entry.get("delete") == 204,
            entry.get("get_after_delete") == 404,
            entry.get("get_missing") == 404,
            entry.get("db_row") is not None,
        ]
        if not all(needed):
            bad_cols.append(name)
    rbac_ok = (
        results["rbac"]["unauth_list"] == 401
        and results["rbac"]["teacher_list"] == 403
        and results["rbac"]["teacher_create"] == 403
        and results["rbac"]["principal_list"] == 200
        and results["rbac"]["principal_create"] == 403
        and results["rbac"]["unknown_collection"] == 404
        and results["rbac"].get("prm_create") in (200, 201, None)
        and results.get("prm_seed", {}).get("login") == 200
    )
    if bad_cols or not rbac_ok or results["admissions"]["list"] != 200:
        print("SUMMARY FAIL", {"bad_cols": bad_cols, "rbac_ok": rbac_ok}, file=sys.stderr)
        return 1
    print("SUMMARY PASS", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
