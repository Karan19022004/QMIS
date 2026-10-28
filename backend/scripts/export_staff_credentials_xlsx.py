"""Export live staff credential handoff JSON -> Excel (no DB writes, no password prints)."""

from __future__ import annotations

import argparse
import json
import re
import zipfile
from collections import Counter
from pathlib import Path
from xml.sax.saxutils import escape

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_JSON = REPO_ROOT / "local" / "credentials" / "queen-mira-staff-logins-live.json"
DEFAULT_XLSX = REPO_ROOT / "local" / "credentials" / "Queen_Mira_Staff_Login_Credentials.xlsx"

_EMP_RE = re.compile(r"^EMP-QMIS-\d{3}$")


def _col_letter(index: int) -> str:
    # 1-based Excel column letters
    result = []
    while index:
        index, rem = divmod(index - 1, 26)
        result.append(chr(65 + rem))
    return "".join(reversed(result))


def _cell(ref: str, value: str) -> str:
    return f'<c r="{ref}" t="inlineStr"><is><t>{escape(value)}</t></is></c>'


def write_xlsx(path: Path, headers: list[str], rows: list[list[str]]) -> None:
    sheet_rows = []
    header_cells = "".join(_cell(f"{_col_letter(i)}1", h) for i, h in enumerate(headers, start=1))
    sheet_rows.append(f'<row r="1">{header_cells}</row>')
    for r_index, row in enumerate(rows, start=2):
        cells = "".join(_cell(f"{_col_letter(c)}{r_index}", value) for c, value in enumerate(row, start=1))
        sheet_rows.append(f'<row r="{r_index}">{cells}</row>')
    sheet_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetData>{"".join(sheet_rows)}</sheetData></worksheet>'
    )
    workbook_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets><sheet name="Staff Logins" sheetId="1" r:id="rId1"/></sheets></workbook>'
    )
    rels_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="xl/workbook.xml"/>'
        "</Relationships>"
    )
    workbook_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
        'Target="worksheets/sheet1.xml"/>'
        "</Relationships>"
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        "</Types>"
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels_xml)
        zf.writestr("xl/workbook.xml", workbook_xml)
        zf.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
        zf.writestr("xl/worksheets/sheet1.xml", sheet_xml)
    try:
        path.chmod(0o600)
    except OSError:
        pass


def validate(accounts: list[dict]) -> dict:
    ids = [str(a.get("employeeId") or "") for a in accounts]
    emails = [str(a.get("loginUsername") or "").lower() for a in accounts]
    temps = [a.get("temporaryPassword") for a in accounts]
    return {
        "accounts": len(accounts),
        "empQmisIds": sum(1 for i in ids if _EMP_RE.match(i)),
        "uniqueEmployeeIds": len(set(ids)),
        "uniqueUsernames": len(set(emails)),
        "uniqueTemporaryPasswords": len(set(temps)),
        "duplicateEmployeeIds": sum(1 for _, n in Counter(ids).items() if n > 1),
        "duplicateUsernames": sum(1 for _, n in Counter(emails).items() if n > 1),
        "missingFields": sum(
            1
            for a in accounts
            if not a.get("employeeId")
            or not a.get("name")
            or not a.get("loginUsername")
            or not a.get("temporaryPassword")
        ),
        "mustChangePasswordTrue": sum(1 for a in accounts if a.get("mustChangePassword") is True),
        "qmisEduUsernames": sum(1 for e in emails if e.endswith("@qmis.edu")),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON)
    parser.add_argument("--xlsx", type=Path, default=DEFAULT_XLSX)
    args = parser.parse_args()

    payload = json.loads(args.json.read_text(encoding="utf-8"))
    accounts = list(payload.get("accounts") or [])
    accounts.sort(key=lambda row: str(row.get("employeeId") or ""))
    stats = validate(accounts)
    if stats["accounts"] != 100 or stats["empQmisIds"] != 100:
        raise SystemExit(f"Validation failed: expected 100 EMP-QMIS accounts, got {stats}")
    if stats["duplicateEmployeeIds"] or stats["duplicateUsernames"] or stats["missingFields"]:
        raise SystemExit(f"Validation failed: duplicates/missing fields {stats}")
    if stats["uniqueTemporaryPasswords"] != 100 or stats["mustChangePasswordTrue"] != 100:
        raise SystemExit(f"Validation failed: password/status counts {stats}")
    if stats["qmisEduUsernames"]:
        raise SystemExit("Validation failed: handoff includes @qmis.edu accounts")

    headers = [
        "Employee ID",
        "Employee Name",
        "Login Username/Email",
        "Temporary Password",
        "Account Status",
    ]
    rows: list[list[str]] = []
    for account in accounts:
        status = "Password change required" if account.get("mustChangePassword") else "Active"
        # Preserve temporary password exactly as stored in the handoff JSON.
        rows.append(
            [
                str(account.get("employeeId") or ""),
                str(account.get("name") or ""),
                str(account.get("loginUsername") or ""),
                str(account.get("temporaryPassword") or ""),
                status,
            ]
        )
    if str(args.xlsx.resolve()).find("local") < 0 or "credentials" not in args.xlsx.resolve().parts:
        raise SystemExit("Refusing to write credentials Excel outside local/credentials/")
    write_xlsx(args.xlsx, headers, rows)
    # Recount from written sheet without printing secrets: reopen zip and count rows.
    with zipfile.ZipFile(args.xlsx, "r") as zf:
        xml = zf.read("xl/worksheets/sheet1.xml").decode("utf-8")
    data_rows = xml.count("<row r=") - 1  # minus header
    print(
        json.dumps(
            {
                "source": str(args.json),
                "output": str(args.xlsx),
                "validation": stats,
                "excelDataRows": data_rows,
                "gitignoredPattern": "local/credentials/*",
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
