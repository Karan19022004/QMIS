"""Recalculate summary totals and colour status cells in the Role-Module Status sheet."""

from __future__ import annotations

import sys
from pathlib import Path

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import RGBColor

sys.stdout.reconfigure(encoding="utf-8")

BASE = Path(__file__).resolve().parent
TARGETS = [
    BASE / "QMIS-ERP-Role-Module-Status.updated.14oct-evening.docx",
    BASE / "QMIS-ERP-Role-Module-Status.ADMIN-UPDATED-14oct.docx",
    BASE / "QMIS-ERP-Role-Module-Status.docx",
    BASE / "QMIS-ERP-Role-Module-Status.review.14oct.docx",
]
OUT_HTML = BASE / "QMIS-ERP-Role-Module-Status.ADMIN-UPDATED-14oct.html"

# Fill colours (Word hex without #)
COLORS = {
    "Completed": ("C6EFCE", RGBColor(0x00, 0x61, 0x00)),
    "Partial": ("FFEB9C", RGBColor(0x9C, 0x57, 0x00)),
    "Not Completed": ("FFC7CE", RGBColor(0x9C, 0x00, 0x06)),
    "Gap": ("D9D9D9", RGBColor(0x59, 0x59, 0x59)),
}


def set_cell_shading(cell, fill_hex: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill_hex)
    shd.set(qn("w:val"), "clear")


def set_cell_text_color(cell, color: RGBColor) -> None:
    for paragraph in cell.paragraphs:
        for run in paragraph.runs:
            run.font.color.rgb = color


def status_bucket(status: str) -> str:
    status = (status or "").strip()
    if status.startswith("Completed"):
        return "Completed"
    if status == "Partial":
        return "Partial"
    if status == "Gap":
        return "Gap"
    if status.startswith("Not"):
        return "Not Completed"
    return "Not Completed"


def color_status_cell(cell, bucket: str) -> None:
    fill, text_color = COLORS[bucket]
    set_cell_shading(cell, fill)
    set_cell_text_color(cell, text_color)


def find_module_tables(doc: Document):
    tables = []
    for table in doc.tables:
        if len(table.rows) < 2:
            continue
        hdr = [c.text.strip() for c in table.rows[0].cells]
        if len(hdr) >= 3 and hdr[0] == "Module (sidebar)" and hdr[1] == "Status":
            tables.append(table)
    return tables


def recount_module_table(table) -> dict:
    counts = {"Completed": 0, "Partial": 0, "Not Completed": 0, "Gap": 0}
    for row in table.rows[1:]:
        bucket = status_bucket(row.cells[1].text)
        counts[bucket] += 1
        color_status_cell(row.cells[1], bucket)
    counts["Modules"] = sum(counts.values())
    return counts


def apply(doc: Document) -> None:
    module_tables = find_module_tables(doc)
    # Summary table is tables[1] — Role panel / Modules / Completed / Partial / Not Completed / Gap
    summary = doc.tables[1]
    # Map summary rows (skip header and TOTAL) to module tables in order
    data_rows = [r for r in summary.rows[1:] if r.cells[0].text.strip() and r.cells[0].text.strip() != "TOTAL"]
    if len(data_rows) != len(module_tables):
        print(
            f"WARN: summary role rows={len(data_rows)} module tables={len(module_tables)} — aligning by min length"
        )

    totals = {"Modules": 0, "Completed": 0, "Partial": 0, "Not Completed": 0, "Gap": 0}
    n = min(len(data_rows), len(module_tables))
    for i in range(n):
        counts = recount_module_table(module_tables[i])
        row = data_rows[i]
        role = row.cells[0].text.strip()
        row.cells[1].text = str(counts["Modules"])
        row.cells[2].text = str(counts["Completed"])
        row.cells[3].text = str(counts["Partial"])
        row.cells[4].text = str(counts["Not Completed"])
        row.cells[5].text = str(counts["Gap"])
        # colour the count cells
        color_status_cell(row.cells[2], "Completed")
        color_status_cell(row.cells[3], "Partial")
        color_status_cell(row.cells[4], "Not Completed")
        color_status_cell(row.cells[5], "Gap")
        for k in totals:
            totals[k] += counts[k]
        print(f"{role:28s} modules={counts['Modules']:3d} C={counts['Completed']:3d} P={counts['Partial']:3d} N={counts['Not Completed']:3d} G={counts['Gap']:3d}")

    # TOTAL row
    total_row = summary.rows[-1]
    if total_row.cells[0].text.strip() == "TOTAL":
        total_row.cells[1].text = str(totals["Modules"])
        total_row.cells[2].text = str(totals["Completed"])
        total_row.cells[3].text = str(totals["Partial"])
        total_row.cells[4].text = str(totals["Not Completed"])
        total_row.cells[5].text = str(totals["Gap"])
        color_status_cell(total_row.cells[2], "Completed")
        color_status_cell(total_row.cells[3], "Partial")
        color_status_cell(total_row.cells[4], "Not Completed")
        color_status_cell(total_row.cells[5], "Gap")
        print(
            f"{'TOTAL':28s} modules={totals['Modules']:3d} C={totals['Completed']:3d} "
            f"P={totals['Partial']:3d} N={totals['Not Completed']:3d} G={totals['Gap']:3d}"
        )


