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
    KeepTogether,
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

PAGE_W, PAGE_H = A4
LEFT_M = 14 * mm
RIGHT_M = 14 * mm
TOP_M = 12 * mm
BOTTOM_M = 12 * mm
USABLE_W = PAGE_W - LEFT_M - RIGHT_M


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "TitleCustom",
            parent=base["Title"],
            fontSize=15,
            spaceAfter=8,
            textColor=colors.HexColor("#101828"),
        ),
        "h1": ParagraphStyle(
            "H1Custom",
            parent=base["Heading1"],
            fontSize=12,
            spaceBefore=12,
            spaceAfter=5,
            textColor=colors.HexColor("#101828"),
        ),
        "h2": ParagraphStyle(
            "H2Custom",
            parent=base["Heading2"],
            fontSize=10.5,
            spaceBefore=9,
            spaceAfter=3,
            textColor=colors.HexColor("#344054"),
        ),
        "h3": ParagraphStyle(
            "H3Custom",
            parent=base["Heading3"],
            fontSize=9.5,
            spaceBefore=7,
            spaceAfter=2,
            textColor=colors.HexColor("#475467"),
        ),
        "body": ParagraphStyle(
            "BodyCustom",
            parent=base["BodyText"],
            fontSize=9,
            leading=12,
            alignment=TA_LEFT,
            spaceAfter=4,
            wordWrap="CJK",
        ),
        "cell": ParagraphStyle(
            "CellCustom",
            parent=base["BodyText"],
            fontSize=7.5,
            leading=9.5,
            alignment=TA_LEFT,
            spaceAfter=0,
            wordWrap="CJK",
        ),
        "cellHead": ParagraphStyle(
            "CellHeadCustom",
            parent=base["BodyText"],
            fontSize=7.5,
            leading=9.5,
            alignment=TA_LEFT,
            spaceAfter=0,
            textColor=colors.HexColor("#101828"),
            fontName="Helvetica-Bold",
            wordWrap="CJK",
        ),
        "cardTitle": ParagraphStyle(
            "CardTitleCustom",
            parent=base["BodyText"],
            fontSize=8.5,
            leading=11,
            spaceAfter=2,
            textColor=colors.HexColor("#101828"),
            fontName="Helvetica-Bold",
            wordWrap="CJK",
        ),
        "cardBody": ParagraphStyle(
            "CardBodyCustom",
            parent=base["BodyText"],
            fontSize=8,
            leading=10.5,
            spaceAfter=1,
            wordWrap="CJK",
        ),
        "code": ParagraphStyle(
            "CodeCustom",
            parent=base["Code"],
            fontSize=7.5,
            leading=9.5,
            backColor=colors.HexColor("#F2F4F7"),
            spaceBefore=2,
            spaceAfter=6,
            wordWrap="CJK",
        ),
        "li": ParagraphStyle(
            "LiCustom",
            parent=base["BodyText"],
            fontSize=9,
            leading=11,
            leftIndent=4,
            wordWrap="CJK",
        ),
    }


def _escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _soft_break_long(text: str) -> str:
    """Help ReportLab wrap long paths / emails without overflowing."""
    import re

    def break_token(m: re.Match) -> str:
        tok = m.group(0)
        if len(tok) < 28:
            return tok
        # Prefer breaks at / _ - .
        out = []
        buf = []
        for ch in tok:
            buf.append(ch)
            if ch in "/_-." and len(buf) >= 8:
                out.append("".join(buf) + "&#8203;")
                buf = []
        out.append("".join(buf))
        return "".join(out)

    return re.sub(r"[^\s]{28,}", break_token, text)


def _inline_md(text: str) -> str:
    """Minimal markdown → reportlab: **bold** and `code`. Never pass raw HTML in."""
    import re

    s = _escape(text)
    s = _soft_break_long(s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"`(.+?)`", r"<font face='Courier' size='7'>\1</font>", s)
    return s


def _labeled(label: str, value: str) -> str:
    """Safe labeled line: bold label + escaped value (value may contain md)."""
    return f"<b>{_escape(label)}:</b> {_inline_md(value)}"


def _col_widths(ncols: int) -> list[float]:
    """Proportional widths that always sum to USABLE_W."""
    if ncols <= 0:
        return []
    if ncols == 1:
        return [USABLE_W]
    if ncols == 2:
        weights = [0.28, 0.72]
    elif ncols == 3:
        weights = [0.18, 0.32, 0.50]
    elif ncols == 4:
        weights = [0.08, 0.14, 0.28, 0.50]
    elif ncols == 5:
        weights = [0.07, 0.12, 0.22, 0.32, 0.27]
    elif ncols == 6:
        # # Who Screen Do Created Next
        weights = [0.06, 0.10, 0.18, 0.28, 0.20, 0.18]
    else:
        weights = [1.0 / ncols] * ncols
    total = sum(weights)
    return [USABLE_W * (w / total) for w in weights]


