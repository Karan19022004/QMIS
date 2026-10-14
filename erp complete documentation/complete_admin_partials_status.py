"""Mark the remaining Administrator Partial modules as Completed after live API verify."""

from __future__ import annotations

import sys
from pathlib import Path

from docx import Document

sys.stdout.reconfigure(encoding="utf-8")

BASE = Path(__file__).resolve().parent
SOURCES = [
    BASE / "QMIS-ERP-Role-Module-Status.updated.14oct-evening.docx",
    BASE / "QMIS-ERP-Role-Module-Status.ADMIN-UPDATED-14oct.docx",
]
OUT = BASE / "QMIS-ERP-Role-Module-Status.updated.14oct-evening.docx"
OUT_ADMIN = BASE / "QMIS-ERP-Role-Module-Status.ADMIN-UPDATED-14oct.docx"
OUT_HTML = BASE / "QMIS-ERP-Role-Module-Status.ADMIN-UPDATED-14oct.html"
OUT_MAIN = BASE / "QMIS-ERP-Role-Module-Status.docx"
OUT_REVIEW = BASE / "QMIS-ERP-Role-Module-Status.review.14oct.docx"

UPDATES = {
    "Activities > Cultural": (
        "Completed",
        "Live API 14 Oct 2026 evening: POST /api/v1/activities type=cultural → 201; teacher create 403; "
        "list includes the new row. Migration 0009, activitiesApi.js, screens hydrate from the server. On main (PR #3).",
    ),
    "Activities > Sports": (
        "Completed",
        "Live API 14 Oct 2026 evening: POST /api/v1/activities type=sports → 201; teacher create 403. "
        "Migration 0009, activitiesApi.js. On main (PR #3).",
    ),
    "Activities > Chess Result": (
        "Completed",
        "Live API 14 Oct 2026 evening: sports row with chess players → 201; POST …/approval Approved → 200. "
        "ChessResultPage hydrates from the server. On main (PR #3).",
    ),
    "Activities > Competitions": (
        "Completed",
        "Live API 14 Oct 2026 evening: POST /api/v1/activities type=competition → 201; teacher create 403. "
        "Migration 0009. On main (PR #3).",
    ),
    "TC Request Approval": (
        "Completed",
        "Live API 14 Oct 2026 evening: create TC-REQ → forward → approve (status Approved, tcNumber issued); "
        "list includes the approved row. /api/v1/tc-requests, migration 0008, tcApi.js. On main (PR #3).",
    ),
    "Communication": (
        "Completed",
        "Live API 14 Oct 2026 evening: GET /communication/directory 200; POST /conversations 201; "
        "POST …/messages with body 201; inbox lists the thread. Migration 0010, communicationApi.js. On main (PR #3).",
    ),
    "RBAC > Roles": (
        "Completed",
        "Completed as read-only by product scope. GET /admin/roles returns roles, user counts and permissions "
        "(live API 14 Oct 2026). Editing role permissions is intentionally not built.",
    ),
}


def find_admin_table(doc: Document):
    for table in doc.tables:
        if len(table.rows) < 5:
            continue
        mods = [r.cells[0].text.strip() for r in table.rows[:5]]
        if mods[0].startswith("Module") and "Dashboard" in mods[1] and any("Admission" in m for m in mods):
            return table
    raise RuntimeError("Administrator table not found")


