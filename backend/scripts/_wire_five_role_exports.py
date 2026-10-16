"""Wire bare ExportModal usages in the five demo roles when a list variable exists."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROLE_GLOBS = [
    "src/Pages/Teacher/**/*.jsx",
    "src/Pages/Principal/**/*.jsx",
    "src/Pages/Admin/**/*.jsx",
    "src/Pages/FrontOffice/**/*.jsx",
    "src/Pages/HR/**/*.jsx",
]

BARE = "<ExportModal exportModal={exportModal} setExportModal={setExportModal} />"
VAR_CANDIDATES = (
    "filteredRecords",
    "filteredRequests",
    "filteredRows",
    "filteredEmployees",
    "filteredAnnouncements",
    "filteredTasks",
    "filtered",
    "displayRows",
    "visibleRecords",
    "visible",
    "assignedClasses",
    "rows",
    "records",
    "students",
    "employees",
    "documents",
)


def find_files() -> list[Path]:
    files: list[Path] = []
    for pattern in ROLE_GLOBS:
        files.extend(ROOT.glob(pattern))
    return sorted({p.resolve() for p in files if p.is_file()})


def pick_var(text: str) -> str | None:
    for name in VAR_CANDIDATES:
        if re.search(rf"\bconst\s+{name}\b|\b{name}\s*=", text):
            return name
    # Prefer UPPER_SNAKE arrays that are mapped in the table body (demo seed lists).
    constants = re.findall(r"\{([A-Z][A-Z0-9_]*)\.map\(", text)
    skip = {"CLASSES", "SECTIONS", "SUBJECTS", "GENDERS", "STATUS_OPTIONS", "ATTENDANCE_STATUSES", "STATUSES"}
    for name in constants:
        if name not in skip and f"const {name}" in text or f"export const {name}" in text or name in text:
            if name not in skip:
                return name
    # imported demo arrays used as SOURCE.map
    for m in re.finditer(r"\b([A-Z][A-Z0-9_]{3,})\.map\(", text):
        name = m.group(1)
        if name not in skip:
            return name
    return None


def main() -> None:
    ok = miss = skip = 0
    for path in find_files():
        text = path.read_text(encoding="utf-8")
        if BARE not in text:
            skip += 1
            continue
        var = pick_var(text)
        if not var:
            print("MISS", path.relative_to(ROOT))
            miss += 1
            continue
        fname = re.sub(r"(?<!^)(?=[A-Z])", "-", path.stem).lower()
        replacement = f"""<ExportModal
                exportModal={{exportModal}}
                setExportModal={{setExportModal}}
                filename='{fname}'
                rows={{Array.isArray({var}) ? {var} : []}}
                exportDescription={{<>You are exporting {{Array.isArray({var}) ? {var}.length : 0}} record(s).</>}}
            />"""
        path.write_text(text.replace(BARE, replacement, 1), encoding="utf-8")
        print("OK", path.relative_to(ROOT), "->", var)
        ok += 1
    print(f"DONE ok={ok} miss={miss} skip={skip}")


if __name__ == "__main__":
    main()
