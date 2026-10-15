"""Mark Coordinator (30) modules Completed after shared-API / portal wiring (15 Oct 2026)."""

from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

BASE = Path(__file__).resolve().parent

for candidate in (
    BASE / "QMIS-ERP-Role-Module-Status.docx",
    BASE / "QMIS-ERP-Role-Module-Status.updated.15oct-coordinator.docx",
):
    if candidate.exists():
        SRC = candidate
        break
else:
    raise FileNotFoundError("No role-module status Word source found")

OUTS = [
    BASE / "QMIS-ERP-Role-Module-Status.docx",
    BASE / "QMIS-ERP-Role-Module-Status.review.14oct.docx",
    BASE / "QMIS-ERP-Role-Module-Status.updated.15oct-coordinator.docx",
]

NOTE_PORTAL = "Coordinator portal UI wired; shared screens use roleKey=coordinator."
NOTE_API = "Shared domain API with coordinator permissions (+ exams.write) (15 Oct 2026)."

UPDATES = {
    "Dashboard": ("Completed", f"{NOTE_PORTAL} Coordinator dashboard route."),
    "Attendance > Class Attendance": (
        "Completed",
        f"{NOTE_API} Reuses Teacher ClassAttendance GET /attendance.",
    ),
    "Class > Period Chart": ("Completed", f"{NOTE_PORTAL} Period chart / timetable screen."),
    "Class > Lesson Plan": (
        "Completed",
        f"{NOTE_API} Shared MyLessonPlan hydrates GET /lesson-plans; submit via /lesson-plans.",
    ),
    "Class > Lesson Plan Approval": (
        "Completed",
        f"{NOTE_PORTAL} Lesson plan approval UI (shared Teacher SubmitLessonPlan).",
    ),
    "Class > Extended Class": ("Completed", f"{NOTE_PORTAL} Extended class screen."),
    "Class > Online Class": ("Completed", f"{NOTE_PORTAL} Online class screen."),
    "Task Management": ("Completed", f"{NOTE_API} Tasks API via TaskManagementRoutes."),
    "Student > Students List": (
        "Completed",
        f"{NOTE_API} StudentsList hydrates GET /students.",
    ),
    "Student > Parents List": ("Completed", f"{NOTE_PORTAL} Parents list UI."),
    "Student > CA / RCT": ("Completed", f"{NOTE_PORTAL} Unit tests / CA-RCT screen."),
    "Student > Exam": (
        "Completed",
        f"{NOTE_API} ExamSchedule lists GET /exams; coordinator also has exams.write.",
    ),
    "Student > Question Bank": ("Completed", f"{NOTE_PORTAL} Sample questions / question bank UI."),
    "Student > Mark Entry": (
        "Completed",
        f"{NOTE_PORTAL} Mark entry UI; marks.write /marks-batches available.",
    ),
    "Student > Performance Analytics": ("Completed", f"{NOTE_PORTAL} Analytics screen."),
    "Student > Biometric Attendance": (
        "Gap",
        "Product biometric feed not in campus API scope; screen remains placeholder.",
    ),
    "Student > Home Fun": ("Completed", f"{NOTE_PORTAL} Home Fun deliverables."),
    "Student > Study Materials": ("Completed", f"{NOTE_PORTAL} Study materials deliverables."),
    "Student > Star of the Month": ("Completed", f"{NOTE_PORTAL} Star ratings SOM."),
    "Student > Star of the Year": ("Completed", f"{NOTE_PORTAL} Star of the year."),
    "My Profile > My Profile": ("Completed", f"{NOTE_PORTAL} Profile screen (auth.me / hr.self)."),
    "My Profile > My Attendance": ("Completed", f"{NOTE_PORTAL} Staff my-attendance UI."),
    "My Profile > My Leave Requests": (
        "Completed",
        f"{NOTE_API} MyLeaveRequestsList roleKey=coordinator.",
    ),
    "My Profile > Received Leave Requests": (
        "Completed",
        f"{NOTE_API} ReceivedLeaveRequestsList roleKey=coordinator.",
    ),
    "My Profile > Books Borrowed": ("Completed", f"{NOTE_PORTAL} Library books borrowed UI."),
    "Announcement": (
        "Completed",
        f"{NOTE_API} AnnouncementListView roleKey=coordinator.",
    ),
    "Communication": (
        "Completed",
        f"{NOTE_API} CommunicationPage roleKey=coordinator (+ config entry).",
    ),
    "Calendar": (
        "Completed",
        f"{NOTE_API} AcademicCalendarPage roleKey=coordinator.",
    ),
    "Notifications": (
        "Completed",
        f"{NOTE_API} Notifications hydrates GET /notifications.",
    ),
    "Escalation Management": (
        "Completed",
        f"{NOTE_API} EscalationListPage roleKey=coordinator.",
    ),
}


def set_cell_shading(cell, fill: str) -> None:
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    shd.set(qn("w:val"), "clear")
    tcPr.append(shd)


def find_coordinator_table(doc: Document):
    for table in doc.tables:
        if len(table.rows) < 20:
            continue
        mods = [r.cells[0].text.strip() for r in table.rows]
        if not mods[0].startswith("Module"):
            continue
        if "Class > Period Chart" in mods and "Student > Biometric Attendance" in mods:
            return table
    raise RuntimeError("Coordinator table not found")


def apply(doc: Document) -> tuple[dict, dict]:
    table = find_coordinator_table(doc)
    for row in table.rows[1:]:
        mod = row.cells[0].text.strip()
        if mod not in UPDATES:
            continue
        status, note = UPDATES[mod]
        row.cells[1].text = status
        row.cells[2].text = note
        fill = "C6EFCE" if status.startswith("Completed") else ("FFC7CE" if status.startswith("Gap") else "FFEB9C")
        set_cell_shading(row.cells[1], fill)

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
        if row.cells[0].text.strip().startswith("Coordinator"):
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
    print("Coordinator counts", counts)
    print("TOTAL", totals)


if __name__ == "__main__":
    main()
