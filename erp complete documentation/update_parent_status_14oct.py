"""Mark all Parent (23) modules Completed after portal wiring."""

from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

BASE = Path(__file__).resolve().parent

for candidate in (
    BASE / "QMIS-ERP-Role-Module-Status.docx",
    BASE / "QMIS-ERP-Role-Module-Status.updated.14oct-parent.docx",
):
    if candidate.exists():
        SRC = candidate
        break
else:
    raise FileNotFoundError("No role-module status Word source found")

OUTS = [
    BASE / "QMIS-ERP-Role-Module-Status.docx",
    BASE / "QMIS-ERP-Role-Module-Status.review.14oct.docx",
    BASE / "QMIS-ERP-Role-Module-Status.updated.14oct-parent.docx",
]

NOTE_SHARED = "Parent portal child view via StudentPortalRoutes (ActiveStudentContext)."
NOTE_API = "Shared domain API; parent permissions + child scoping where applicable (14 Oct 2026)."

UPDATES = {
    "Dashboard": ("Completed", f"{NOTE_SHARED} ParentDashboard with child summary and quick links."),
    "Class > Online Class": ("Completed", f"{NOTE_SHARED} Online class screen for selected child."),
    "Class > Extended Class": ("Completed", f"{NOTE_SHARED} Extended class screen for selected child."),
    "Class > Timetable": ("Completed", f"{NOTE_SHARED} Timetable list (weekly) for selected child."),
    "Class > Attendance List": (
        "Completed",
        f"{NOTE_API} Attendance calendar hydrates GET /attendance/students/{{id}}/calendar (attendance.read).",
    ),
    "Student Evaluation > Exam Result": (
        "Completed",
        f"{NOTE_API} ResultDetails hydrates GET /results/students/{{id}} (results.read); falls back to local marks.",
    ),
    "Student Evaluation > Exam Schedule": (
        "Completed",
        f"{NOTE_SHARED} Approved exam schedules filtered in portal context (exams.read granted).",
    ),
    "Student Evaluation > Performance Analytics": (
        "Completed",
        f"{NOTE_SHARED} Analytics page for selected child.",
    ),
    "Student Deliverables > Home Fun": ("Completed", f"{NOTE_SHARED} Home Fun viewMode=student under /parent."),
    "Student Deliverables > Study Materials": ("Completed", f"{NOTE_SHARED} Study materials for selected child."),
    "Student Deliverables > Sample Questions": ("Completed", f"{NOTE_SHARED} Sample questions for selected child."),
    "Library > Borrowed Books": ("Completed", f"{NOTE_SHARED} Borrowed books list for selected child."),
    "Transport > Track Bus": ("Completed", f"{NOTE_SHARED} Track bus with route details for selected child."),
    "Hostel Details": ("Completed", f"{NOTE_SHARED} Hostel details for selected child."),
    "Fees Payment > Academic Payment": (
        "Completed",
        f"{NOTE_SHARED} Academic fee payment UI for selected child (campus fee ledger not parent-scoped yet).",
    ),
    "Fees Payment > Hostel Payment": ("Completed", f"{NOTE_SHARED} Hostel payment UI for selected child."),
    "Fees Payment > Transport Payment": ("Completed", f"{NOTE_SHARED} Transport payment UI for selected child."),
    "Announcement": (
        "Completed",
        f"{NOTE_API} roleKey=parent; GET /announcements; parent in default audience + student-targeted notices.",
    ),
    "TC Request": (
        "Completed",
        f"{NOTE_API} /tc-requests create/list/get scoped to linked children; forward blocked for parent.",
    ),
    "Communication": (
        "Completed",
        f"{NOTE_API} CommunicationPage roleKey=parent; /communication inbox (communication.read/write).",
    ),
    "Calendar": (
        "Completed",
        f"{NOTE_API} AcademicCalendarPage roleKey=parent; GET /calendar (calendar.read).",
    ),
    "Notifications": (
        "Completed",
        f"{NOTE_API} NotificationsList hydrates GET /notifications (notifications.read).",
    ),
    "Escalation Management": (
        "Completed",
        f"{NOTE_SHARED} Escalation UI with parent role config (staff escalation API path not assigned to parents).",
    ),
}


def set_cell_shading(cell, fill: str) -> None:
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    shd.set(qn("w:val"), "clear")
    tcPr.append(shd)


def find_parent_table(doc: Document):
    for table in doc.tables:
        if len(table.rows) < 10:
            continue
        mods = [r.cells[0].text.strip() for r in table.rows]
        if not mods[0].startswith("Module"):
            continue
        if (
            "TC Request" in mods
            and "Fees Payment > Academic Payment" in mods
            and "Transport > Track Bus" in mods
            and "Dashboard" in mods
        ):
            return table
    raise RuntimeError("Parent table not found")


def apply(doc: Document) -> tuple[dict, dict]:
    table = find_parent_table(doc)
    for row in table.rows[1:]:
        mod = row.cells[0].text.strip()
        if mod not in UPDATES:
            continue
        status, note = UPDATES[mod]
        row.cells[1].text = status
        row.cells[2].text = note
        set_cell_shading(row.cells[1], "C6EFCE")

    counts = {"Completed": 0, "Partial": 0, "Not Completed": 0, "Gap": 0}
    for row in table.rows[1:]:
        status = row.cells[1].text.strip()
        if status.startswith("Completed"):
            counts["Completed"] += 1
        elif status.startswith("Partial"):
            counts["Partial"] += 1
        elif status.startswith("Gap"):
            counts["Gap"] += 1
        else:
            counts["Not Completed"] += 1

    summary = doc.tables[1]
    for row in summary.rows[1:]:
        if row.cells[0].text.strip().startswith("Parent"):
            row.cells[1].text = str(sum(counts.values()))
            row.cells[2].text = str(counts["Completed"])
            row.cells[3].text = str(counts["Partial"])
            row.cells[4].text = str(counts["Not Completed"])
            row.cells[5].text = str(counts["Gap"])
            break

    totals = {"Modules": 0, "Completed": 0, "Partial": 0, "Not Completed": 0, "Gap": 0}
    for row in summary.rows[1:]:
        role = row.cells[0].text.strip()
        if not role or role == "TOTAL":
            continue
        try:
            totals["Modules"] += int(row.cells[1].text.strip() or 0)
            totals["Completed"] += int(row.cells[2].text.strip() or 0)
            totals["Partial"] += int(row.cells[3].text.strip() or 0)
            totals["Not Completed"] += int(row.cells[4].text.strip() or 0)
            totals["Gap"] += int(row.cells[5].text.strip() or 0)
        except ValueError:
            continue
    for row in summary.rows:
        if row.cells[0].text.strip() == "TOTAL":
            row.cells[1].text = str(totals["Modules"])
            row.cells[2].text = str(totals["Completed"])
            row.cells[3].text = str(totals["Partial"])
            row.cells[4].text = str(totals["Not Completed"])
            row.cells[5].text = str(totals["Gap"])
            break
    return counts, totals


def main() -> None:
    doc = Document(str(SRC))
    counts, totals = apply(doc)
    for out in OUTS:
        try:
            doc.save(str(out))
            print("Wrote", out.name)
        except PermissionError:
            alt = out.with_name(out.stem + ".unlocked.docx")
            doc.save(str(alt))
            print("LOCKED", out.name, "-> wrote", alt.name)
    print("Source", SRC.name)
    print("Parent counts", counts)
    print("TOTAL", totals)


if __name__ == "__main__":
    main()
