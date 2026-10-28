"""Build Queen Mira staff into src/Pages/HR/domain/hrSeed.js from the Excel roster."""
from __future__ import annotations

import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "docs" / "Staff Name mail id and phone no (1).xlsx"
HR_SEED = ROOT / "src" / "Pages" / "HR" / "domain" / "hrSeed.js"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def parse_xlsx(path: Path) -> list[dict]:
    with zipfile.ZipFile(path) as z:
        strings: list[str] = []
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in root.findall("m:si", NS):
            texts = [
                t.text or ""
                for t in si.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")
            ]
            strings.append("".join(texts))
        sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        rows = []
        for row in sheet.findall(".//m:sheetData/m:row", NS):
            cells: dict[str, str] = {}
            for c in row.findall("m:c", NS):
                ref = c.get("r") or ""
                col = "".join(ch for ch in ref if ch.isalpha())
                t = c.get("t")
                v = c.find("m:v", NS)
                is_ = c.find("m:is", NS)
                if t == "s" and v is not None and v.text is not None:
                    val = strings[int(v.text)]
                elif t == "inlineStr" and is_ is not None:
                    val = "".join(
                        x.text or ""
                        for x in is_.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")
                    )
                elif v is not None:
                    val = v.text or ""
                else:
                    val = ""
                cells[col] = val.strip()
            if any(cells.values()):
                rows.append(cells)
    return rows


def primary_email(raw: str) -> str:
    text = (raw or "").replace(",", "/").strip()
    parts = [p.strip() for p in text.split("/") if p.strip()]
    return parts[0] if parts else ""