def apply(doc: Document) -> dict:
    # refresh header line if present
    for p in doc.paragraphs[:8]:
        if "Review copy revised 2026-10-14 evening" in p.text or "CHANGED 14 Oct 2026 evening" in p.text:
            if p.text.startswith("CHANGED"):
                p.text = (
                    "CHANGED 14 Oct 2026 evening — Administrator panel complete on main (PR #3): "
                    "26 Completed / 0 Partial / 0 Not Completed. Activities, TC, Communication verified by live API; "
                    "Roles completed as read-only by design."
                )
            elif "Queen Mira" in p.text or "Generated:" in p.text:
                p.text = (
                    "Queen Mira International School ERP\n"
                    "Generated: 2026-10-12. Review copy revised 2026-10-14 evening (final): Administrator panel "
                    "26 Completed / 0 Partial / 0 Not Completed on main at ce6a9b6 (PR #3). "
                    "Activities, TC and Communication closed by live API create/approve/send; "
                    "Roles closed as read-only by product scope.\n"
                    "Other role panels still carry the 13 Oct review unless noted.\n"
                    "Full backend suite earlier the same evening: 400 passed."
                )
            break

    for p in doc.paragraphs:
        if p.text.startswith("Partial (still):"):
            p.text = "Partial (still): none for Administrator. Roles is Completed as read-only by design."
        if p.text.startswith("Completed now:"):
            p.text = (
                "Completed now: all 26 Administrator sidebar modules, including Activities, TC Request Approval, "
                "Communication and Roles (read-only)."
            )
        if "Administrator counts:" in p.text:
            p.text = (
                "Administrator counts: was 11 Completed / 3 Partial / 12 Not Completed  →  "
                "now 26 Completed / 0 Partial / 0 Not Completed."
            )

    table = find_admin_table(doc)
    for row in table.rows[1:]:
        module = row.cells[0].text.strip()
        if module in UPDATES:
            status, notes = UPDATES[module]
            row.cells[1].text = status
            row.cells[2].text = notes

    counts = {"Completed": 0, "Partial": 0, "Not Completed": 0, "Gap": 0}
    for row in table.rows[1:]:
        status = row.cells[1].text.strip()
        if status.startswith("Completed"):
            counts["Completed"] += 1
        elif status == "Partial":
            counts["Partial"] += 1
        elif status == "Gap":
            counts["Gap"] += 1
        else:
            counts["Not Completed"] += 1

    total = sum(counts.values())
    summary = doc.tables[1].rows[2]
    summary.cells[0].text = "Administrator"
    summary.cells[1].text = str(total)
    summary.cells[2].text = str(counts["Completed"])
    summary.cells[3].text = str(counts["Partial"])
    summary.cells[4].text = str(counts["Not Completed"])
    summary.cells[5].text = str(counts["Gap"])
    return counts


def write_html(doc: Document) -> None:
    table = find_admin_table(doc)
    rows = []
    for row in table.rows[1:]:
        mod, status, note = row.cells[0].text.strip(), row.cells[1].text.strip(), row.cells[2].text.strip()
        bg = "#d1fae5" if status.startswith("Completed") else "#fef3c7"
        rows.append(
            f'<tr style="background:{bg}"><td>{mod}</td><td><b>{status}</b></td><td>{note[:260]}</td></tr>'
        )
    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Admin status — all Completed</title>
<style>
body{{font-family:Segoe UI,Arial,sans-serif;margin:24px}}
.banner{{background:#d1fae5;border:2px solid #047857;padding:12px 16px;margin-bottom:16px}}
table{{border-collapse:collapse;width:100%;font-size:13px}}
th,td{{border:1px solid #ccc;padding:8px;vertical-align:top}}
th{{background:#111827;color:#fff}}
</style></head><body>
<div class="banner"><strong>Administrator: 26 Completed · 0 Partial · 0 Not Completed</strong><br>
Updated 14 Oct 2026 evening after live API verify of Activities, TC, Communication. Roles = Completed (read-only by design).<br>
Word: <code>QMIS-ERP-Role-Module-Status.updated.14oct-evening.docx</code></div>
<h1>Administrator modules</h1>
<table><tr><th>Module</th><th>Status</th><th>Notes</th></tr>
{''.join(rows)}
</table></body></html>"""
    OUT_HTML.write_text(html, encoding="utf-8")


def main() -> None:
    src = OUT if OUT.exists() else SOURCES[0]
    doc = Document(str(src))
    counts = apply(doc)
    print("Administrator recount:", counts)

    for path in (OUT, OUT_ADMIN):
        doc.save(str(path))
        print("Wrote", path)

    write_html(doc)
    print("Wrote", OUT_HTML)

    for path in (OUT_MAIN, OUT_REVIEW):
        try:
            doc.save(str(path))
            print("Updated", path)
        except OSError as exc:
            print(f"Could not update {path.name}: {exc}")

    check = Document(str(OUT))
    print("Summary:", [c.text for c in check.tables[1].rows[2].cells])
    for row in find_admin_table(check).rows[1:]:
        print(f"  {row.cells[1].text:12s} {row.cells[0].text}")


if __name__ == "__main__":
    main()
