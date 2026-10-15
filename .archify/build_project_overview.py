"""
Build / refresh the ONE project-wide Archify overview.

Always overwrite the same folder — never create timestamped or extra Archify folders:
  .archify/architecture-project-overview/candidate.json
  .archify/architecture-project-overview/qmis-erp-overview.html

Scans:
  - backend/app/main.py include_router(...) lines  → API modules (auto-added)
  - src/services/*Api.js and apiClient.js         → frontend clients

Re-run after adding a backend router or frontend API client:
  python .archify/build_project_overview.py
  node <archify>/bin/archify.mjs finalize architecture \\
    .archify/architecture-project-overview/candidate.json \\
    .archify/architecture-project-overview/qmis-erp-overview.html \\
    --repo-root . --quality showcase --json
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "backend" / "app" / "main.py"
SERVICES = ROOT / "src" / "services"
STABLE_DIR = ROOT / ".archify" / "architecture-project-overview"

# Known routers → display facts + evidence (unknown routers still get a node)
ROUTER_META = {
    "auth_router": {
        "id": "mod_auth",
        "label": "Auth",
        "sublabel": "/api/v1/auth",
        "path": "backend/app/api/v1/endpoints/auth.py",
        "line": 19,
        "end_line": 48,
    },
    "audit_router": {
        "id": "mod_audit",
        "label": "Audit",
        "sublabel": "/api/v1/audit-logs",
        "path": "backend/app/api/v1/endpoints/audit.py",
        "line": 9,
        "end_line": 20,
    },
    "admin_users_router": {
        "id": "mod_admin_users",
        "label": "Admin users",
        "sublabel": "users · roles",
        "path": "backend/app/api/v1/endpoints/admin_users.py",
        "line": 12,
        "end_line": 134,
    },
    "masters_router": {
        "id": "mod_masters",
        "label": "Masters",
        "sublabel": "classes · sections",
        "path": "backend/app/api/v1/endpoints/masters.py",
        "line": 23,
        "end_line": 80,
    },
    "admissions_router": {
        "id": "mod_admissions",
        "label": "Admissions",
        "sublabel": "enquiry → enroll",
        "path": "backend/app/api/v1/endpoints/admissions.py",
        "line": 20,
        "end_line": 136,
    },
    "parents_router": {
        "id": "mod_parents",
        "label": "Parents",
        "sublabel": "me/children",
        "path": "backend/app/api/v1/endpoints/parents.py",
        "line": 11,
        "end_line": 48,
    },
    "students_router": {
        "id": "mod_students",
        "label": "Students",
        "sublabel": "list · detail · me",
        "path": "backend/app/api/v1/endpoints/students.py",
        "line": 11,
        "end_line": 40,
    },
    "attendance_router": {
        "id": "mod_attendance",
        "label": "Attendance",
        "sublabel": "class marks",
        "path": "backend/app/api/v1/endpoints/attendance.py",
        "line": 13,
        "end_line": 55,
    },
    "approvals_router": {
        "id": "mod_workflows",
        "label": "Workflows",
        "sublabel": "leave · tasks · exams",
        "path": "backend/app/api/v1/endpoints/approvals.py",
        "line": 1,
        "end_line": 10,
    },
    "lesson_plans_router": {
        "id": "mod_workflows",
        "label": "Workflows",
        "sublabel": "leave · tasks · exams",
        "path": "backend/app/api/v1/endpoints/lesson_plans.py",
        "line": 1,
        "end_line": 10,
    },
    "exams_router": {
        "id": "mod_workflows",
        "label": "Workflows",
        "sublabel": "leave · tasks · exams",
        "path": "backend/app/api/v1/endpoints/exams.py",
        "line": 1,
        "end_line": 10,
    },
    "leave_router": {
        "id": "mod_workflows",
        "label": "Workflows",
        "sublabel": "leave · tasks · exams",
        "path": "backend/app/api/v1/endpoints/leave.py",
        "line": 1,
        "end_line": 10,
    },
    "escalations_router": {
        "id": "mod_workflows",
        "label": "Workflows",
        "sublabel": "leave · tasks · exams",
        "path": "backend/app/api/v1/endpoints/escalations.py",
        "line": 1,
        "end_line": 10,
    },
    "hr_router": {
        "id": "mod_hr",
        "label": "HR",
        "sublabel": "partner vertical",
        "path": "backend/app/api/v1/endpoints/hr.py",
        "line": 27,
        "end_line": 50,
    },
    "files_router": {
        "id": "mod_files",
        "label": "Files",
        "sublabel": "upload · download",
        "path": "backend/app/api/v1/endpoints/files.py",
        "line": 13,
        "end_line": 39,
    },
    # Several Admin campus routers share one diagram node (same pattern as Y-0..Y-5 workflows).
    "documents_router": {
        "id": "mod_admin_campus",
        "label": "Admin campus",
        "sublabel": "docs · TC · activities",
        "path": "backend/app/api/v1/endpoints/documents.py",
        "line": 1,
        "end_line": 68,
    },
    "announcements_router": {
        "id": "mod_admin_campus",
        "label": "Admin campus",
        "sublabel": "docs · TC · activities",
        "path": "backend/app/api/v1/endpoints/announcements.py",
        "line": 1,
        "end_line": 65,
    },
    "calendar_router": {
        "id": "mod_admin_campus",
        "label": "Admin campus",
        "sublabel": "docs · TC · activities",
        "path": "backend/app/api/v1/endpoints/calendar.py",
        "line": 1,
        "end_line": 61,
    },
    "tc_requests_router": {
        "id": "mod_admin_campus",
        "label": "Admin campus",
        "sublabel": "docs · TC · activities",
        "path": "backend/app/api/v1/endpoints/tc_requests.py",
        "line": 1,
        "end_line": 63,
    },
    "activities_router": {
        "id": "mod_admin_campus",
        "label": "Admin campus",
        "sublabel": "docs · TC · activities",
        "path": "backend/app/api/v1/endpoints/activities.py",
        "line": 1,
        "end_line": 101,
    },
    "communication_router": {
        "id": "mod_admin_campus",
        "label": "Admin campus",
        "sublabel": "docs · TC · activities",
        "path": "backend/app/api/v1/endpoints/communication.py",
        "line": 1,
        "end_line": 83,
    },
    "dashboard_router": {
        "id": "mod_admin_campus",
        "label": "Admin campus",
        "sublabel": "docs · TC · activities",
        "path": "backend/app/api/v1/endpoints/dashboard.py",
        "line": 1,
        "end_line": 16,
    },
    "finance_router": {
        "id": "mod_finance",
        "label": "Finance",
        "sublabel": "snapshot + actions",
        "path": "backend/app/api/v1/endpoints/finance.py",
        "line": 10,
        "end_line": 116,
    },
}

# Not mounted yet — shown dashed until include_router appears in main.py
PLANNED = [
    {
        "id": "mod_ops",
        "label": "Ops",
        "sublabel": "Phase 3+",
        "tag": "planned",
        "path": "backend/app/main.py",
        "line": 43,
        "end_line": 48,
    },
]


def git_rev() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:
        return "0" * 40


def path_at_head(rel: str) -> bool:
    """Archify repo evidence is verified against committed HEAD, not the worktree."""
    try:
        subprocess.check_output(
            ["git", "cat-file", "-e", f"HEAD:{rel.replace(chr(92), '/')}"],
            cwd=ROOT,
            stderr=subprocess.DEVNULL,
        )
        return True
    except Exception:
        return False


def scan_routers() -> list[dict]:
    text = MAIN.read_text(encoding="utf-8")
    modules = []
    for match in re.finditer(r"app\.include_router\((\w+)\)", text):
        name = match.group(1)
        line = text.count("\n", 0, match.start()) + 1
        meta = ROUTER_META.get(name)
        if meta:
            item = dict(meta)
            # Uncommitted endpoint files cannot be cited at HEAD — fall back to main.py mount.
            if not path_at_head(item["path"]):
                # main.py at HEAD may be shorter than the worktree; cite a range that exists there.
                item["path"] = "backend/app/main.py"
                item["line"] = 43
                item["end_line"] = 48
            if any(m["id"] == item["id"] for m in modules):
                continue  # several routers share one diagram node (Y-0..Y-5 workflows)
            modules.append(item)
        else:
            slug = re.sub(r"_?router$", "", name)
            modules.append(
                {
                    "id": f"mod_{slug}",
                    "label": slug.replace("_", " ").title(),
                    "sublabel": "auto from main.py",
                    "path": "backend/app/main.py",
                    "line": line,
                    "end_line": line,
                    "tag": "auto",
                }
            )
    return modules


def scan_clients() -> list[str]:
    if not SERVICES.is_dir():
        return []
    apis = sorted(p.name for p in SERVICES.glob("*Api.js"))
    if (SERVICES / "apiClient.js").exists():
        apis.append("apiClient.js")
    return apis


def place_grid(modules: list[dict], start_x: int, start_y: int, cols: int, gap_x: int = 170, gap_y: int = 120) -> list[dict]:
    components = []
    for i, mod in enumerate(modules):
        col, row = i % cols, i // cols
        node_type = "cloud" if mod.get("tag") == "planned" else "backend"
        node = {
            "id": mod["id"],
            "type": node_type,
            "label": mod["label"],
            "sublabel": mod["sublabel"],
            "pos": [start_x + col * gap_x, start_y + row * gap_y],
            "size": [148, 60],
            "sources": [
                {
                    "path": mod["path"],
                    "line": mod["line"],
                    "end_line": mod.get("end_line", mod["line"]),
                }
            ],
        }
        if mod.get("tag"):
            node["tag"] = mod["tag"]
        components.append(node)
    return components


def build_candidate(modules: list[dict], clients: list[str], out_rel: str) -> dict:
    live = list(modules)
    planned = list(PLANNED)
    # Compact rack so showcase desktop scale keeps edge labels ≥6px (viewBox width ≲1200).
    live_nodes = place_grid(live, 800, 40, cols=2, gap_x=160, gap_y=92)
    planned_y = 40 + 92 * ((len(live) + 1) // 2)
    planned_nodes = place_grid(planned, 800, planned_y + 20, cols=2, gap_x=160, gap_y=92)
    client_label = f"{len(clients)} *Api.js clients"  # full list is on the "Clients found" card

    components = [
        {
            "id": "users",
            "type": "external",
            "label": "School users",
            "sublabel": "role portals",
            "pos": [24, 200],
            "size": [120, 64],
            "icon": "person",
            "sources": [{"path": "src/App.jsx", "line": 44, "end_line": 72}],
        },
        {
            "id": "web",
            "type": "frontend",
            "label": "React portal",
            "sublabel": "lazy layouts",
            "pos": [220, 200],
            "size": [130, 64],
            "sources": [{"path": "src/App.jsx", "line": 1, "end_line": 42}],
        },
        {
            "id": "client",
            "type": "frontend",
            "label": "API clients",
            "sublabel": client_label or "services",
            "pos": [400, 200],
            "size": [150, 64],
            "sources": [{"path": "src/services/apiClient.js", "line": 1, "end_line": 30}],
        },
        {
            "id": "api",
            "type": "backend",
            "label": "FastAPI",
            "sublabel": ":8000",
            "pos": [580, 120],
            "size": [140, 180],
            "tag": "UUID stack",
            "sources": [{"path": "backend/app/main.py", "line": 38, "end_line": 90}],
        },
        {
            "id": "db",
            "type": "database",
            "label": "PostgreSQL",
            "sublabel": "qmis_erp",
            "pos": [400, 360],
            "size": [130, 64],
            "sources": [{"path": "backend/app/core/config.py", "line": 4, "end_line": 20}],
        },
        {
            "id": "alembic",
            "type": "backend",
            "label": "Alembic",
            "sublabel": "0001–0012",
            "pos": [220, 360],
            "size": [130, 64],
            "tag": "by hand",
            "sources": [{"path": "backend/alembic/env.py", "line": 17, "end_line": 32}],
        },
        {
            "id": "uploads",
            "type": "database",
            "label": "Uploads",
            "sublabel": "disk files",
            "pos": [400, 480],
            "size": [130, 64],
            "sources": [{"path": "backend/app/services/files.py", "line": 18, "end_line": 25}],
        },
        *live_nodes,
        *planned_nodes,
    ]

    live_ids = [n["id"] for n in live_nodes]
    planned_ids = [n["id"] for n in planned_nodes]

    connections = [
        {"id": "users-web", "from": "users", "to": "web", "label": "HTTPS", "variant": "emphasis"},
        {"id": "web-client", "from": "web", "to": "client", "label": "calls"},
        {"id": "client-api", "from": "client", "to": "api", "label": "JWT", "variant": "security"},
        {"id": "api-db", "from": "api", "to": "db", "label": "SQL"},
        {"id": "api-uploads", "from": "api", "to": "uploads", "label": "files", "variant": "dashed"},
        {"id": "alembic-db", "from": "alembic", "to": "db", "label": "migrate"},
    ]
    for nid in live_ids:
        connections.append({"id": f"api-{nid}", "from": "api", "to": nid})
    for nid in planned_ids:
        connections.append({"id": f"api-{nid}", "from": "api", "to": nid, "variant": "dashed"})

    return {
        "schema_version": 1,
        "diagram_type": "architecture",
        "meta": {
            "title": "QMIS School ERP — project overview",
            "subtitle": "15 Oct live stack — Principal 21/21 · Medium UX/bundle fixes · Alembic 0012",
            "locale": "en",
            "quality_profile": "showcase",
            "repository": {
                "url": "https://github.com/karan4533/ERP-dev.git",
                "provider": "github",
                "link_mode": "web",
                "revision": git_rev(),
            },
            "output": out_rel.replace("\\", "/"),
            "legend": {
                "entries": {
                    "backend": {"label": "API module"},
                    "cloud": {"label": "Planned module"},
                    "frontend": {"label": "Browser app"},
                    "database": {"label": "Store"},
                    "security": {"label": "Auth path"},
                    "external": {"label": "People"},
                }
            },
            "views": [
                {"id": "live", "label": "Live API", "focus": ["api", *live_ids], "note": "Routers mounted in main.py"},
                {"id": "planned", "label": "Planned", "focus": ["api", *planned_ids], "note": "Phase 3+"},
                {"id": "path", "label": "User path", "focus": ["users", "web", "client", "api", "db"]},
            ],
        },
        "components": components,
        "boundaries": [
            {"kind": "region", "label": "Frontend (Vite + React)", "wraps": ["web", "client"]},
            {"kind": "region", "label": "Backend (FastAPI)", "wraps": ["api", *live_ids]},
            {"kind": "region", "label": "Planned departments", "wraps": planned_ids},
            {"kind": "security-group", "label": "Authenticated API", "wraps": ["client", "api"]},
        ],
        "connections": connections,
        "cards": [
            {
                "dot": "emerald",
                "title": "Live now",
                "items": [f"{m['label']} — {m['sublabel']}" for m in live]
                + [
                    "VITE_USE_API_* flags default with auth (fail-closed hydrate; no stale localStorage when API on)",
                    "Completed panels: Admin 26/26 · PRM 21/21 · Parent 23/23 · Student 23/23 · Teacher 29/1 Gap · Coordinator 29/1 Gap · Principal 21/21",
                    "Class Attendance Save → POST /attendance; Mark Entry → /marks-batches",
                    "App.jsx lazy-loads role layouts (entry JS ~354 kB after code-split)",
                    "must_change_password gated in get_current_user; orphan file downloads ACL-hardened",
                    "Alembic head 0012_students_student_user_id; 48 application tables",
                    "HR + Finance API SoT; Gateway/SMTP/WA env-gated (demo/stub)",
                    "15 Oct 2026 stability audit READY WITH LIMITATIONS; pytest 416 passed",
                ],
            },
            {
                "dot": "amber",
                "title": "Auto-add a module",
                "items": [
                    "Mount router in backend/app/main.py",
                    "Add src/services/<name>Api.js for the UI",
                    "Run python .archify/build_project_overview.py then finalize (same folder only)",
                ],
            },
            {
                "dot": "slate",
                "title": "Clients found",
                "items": clients or ["(none yet)"],
            },
            {
                "dot": "rose",
                "title": "Still open",
                "items": [
                    "Next panel: Director (shared approvals + campus APIs)",
                    "Teacher/Coordinator biometric remains Gap",
                    "Further page-level lazy imports inside largest role route trees",
                    "Live SMTP/WhatsApp/payments when school configures providers",
                    "RFID / eSSL import still off unless enabled",
                    "Integrations accept ≠ delivery verified",
                ],
            },
        ],
    }


def write_candidate(candidate: dict, folder: Path) -> Path:
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / "candidate.json"
    path.write_text(json.dumps(candidate, indent=2), encoding="utf-8")
    return path


def main() -> None:
    modules = scan_routers()
    clients = scan_clients()
    candidate = build_candidate(
        modules, clients, ".archify/architecture-project-overview/qmis-erp-overview.html"
    )
    path = write_candidate(candidate, STABLE_DIR)
    print(
        json.dumps(
            {
                "candidate": str(path),
                "modules": [m["id"] for m in modules],
                "clients": clients,
            }
        )
    )


if __name__ == "__main__":
    main()





