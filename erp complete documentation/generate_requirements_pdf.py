"""Builds "erp complete documentation/QMIS-ERP-Requirements.pdf" from backend/docs/REQUIREMENTS.md.

Run from anywhere:  python "erp complete documentation/generate_requirements_pdf.py"
Handles: # / ## headings, paragraphs, numbered lists, pipe tables, **bold**, `code`, --- rules.
"""

import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "backend" / "docs" / "REQUIREMENTS.md"
TARGET = Path(__file__).resolve().parent / "QMIS-ERP-Requirements.pdf"

INK = colors.HexColor("#1D2939")
MUTED = colors.HexColor("#667085")
BRAND = colors.HexColor("#515DEF")
HEADER_BG = colors.HexColor("#EDEEF5")
LINE = colors.HexColor("#D0D5DD")

STATUS_COLORS = {
    "Needed": colors.HexColor("#B54708"),
    "Blocked": colors.HexColor("#B42318"),
    "Built": colors.HexColor("#027A48"),
}

styles = getSampleStyleSheet()
BODY = ParagraphStyle("body", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.5, leading=13, textColor=INK, alignment=TA_LEFT)
TITLE = ParagraphStyle("title", parent=BODY, fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=BRAND, spaceAfter=6)
H2 = ParagraphStyle("h2", parent=BODY, fontName="Helvetica-Bold", fontSize=13, leading=17, textColor=INK, spaceBefore=14, spaceAfter=6)
LABEL = ParagraphStyle("label", parent=BODY, fontName="Helvetica-Bold", fontSize=10, leading=13, spaceBefore=8, spaceAfter=3)
CELL = ParagraphStyle("cell", parent=BODY, fontSize=8.3, leading=10.6)
CELL_HEAD = ParagraphStyle("cellhead", parent=CELL, fontName="Helvetica-Bold", textColor=colors.HexColor("#0C1E5B"))
ITEM = ParagraphStyle("item", parent=BODY, leftIndent=14, firstLineIndent=-14, spaceAfter=3)


def inline(text: str) -> str:
    """Escape for reportlab, then turn **bold** and `code` into tags."""
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"`(.+?)`", r"<font name='Courier' size='8'>\1</font>", text)
    return text


def status_cell(text: str):
    """Colour the first status word (Needed / Blocked / Built) in the Status column."""
    for word, color in STATUS_COLORS.items():
        if text.startswith(word):
            return Paragraph(f"<font color='{color.hexval()}'><b>{inline(text)}</b></font>", CELL)
    return Paragraph(inline(text), CELL)


def build_table(rows: list[list[str]], width: float):
    header, body = rows[0], rows[1:]
    status_idx = header.index("Status") if "Status" in header else -1

    weights = []
    for i, _ in enumerate(header):
        longest = max(len(r[i]) for r in rows if i < len(r))
        avg = sum(len(r[i]) for r in rows if i < len(r)) / len(rows)
        weights.append(max(6, min(60, 0.6 * avg + 0.4 * min(longest, 60))))
    weights[0] = 5  # the number column stays narrow
    total = sum(weights)
    col_widths = [width * w / total for w in weights]

    data = [[Paragraph(inline(c), CELL_HEAD) for c in header]]
    for row in body:
        row = row + [""] * (len(header) - len(row))
        data.append([
            status_cell(c) if i == status_idx else Paragraph(inline(c), CELL)
            for i, c in enumerate(row)
        ])
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
    ]))
    return table


def parse(lines: list[str], width: float):
    story = []
    i = 0
    paragraph: list[str] = []

    def flush():
        if paragraph:
            story.append(Paragraph(inline(" ".join(paragraph)), BODY))
            story.append(Spacer(1, 4))
            paragraph.clear()

    while i < len(lines):
        line = lines[i].rstrip()
        if not line.strip():
            flush()
        elif line.startswith("# "):
            flush()
            story.append(Paragraph(inline(line[2:]), TITLE))
        elif line.startswith("## "):
            flush()
            story.append(Paragraph(inline(line[3:]), H2))
            story.append(HRFlowable(width="100%", thickness=0.6, color=LINE, spaceAfter=4))
        elif line.strip() == "---":
            flush()
        elif line.startswith("|"):
            flush()
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{2,}:?", c) for c in cells):
                    rows.append(cells)
                i += 1
            story.append(build_table(rows, width))
            story.append(Spacer(1, 6))
            continue
        elif re.match(r"^\d+\.\s", line):
            flush()
            story.append(Paragraph(inline(line), ITEM))
        elif re.fullmatch(r"\*\*[^*]+\*\*", line.strip()):
            flush()
            story.append(Paragraph(inline(line.strip()), LABEL))
        else:
            paragraph.append(line.strip())
        i += 1
    flush()
    return story


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(doc.leftMargin, 8 * mm, "QMIS School ERP - Requirements")
    canvas.drawRightString(doc.pagesize[0] - doc.rightMargin, 8 * mm, f"Page {doc.page}")
    canvas.restoreState()


def main() -> None:
    page = landscape(A4)
    doc = SimpleDocTemplate(
        str(TARGET),
        pagesize=page,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=16 * mm,
        title="QMIS School ERP - Requirements",
        author="QMIS ERP development team",
    )
    width = page[0] - doc.leftMargin - doc.rightMargin
    story = parse(SOURCE.read_text(encoding="utf-8").splitlines(), width)
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(f"wrote {TARGET} ({TARGET.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
