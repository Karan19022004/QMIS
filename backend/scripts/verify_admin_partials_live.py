"""Live API check for the Administrator modules still marked Partial.

Uses seed logins from settings. Prints PASS/FAIL lines only — no passwords.
"""

from __future__ import annotations

import sys
from datetime import date, timedelta

import httpx
from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal
from app.models import Student, User

BASE = "http://127.0.0.1:8000/api/v1"
ADMIN = (settings.admin_seed_email, settings.admin_seed_password)
TEACHER = (settings.teacher_seed_email, settings.teacher_seed_password)


def login(client: httpx.Client, who: tuple[str, str]) -> dict:
    r = client.post(f"{BASE}/auth/login", json={"email": who[0], "password": who[1]})
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def main() -> int:
    failed = 0
    with httpx.Client(timeout=30.0) as client:
        admin = login(client, ADMIN)
        teacher = login(client, TEACHER)

        # Activities: create one of each type + chess players + approve sports
        for activity_type, name in (
            ("cultural", "Annual Day rehearsal (verify)"),
            ("sports", "House football (verify)"),
            ("competition", "Science quiz (verify)"),
        ):
            made = client.post(
                f"{BASE}/activities",
                headers=admin,
                json={
                    "type": activity_type,
                    "eventName": name,
                    "eventType": activity_type.title(),
                    "eventDate": (date.today() + timedelta(days=3)).isoformat(),
                    "venue": "Main hall",
                    "coordinator": "Admin",
                },
            )
            ok = made.status_code == 201
            print(("PASS" if ok else "FAIL"), f"activities create {activity_type}", made.status_code)
            failed += 0 if ok else 1
            if ok and activity_type == "sports":
                ref = made.json()["id"]
                chess = client.post(
                    f"{BASE}/activities",
                    headers=admin,
                    json={
                        "type": "sports",
                        "eventName": "Inter-house Chess (verify)",
                        "eventType": "Chess Tournament",
                        "eventDate": (date.today() + timedelta(days=5)).isoformat(),
                        "venue": "Hall B",
                        "coach": "Coach",
                        "players": [
                            {"name": "Asha", "rank": 1, "result": "Winner", "category": "Open", "className": "5-A"}
                        ],
                    },
                )
                ok_chess = chess.status_code == 201 and chess.json().get("players")
                print(("PASS" if ok_chess else "FAIL"), "activities chess with players", chess.status_code)
                failed += 0 if ok_chess else 1
                if ok_chess:
                    chess_ref = chess.json()["id"]
                    # who can approve?
                    approved = client.post(
                        f"{BASE}/activities/{chess_ref}/approval",
                        headers=admin,
                        json={"status": "Approved"},
                    )
                    print(
                        ("PASS" if approved.status_code == 200 else "FAIL"),
                        "activities approve",
                        approved.status_code,
                        approved.text[:120],
                    )
                    failed += 0 if approved.status_code == 200 else 1

            denied = client.post(
                f"{BASE}/activities",
                headers=teacher,
                json={
                    "type": activity_type,
                    "eventName": "Teacher should not create",
                    "eventDate": date.today().isoformat(),
                },
            )
            print(("PASS" if denied.status_code == 403 else "FAIL"), f"teacher denied {activity_type}", denied.status_code)
            failed += 0 if denied.status_code == 403 else 1

        listed = client.get(f"{BASE}/activities", headers=admin)
        print(("PASS" if listed.status_code == 200 and len(listed.json()) >= 3 else "FAIL"), "activities list", listed.status_code, "count", len(listed.json()) if listed.status_code == 200 else 0)
        failed += 0 if listed.status_code == 200 else 1

        # TC lifecycle against a real student
        with SessionLocal() as db:
            student = db.scalar(select(Student).order_by(Student.created_at.desc()).limit(1))
            if student is None:
                print("FAIL no student in database for TC")
                return 1
            admission = student.admission_number

        created = client.post(
            f"{BASE}/tc-requests",
            headers=admin,
            json={
                "studentRef": admission,
                "reason": "Family relocation (verify).",
                "transferTo": "Demo School",
                "lastDateOfAttendance": date.today().isoformat(),
            },
        )
        if created.status_code == 409:
            # close any open by listing and rejecting after forward, or pick another student
            rows = client.get(f"{BASE}/tc-requests", headers=admin).json()
            open_rows = [r for r in rows if r["status"] in ("Pending PRM Review", "Pending Super Admin Approval") and r["admissionNumber"] == admission]
            for row in open_rows:
                if row["status"] == "Pending PRM Review":
                    client.post(f"{BASE}/tc-requests/{row['id']}/forward", headers=admin, json={"remarks": "clear for retest"})
                client.post(
                    f"{BASE}/tc-requests/{row['id']}/decide",
                    headers=admin,
                    json={"decision": "reject", "remarks": "Closing prior open request for verify rerun."},
                )
            created = client.post(
                f"{BASE}/tc-requests",
                headers=admin,
                json={
                    "studentRef": admission,
                    "reason": "Family relocation (verify).",
                    "transferTo": "Demo School",
                    "lastDateOfAttendance": date.today().isoformat(),
                },
            )
        ok = created.status_code == 201
        print(("PASS" if ok else "FAIL"), "tc create", created.status_code, created.text[:160])
        failed += 0 if ok else 1
        if ok:
            ref = created.json()["id"]
            forwarded = client.post(f"{BASE}/tc-requests/{ref}/forward", headers=admin, json={"remarks": "Dues cleared."})
            print(("PASS" if forwarded.status_code == 200 else "FAIL"), "tc forward", forwarded.status_code)
            failed += 0 if forwarded.status_code == 200 else 1
            approved = client.post(
                f"{BASE}/tc-requests/{ref}/decide",
                headers=admin,
                json={"decision": "approve", "remarks": "Issue TC."},
            )
            print(("PASS" if approved.status_code == 200 and approved.json()["status"] == "Approved" else "FAIL"), "tc approve", approved.status_code)
            failed += 0 if approved.status_code == 200 else 1
            shown = client.get(f"{BASE}/tc-requests", headers=admin)
            print(("PASS" if any(r["id"] == ref for r in shown.json()) else "FAIL"), "tc list includes approved")
            failed += 0 if any(r["id"] == ref for r in shown.json()) else 1

        # Communication: directory + start + send
        directory = client.get(f"{BASE}/communication/directory", headers=admin)
        print(("PASS" if directory.status_code == 200 and directory.json() else "FAIL"), "communication directory", directory.status_code)
        failed += 0 if directory.status_code == 200 and directory.json() else 1
        peer = next((u for u in directory.json() if u.get("email") == TEACHER[0]), None)
        if peer is None and directory.status_code == 200:
            peer = next((u for u in directory.json() if u.get("id")), None)
        if peer:
            started = client.post(
                f"{BASE}/communication/conversations",
                headers=admin,
                json={"userId": peer["id"]},
            )
            print(("PASS" if started.status_code == 201 else "FAIL"), "communication start", started.status_code, started.text[:200])
            failed += 0 if started.status_code == 201 else 1
            if started.status_code == 201:
                conv_id = started.json()["id"]
                sent = client.post(
                    f"{BASE}/communication/conversations/{conv_id}/messages",
                    headers=admin,
                    data={"body": "Verify message from Admin."},
                )
                print(("PASS" if sent.status_code == 201 else "FAIL"), "communication send", sent.status_code, sent.text[:160])
                failed += 0 if sent.status_code == 201 else 1
                inbox = client.get(f"{BASE}/communication/conversations", headers=admin)
                print(("PASS" if inbox.status_code == 200 and inbox.json() else "FAIL"), "communication inbox", inbox.status_code)
                failed += 0 if inbox.status_code == 200 and inbox.json() else 1
        else:
            print("FAIL communication no directory peer")
            failed += 1

        # Roles read-only
        roles = client.get(f"{BASE}/admin/roles", headers=admin)
        print(("PASS" if roles.status_code == 200 and roles.json() else "FAIL"), "roles list", roles.status_code)
        failed += 0 if roles.status_code == 200 else 1

    print("RESULT", "PASS" if failed == 0 else f"FAIL ({failed})")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