def _is_journey_step_table(headers: list[str]) -> bool:
    joined = " ".join(h.lower() for h in headers)
    return ("do this" in joined or "do" == headers[-1].lower()) and (
        "who" in joined or "screen" in joined
    )


def _render_step_cards(headers: list[str], rows: list[list[str]], styles: dict) -> list:
    """Wide journey tables → one card per step so nothing clips."""
    flow = []
    # normalize header keys
    keys = [h.strip() for h in headers]
    for row in rows:
        cells = list(row) + [""] * max(0, len(keys) - len(row))
        cells = cells[: len(keys)]
        data = {keys[i]: cells[i] for i in range(len(keys))}

        step = data.get("#") or data.get("No") or ""
        who = data.get("Who") or ""
        screen = data.get("Screen (module)") or data.get("Screen") or data.get("Topic") or ""
        do = data.get("Do this") or data.get("Do") or ""
        created = (
            data.get("What is created")
            or data.get("Created")
            or data.get("Reflects")
            or ""
        )
        nxt = (
            data.get("Who uses it next")
            or data.get("Next")
            or data.get("When access exists")
            or data.get("Note")
            or ""
        )

        title_bits = []
        if step:
            title_bits.append(f"Step {step}")
        if who:
            title_bits.append(who)
        if screen:
            title_bits.append(screen)
        title = " · ".join(title_bits) if title_bits else "Step"

        lines = [Paragraph(_inline_md(title), styles["cardTitle"])]
        if do:
            lines.append(Paragraph(_labeled("Do", do), styles["cardBody"]))
        if created:
            lines.append(Paragraph(_labeled("Creates", created), styles["cardBody"]))
        if nxt:
            lines.append(Paragraph(_labeled("Next", nxt), styles["cardBody"]))

        # leftover columns not mapped above
        known = {
            "#",
            "No",
            "Who",
            "Screen (module)",
            "Screen",
            "Topic",
            "Do this",
            "Do",
            "What is created",
            "Created",
            "Reflects",
            "Who uses it next",
            "Next",
            "When access exists",
            "Note",
        }
        for k, v in data.items():
            if k in known or not v:
                continue
            lines.append(Paragraph(_labeled(k, v), styles["cardBody"]))

        inner = Table([[lines]], colWidths=[USABLE_W])
        inner.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F9FAFB")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D0D5DD")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        flow.append(KeepTogether([inner, Spacer(1, 5)]))
    return flow


def _render_grid_table(headers: list[str], rows: list[list[str]], styles: dict):
    ncols = len(headers)
    widths = _col_widths(ncols)
    data = [[Paragraph(_inline_md(c), styles["cellHead"]) for c in headers]]
    for row in rows:
        cells = list(row) + [""] * max(0, ncols - len(row))
        data.append([Paragraph(_inline_md(c), styles["cell"]) for c in cells[:ncols]])

    table = Table(data, hAlign="LEFT", colWidths=widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EAECF0")),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D0D5DD")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return table


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
            ListItem(Paragraph(_inline_md(item), styles["li"]), leftIndent=12)
            for item in pending_list
        ]
        story.append(ListFlowable(items, bulletType="bullet", start="•"))
        story.append(Spacer(1, 4))
        pending_list = []

    def flush_table():
        nonlocal table_rows
        if not table_rows:
            return
        headers = table_rows[0]
        body = table_rows[1:]
        # Prefer cards for wide journey tables; grid for compact lookup tables
        if len(headers) >= 5 or _is_journey_step_table(headers):
            story.extend(_render_step_cards(headers, body, styles))
        else:
            story.append(_render_grid_table(headers, body, styles))
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
                story.append(
                    Paragraph(
                        _escape("\n".join(code_buf)).replace("\n", "<br/>"),
                        styles["code"],
                    )
                )
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
            if i >= len(lines) or not lines[i].startswith("|"):
                flush_table()
            continue

        flush_table()

        if not line.strip():
            flush_list()
            i += 1
            continue
        if line.startswith("# "):
            flush_list()
            story.append(Paragraph(_inline_md(line[2:].strip()), styles["title"]))
        elif line.startswith("## "):
            flush_list()
            story.append(Paragraph(_inline_md(line[3:].strip()), styles["h1"]))
        elif line.startswith("### "):
            flush_list()
            story.append(Paragraph(_inline_md(line[4:].strip()), styles["h2"]))
        elif line.startswith("---"):
            flush_list()
            story.append(Spacer(1, 6))
        elif line.lstrip().startswith("- ") or line.lstrip().startswith("* "):
            pending_list.append(line.lstrip()[2:].strip())
        else:
            flush_list()
            story.append(Paragraph(_inline_md(line.strip()), styles["body"]))
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
        leftMargin=LEFT_M,
        rightMargin=RIGHT_M,
        topMargin=TOP_M,
        bottomMargin=BOTTOM_M,
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
            "Pass = HTTP 200 from campus API, data survives hard refresh, and the next role in the hierarchy can observe the change. "
            "Biometric live device import and ProTrack Open API enablement are external to this guide.",
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