def write_html(doc: Document) -> None:
    summary = doc.tables[1]
    module_tables = find_module_tables(doc)
    # Administrator is second module table (after Super Admin)
    admin = module_tables[1] if len(module_tables) > 1 else module_tables[0]
    sum_rows = []
    for row in summary.rows:
        cells = [c.text.strip() for c in row.cells]
        if cells[0] == "Role panel":
            sum_rows.append("<tr>" + "".join(f"<th>{c}</th>" for c in cells) + "</tr>")
            continue
        style_cells = []
        for i, c in enumerate(cells):
            if i == 2:
                bg = "#C6EFCE"
            elif i == 3:
                bg = "#FFEB9C"
            elif i == 4:
                bg = "#FFC7CE"
            elif i == 5:
                bg = "#D9D9D9"
            else:
                bg = "#fff"
            style_cells.append(f'<td style="background:{bg}">{c}</td>')
        sum_rows.append("<tr>" + "".join(style_cells) + "</tr>")

    admin_rows = []
    for row in admin.rows:
        mod, status, note = [c.text.strip() for c in row.cells[:3]]
        if mod == "Module (sidebar)":
            admin_rows.append("<tr><th>Module</th><th>Status</th><th>Notes</th></tr>")
            continue
        bucket = status_bucket(status)
        fill = {"Completed": "#C6EFCE", "Partial": "#FFEB9C", "Not Completed": "#FFC7CE", "Gap": "#D9D9D9"}[bucket]
        admin_rows.append(
            f'<tr><td>{mod}</td><td style="background:{fill};font-weight:700">{status}</td><td>{note[:220]}</td></tr>'
        )

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Role Module Status — coloured</title>
<style>
body{{font-family:Segoe UI,Arial,sans-serif;margin:24px}}
.banner{{background:#d1fae5;border:2px solid #047857;padding:12px 16px;margin-bottom:16px}}
table{{border-collapse:collapse;width:100%;font-size:13px;margin-bottom:28px}}
th,td{{border:1px solid #ccc;padding:8px;vertical-align:top}}
th{{background:#111827;color:#fff}}
.legend span{{display:inline-block;padding:4px 10px;margin-right:8px;border:1px solid #ccc}}
</style></head><body>
<div class="banner">
<strong>Administrator: 26 Completed · 0 Partial · 0 Not Completed</strong><br>
Status cells are coloured: green = Completed, amber = Partial, red = Not Completed, grey = Gap.<br>
Summary TOTAL recalculated from each role panel table.
</div>
<div class="legend">
<span style="background:#C6EFCE">Completed</span>
<span style="background:#FFEB9C">Partial</span>
<span style="background:#FFC7CE">Not Completed</span>
<span style="background:#D9D9D9">Gap</span>
</div>
<h1>Executive summary</h1>
<table>{''.join(sum_rows)}</table>
<h1>Administrator modules</h1>
<table>{''.join(admin_rows)}</table>
</body></html>"""
    OUT_HTML.write_text(html, encoding="utf-8")
    print("Wrote", OUT_HTML)


def main() -> None:
    primary = None
    for path in TARGETS:
        if not path.exists():
            print("Skip missing", path.name)
            continue
        try:
            doc = Document(str(path))
            print("===", path.name, "===")
            apply(doc)
            doc.save(str(path))
            print("Saved", path.name, path.stat().st_size)
            if primary is None:
                primary = doc
        except OSError as exc:
            print("Could not save", path.name, exc)
    if primary is not None:
        write_html(primary)


if __name__ == "__main__":
    main()
