#!/usr/bin/env python3
"""Build QMIS-ERP-Full-Panel-Test-Guide.pdf (+ Hierarchy twin) from the Markdown guide."""

from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parent
MD = ROOT / "QMIS-ERP-Full-Panel-Test-Guide.md"
OUT = ROOT / "QMIS-ERP-Full-Panel-Test-Guide.pdf"
OUT_HIER = ROOT / "QMIS-ERP-Full-Panel-Test-Guide-Hierarchy.pdf"
OUT_DOCS = ROOT.parent / "erp complete documentation" / "QMIS-ERP-Full-Panel-Test-Guide.pdf"


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "TitleCustom",
            parent=base["Title"],
            fontSize=16,
            spaceAfter=8,
            textColor=colors.HexColor("#101828"),
        ),
        "h1": ParagraphStyle(
            "H1Custom",
            parent=base["Heading1"],
            fontSize=13,
            spaceBefore=14,
            spaceAfter=6,
            textColor=colors.HexColor("#101828"),
        ),
        "h2": ParagraphStyle(
            "H2Custom",
            parent=base["Heading2"],
            fontSize=11,
            spaceBefore=10,
            spaceAfter=4,
            textColor=colors.HexColor("#344054"),
        ),
        "h3": ParagraphStyle(
            "H3Custom",
            parent=base["Heading3"],
            fontSize=10,
            spaceBefore=8,
            spaceAfter=3,
            textColor=colors.HexColor("#475467"),
        ),
        "body": ParagraphStyle(
            "BodyCustom",
            parent=base["BodyText"],
            fontSize=9,
            leading=12,
            alignment=TA_LEFT,
            spaceAfter=4,
        ),
        "code": ParagraphStyle(
            "CodeCustom",
            parent=base["Code"],
            fontSize=8,
            leading=10,
            backColor=colors.HexColor("#F2F4F7"),
            spaceBefore=2,
            spaceAfter=6,
        ),
        "li": ParagraphStyle(
            "LiCustom",
            parent=base["BodyText"],
            fontSize=9,
            leading=11,
            leftIndent=4,
        ),
    }


def _escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def md_to_flowables(md_text: str, styles: dict):
    story = []
    lines = md_text.splitlines()
    i = 0
    pending_list: list[str] = []
    table_rows: list[list[str]] = []

    def flush_list():
        nonlocal pending_list
        if not pending_list:
            return
        items = [
            ListItem(Paragraph(_escape(item), styles["li"]), leftIndent=12)
            for item in pending_list
        ]
        story.append(ListFlowable(items, bulletType="bullet", start="•"))
        story.append(Spacer(1, 4))
        pending_list = []

    def flush_table():
        nonlocal table_rows
        if not table_rows:
            return
        data = [[Paragraph(_escape(c), styles["body"]) for c in row] for row in table_rows]
        table = Table(data, hAlign="LEFT", colWidths=[90, 160, 160][: len(data[0])])
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EAECF0")),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D0D5DD")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ]
            )
        )
        story.append(table)
        story.append(Spacer(1, 6))
        table_rows = []

    in_code = False
    code_buf: list[str] = []

    while i < len(lines):
        line = lines[i]
        if line.strip().startswith("```"):
            flush_list()
            flush_table()
            if not in_code:
                in_code = True
                code_buf = []
            else:
                story.append(Paragraph(_escape("\n".join(code_buf)).replace("\n", "<br/>"), styles["code"]))
                in_code = False
            i += 1
            continue
        if in_code:
            code_buf.append(line)
            i += 1
            continue

        if line.startswith("|") and "|" in line[1:]:
            flush_list()
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if all(set(c) <= {"-", ":", " "} for c in cells):
                i += 1
                continue
            table_rows.append(cells)
            i += 1
            # peek next
            if i >= len(lines) or not lines[i].startswith("|"):
                flush_table()
            continue
        else:
            flush_table()

        if not line.strip():
            flush_list()
            i += 1
            continue
        if line.startswith("# "):
            flush_list()
            story.append(Paragraph(_escape(line[2:].strip()), styles["title"]))
        elif line.startswith("## "):
            flush_list()
            story.append(Paragraph(_escape(line[3:].strip()), styles["h1"]))
        elif line.startswith("### "):
            flush_list()
            story.append(Paragraph(_escape(line[4:].strip()), styles["h2"]))
        elif line.startswith("---"):
            flush_list()
            story.append(Spacer(1, 6))
        elif line.lstrip().startswith("- ") or line.lstrip().startswith("* "):
            pending_list.append(line.lstrip()[2:].strip())
        elif line.lstrip()[:3].rstrip(".").isdigit() and ". " in line.lstrip()[:4]:
            # numbered list line like "1. text"
            flush_list()
            story.append(Paragraph(_escape(line.strip()), styles["body"]))
        else:
            flush_list()
            story.append(Paragraph(_escape(line.strip()), styles["body"]))
        i += 1

    flush_list()
    flush_table()
    return story


def build(path: Path, hierarchy_title: bool = False) -> None:
    styles = _styles()
    md = MD.read_text(encoding="utf-8")
    doc = SimpleDocTemplate(
        str(path),
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title="QMIS ERP Full Panel Test Guide",
    )
    story = []
    if hierarchy_title:
        story.append(Paragraph("QMIS ERP — Full Panel Test Guide (Hierarchy)", styles["title"]))
        story.append(
            Paragraph(
                "Same content as the main guide — use this copy for manager walkthroughs in role order.",
                styles["body"],
            )
        )
        story.append(Spacer(1, 6))
    story.extend(md_to_flowables(md, styles))
    story.append(PageBreak())
    story.append(Paragraph("Quick pass criteria", styles["h1"]))
    story.append(
        Paragraph(
            "Pass = HTTP 200 from campus API, data survives hard refresh, and the next role in the hierarchy can observe the change. Biometric and Phase 3 Ops/Audit failures are out of scope for this guide.",
            styles["body"],
        )
    )
    doc.build(story)
    print("Wrote", path)


def main() -> None:
    build(OUT, hierarchy_title=False)
    build(OUT_HIER, hierarchy_title=True)
    if OUT_DOCS.parent.exists():
        OUT_DOCS.write_bytes(OUT.read_bytes())
        print("Wrote", OUT_DOCS)


if __name__ == "__main__":
    main()