def phone_digits(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 10:
        return f"+91 {digits}"
    if digits:
        return f"+{digits}" if not (raw or "").startswith("+") else (raw or "").strip()
    return ""


def map_role(designation: str) -> str:
    """Map designation → RBAC role code (matches src/constants/roles.js / hr._role_code)."""
    d = (designation or "").lower().strip()
    if not d:
        return ""
    if "joint director" in d and "audit" in d:
        return "jointdirectoraudit"
    if "joint director" in d:
        return "jointdirector"
    if "quality audit" in d or "qualityauditor" in d.replace(" ", ""):
        return "qualityauditor"
    if d == "principal" or (d.startswith("principal") and "audit" not in d and "quality" not in d):
        return "principal"
    if "director" in d and "joint" not in d:
        return "director"
    if "coordinator" in d:
        return "coordinator"
    if "parent relationship" in d or "parents relationship" in d:
        return "prm"
    if "public relations" in d or d in {"assistant pro", "pro"}:
        return "prm"
    if "librarian" in d:
        return "librarian"
    if d.startswith("hr ") or d == "hr executive" or "hr facilitator" in d:
        return "hr"
    if "finance manager" in d or "accountant" in d or "accounts trainee" in d:
        return "accounthead"
    if "system administrator" in d:
        return "itsupportmanager"
    if "process audit" in d or d in {"executive - audit", "audit executive"}:
        return "processauditor"
    teacher_tokens = (
        "prt",
        "tgt",
        "pgt",
        "sgt",
        "nursery trained",
        "facilitat",
        "faciliti",  # Excel typo: Facilitiator
        "teacher",
        "avp",
        "vp (",
        "hod ",
        "special educator",
        "school counsellor",
        "robotics",
        "physical education",
        "rifle trainer",
        "lab assistant",
        "ano/",
        "ncc",
        "cso-ncc",
    )
    if any(tok in d for tok in teacher_tokens):
        return "teacher"
    return ""


def category_for(department: str, role: str) -> str:
    dep = (department or "").strip() or "Admin"
    if role == "teacher" or dep.lower().startswith("academic"):
        return "Academics"
    return "Admin"


def build_employees(rows: list[dict]) -> list[dict]:
    employees = []
    seen_emails: set[str] = set()
    seq = 0
    for row in rows[1:]:
        name = (row.get("C") or "").strip()
        designation = (row.get("D") or "").strip()
        if not name or designation.lower() in {"", "desigination", "designation"}:
            continue
        if name.lower() in {"name", "sl.no"}:
            continue
        email = primary_email(row.get("E") or "")
        email_key = email.lower()
        if email_key and email_key in seen_emails:
            # keep first; skip duplicate email rows
            continue
        if email_key:
            seen_emails.add(email_key)
        seq += 1
        department = (row.get("B") or "Admin").strip() or "Admin"
        role = map_role(designation)
        emp = {
            "id": f"EMP-QMIS-{seq:03d}",
            "name": name,
            "gender": "",
            "dateOfBirth": "",
            "contact": phone_digits(row.get("F") or ""),
            "email": email or f"staff{seq:03d}@queenmira.com",
            "address": "Queen Mira International School, Madurai",
            "department": department if department != "Department" else "Admin",
            "designation": designation,
            "joiningDate": "",
            "status": "Active",
            "reportingManager": "",
            "role": role,
            "qualification": "",
            "experience": "",
            "emergencyContact": "",
            "employmentType": "Full Time",
            "category": category_for(department, role),
            "grossSalary": 0,
            "otherAllowance": 0,
            "specialDeduction": 0,
            "otherEmployerBenefits": 0,
        }
        employees.append(emp)
    return employees


def js_value(value):
    return json.dumps(value, ensure_ascii=False)


def render_employee(emp: dict) -> str:
    parts = [f"{k}: {js_value(v)}" for k, v in emp.items()]
    return "        { " + ", ".join(parts) + " },"


def main() -> None:
    rows = parse_xlsx(XLSX)
    employees = build_employees(rows)
    emp_block = "\n".join(render_employee(e) for e in employees)

    # Role counts for console
    counts: dict[str, int] = {}
    for e in employees:
        counts[e["role"] or "(directory only)"] = counts.get(e["role"] or "(directory only)", 0) + 1

    content = f'''const checklist = (doneUntil) => {{
    const items = [
        'Offer Accepted', 'Appointment Letter Issued', 'Employee ID Created', 'Personal Details Completed',
        'Documents Collected', 'Department Assigned', 'Reporting Manager Assigned', 'HR Orientation',
        'Policy Acknowledgement', 'System Access', 'ID Card', 'Bank Details', 'Training Scheduled',
        'Shadow Mentor Assigned', 'Observation Scheduled', 'Onboarding Completed',
    ]
    return items.map((label, index) => ({{
        label,
        status: index < doneUntil ? 'Completed' : index === doneUntil ? 'In Progress' : 'Not Started',
    }}))
}}

/** Queen Mira staff roster from docs/Staff Name mail id and phone no (1).xlsx (designation-wise). */
export const SEED = {{
    employees: [
{emp_block}
    ],
    documents: [],
    jobs: [],
    candidates: [],
    interviews: [],
    offers: [],
    onboarding: [],
    observations: [],
    shadow: [],
    training: [],
    leave: {{
        policies: [
            {{ id: 'POL-001', name: 'Academic Casual Leave', category: 'Academics', leaveType: 'Casual Leave', entitlement: 12, carryForward: false, maxConsecutive: 3, paid: true, approvalRequired: true, active: true }},
            {{ id: 'POL-002', name: 'Admin Earned Leave', category: 'Admin', leaveType: 'Earned Leave', entitlement: 15, carryForward: true, maxConsecutive: 7, paid: true, approvalRequired: true, active: true }},
            {{ id: 'POL-003', name: 'Support Sick Leave', category: 'Support / Operations', leaveType: 'Sick Leave', entitlement: 8, carryForward: false, maxConsecutive: 5, paid: true, approvalRequired: true, active: true }},
        ],
        requests: [],
    }},
    attendance: [],
    payroll: {{ months: [], revisions: [] }},
    payslips: [],
    advances: [],
    referrals: [],
    concessions: [],
    disciplinary: [],
    exits: [],
    performance: [],
    notifications: [],
    claims: [],
    announcements: [],
    // Local outbox only — SMTP / WhatsApp gateways are out of scope for the campus demo.
    comms: [],
}}

export const ADMIN_CRITERIA = ['Job Knowledge', 'Punctuality', 'Quality of Work', 'Communication', 'Teamwork', 'Presentation', 'Reporting']
export const ACADEMIC_CRITERIA = ['Planning & Preparation', 'Classroom Management', 'Teaching Practice', 'Communication', 'Teamwork', 'Problem Solving', 'Time Management', 'Leadership', 'Professional Responsibility']
export const ONBOARDING_ITEMS = [
    'Offer Accepted', 'Appointment Letter Issued', 'Employee ID Created', 'Personal Details Completed',
    'Documents Collected', 'Department Assigned', 'Reporting Manager Assigned', 'HR Orientation',
    'Policy Acknowledgement', 'System Access', 'ID Card', 'Bank Details', 'Training Scheduled',
    'Shadow Mentor Assigned', 'Observation Scheduled', 'Onboarding Completed',
]
export const ADVANCE_FLOW = ['DRAFT', 'SUBMITTED', 'HR_REVIEW', 'FINANCE_REVIEW', 'JD_REVIEW', 'DIRECTOR_REVIEW', 'MD_REVIEW', 'APPROVED']
export const ADVANCE_ACTORS = {{ HR_REVIEW: 'HR', FINANCE_REVIEW: 'Finance', JD_REVIEW: 'JD Admin', DIRECTOR_REVIEW: 'Director Academics', MD_REVIEW: 'MD' }}
export const DISCIPLINE_FLOW = ['DRAFT', 'HR_REVIEW', 'JD_REVIEW', 'DIRECTOR_REVIEW', 'MD_REVIEW', 'APPROVED']
export const DISCIPLINE_ACTORS = {{ HR_REVIEW: 'HR Manager', JD_REVIEW: 'JD Admin', DIRECTOR_REVIEW: 'Director Academics', MD_REVIEW: 'Managing Director' }}
'''

    HR_SEED.write_text(content, encoding="utf-8")
    summary = ROOT / "docs" / "QMIS_Staff_Import_Summary.json"
    summary.write_text(
        json.dumps(
            {
                "employeeCount": len(employees),
                "roleCounts": counts,
                "source": str(XLSX.name),
                "target": "src/Pages/HR/domain/hrSeed.js",
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Wrote {len(employees)} employees to {HR_SEED}")
    print("Role counts:", json.dumps(counts, indent=2))


if __name__ == "__main__":
    main()
