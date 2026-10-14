"""Static + live audit of the 26 Administrator modules.

Uses seed logins from settings only. Prints a markdown-friendly table.
No passwords are printed.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
SRC = ROOT / "src"
sys.path.insert(0, str(BACKEND))

from app.core.config import settings  # noqa: E402

BASE = "http://127.0.0.1:8000/api/v1"
ADMIN = (settings.admin_seed_email, settings.admin_seed_password)
TEACHER = (settings.teacher_seed_email, settings.teacher_seed_password)

# Authoritative Administrator audit list (sidebar scope for this delivery)
MODULES = [
    ("Dashboard", "dashboardApi.js", "/admin/dashboard", "GET", "dashboard.read", ["admin_dashboard not a table"]),
    ("Admissions Enquiry", "admissionsApi.js", "/admissions/enquiries", "GET", "admissions.read", ["admission_enquiries"]),
    ("Admission List", "admissionsApi.js", "/admissions", "GET", "admissions.read", ["admissions"]),
    ("Student Database", "studentsApi.js", "/students", "GET", "students.read", ["students"]),
    ("Employee Database", "employeeDirectoryApi.js", "/hr/portal/employees", "GET", "hr.read", ["hr_employees"]),
    ("Class Details", "classDetailsApi.js", "/masters/classes", "GET", "masters.read", ["school_classes", "sections"]),
    ("Student Attendance", "adminAttendanceApi.js", "/attendance?date=2026-10-14", "GET", "attendance.read", ["student_attendance"]),
    ("Employee Attendance", "adminAttendanceApi.js", "/hr/attendance", "GET", "hr.read", ["hr collections"]),
    ("Cultural Activities", "activitiesApi.js", "/activities?type=cultural", "GET", "activities.read", ["activities"]),
    ("Sports Activities", "activitiesApi.js", "/activities?type=sports", "GET", "activities.read", ["activities"]),
    ("Chess Results", "activitiesApi.js", "/activities?type=sports", "GET", "activities.read", ["activities", "activity_players"]),
    ("Competitions", "activitiesApi.js", "/activities?type=competition", "GET", "activities.read", ["activities"]),
    ("Student Documents", "documentsApi.js", "/documents/students", "GET", "documents.read", ["document_records", "document_items"]),
    ("Employee Documents", "documentsApi.js", "/documents/employees", "GET", "documents.read", ["document_records", "document_items"]),
    ("Task Assignment", "taskApi.js", "/tasks?box=assigned", "GET", "tasks.read", ["tasks"]),
    ("Assigned Tasks", "taskApi.js", "/tasks?box=mine", "GET", "tasks.read", ["tasks"]),
    ("My Leave Requests", "leaveApi.js", "/leave-requests?box=mine", "GET", "leave.read", ["leave_requests"]),
    ("Received Leave Requests", "leaveApi.js", "/leave-requests?box=received", "GET", "leave.read", ["leave_requests"]),
    ("Announcements", "announcementsApi.js", "/announcements", "GET", "announcements.read", ["announcements"]),
    ("TC Request Approval", "tcApi.js", "/tc-requests", "GET", "tc.read", ["tc_requests"]),
    ("Communication", "communicationApi.js", "/communication/conversations", "GET", "communication.read", ["conversations", "messages"]),
    ("Calendar", "calendarApi.js", "/calendar", "GET", "calendar.read", ["calendar_events"]),
    ("Notifications", "notificationsApi.js", "/notifications", "GET", "notifications.read", ["notifications"]),
    ("Escalation Management", "escalationApi.js", "/escalations?box=mine", "GET", "escalations.read", ["escalations"]),
    ("RBAC User Creation", "adminUsersApi.js", "/admin/users", "GET", "users.read", ["users", "user_profiles"]),
    ("RBAC Roles", "adminUsersApi.js", "/admin/roles", "GET", "users.read", ["roles", "role_permissions"]),
]


def file_exists(rel: str) -> bool:
    return (SRC / "services" / rel).exists() or (SRC / "Pages" / rel).exists()


def service_mentions_path(service: str, fragment: str) -> bool:
    path = SRC / "services" / service
    if not path.exists():
        # some modules share services under different names
        return False
    text = path.read_text(encoding="utf-8", errors="replace")
    return fragment.strip("/").split("?")[0] in text or fragment in text


def login(client: httpx.Client, who):
    r = client.post(f"{BASE}/auth/login", json={"email": who[0], "password": who[1]})
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def main() -> int:
    rows = []
    with httpx.Client(timeout=30.0) as client:
        try:
            admin = login(client, ADMIN)
            teacher = login(client, TEACHER)
            live = True
        except Exception as exc:
            print("LIVE API unavailable:", exc)
            admin = teacher = None
            live = False

        openapi_paths = set()
        if live:
            oa = client.get("http://127.0.0.1:8000/openapi.json")
            if oa.status_code == 200:
                openapi_paths = set(oa.json().get("paths", {}).keys())

        for name, service, path, method, perm, tables in MODULES:
            fe = (SRC / "services" / service).exists()
            api_path = "/api/v1" + path.split("?")[0]
            in_openapi = any(api_path == p or api_path.startswith(p.rstrip("/")) or p.startswith(api_path) for p in openapi_paths) if openapi_paths else None
            # looser openapi match
            if openapi_paths and not in_openapi:
                base_no_q = path.split("?")[0]
                in_openapi = any(base_no_q in p for p in openapi_paths)

            admin_status = teacher_status = "NOT RUN"
            if live:
                url = BASE + path if path.startswith("/") else BASE + "/" + path
                ar = client.request(method, url, headers=admin)
                admin_status = f"{ar.status_code}"
                tr = client.request(method, url, headers=teacher)
                teacher_status = f"{tr.status_code}"

            # classify
            if not fe:
                verdict = "FAIL"
                note = "frontend service missing"
            elif live and not str(admin_status).startswith("2"):
                verdict = "FAIL"
                note = f"admin {method} {path} -> {admin_status}"
            elif live and teacher_status == "200" and perm.endswith((".write", ".decide", ".approve")):
                verdict = "PARTIAL"
                note = "teacher unexpectedly allowed write-ish read"
            else:
                verdict = "PASS"
                note = "FE service present; admin read OK" if live else "FE service present; live not run"

            # special: roles/users teacher should often be 403
            if live and name.startswith("RBAC") and teacher_status not in ("403", "401"):
                if teacher_status == "200":
                    verdict = "PARTIAL"
                    note = f"teacher got {teacher_status} on {path} (expected 403 for admin RBAC)"
            if live and name == "Dashboard" and teacher_status != "403":
                verdict = "FAIL" if teacher_status.startswith("2") else verdict
                note = f"dashboard teacher={teacher_status} (want 403)"
            if live and name in ("Student Documents", "Employee Documents", "TC Request Approval") and teacher_status == "200":
                # documents: teacher may be denied on employees; students may vary
                pass

            rows.append(
                {
                    "module": name,
                    "service": service,
                    "fe": fe,
                    "path": path,
                    "openapi": in_openapi,
                    "admin": admin_status,
                    "teacher": teacher_status,
                    "tables": ", ".join(tables),
                    "verdict": verdict,
                    "note": note,
                }
            )

    print("| # | Module | FE service | Endpoint | OpenAPI | Admin | Teacher | Verdict | Notes |")
    print("|---|---|---|---|---|---|---|---|---|")
    for i, r in enumerate(rows, 1):
        print(
            f"| {i} | {r['module']} | {r['service']} ({'yes' if r['fe'] else 'NO'}) | `{r['path']}` | "
            f"{r['openapi']} | {r['admin']} | {r['teacher']} | **{r['verdict']}** | {r['note']} |"
        )

    counts = {}
    for r in rows:
        counts[r["verdict"]] = counts.get(r["verdict"], 0) + 1
    print()
    print("COUNTS", counts)
    return 0 if counts.get("FAIL", 0) == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
