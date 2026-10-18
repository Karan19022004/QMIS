#!/usr/bin/env python3
"""Build QMIS-ERP-Module-Flow-Test-Guide.pdf from the Markdown guide."""

from __future__ import annotations

import re
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
)

ROOT = Path(__file__).resolve().parent
MD = ROOT / "QMIS-ERP-Module-Flow-Test-Guide.md"
OUT = ROOT / "QMIS-ERP-Module-Flow-Test-Guide.pdf"
OUT_DOCS = ROOT.parent / "erp complete documentation" / "QMIS-ERP-Module-Flow-Test-Guide.pdf"


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "MFTitle", parent=base["Title"], fontSize=15, spaceAfter=8, textColor=colors.HexColor("#101828")
        ),
        "h1": ParagraphStyle(
            "MFH1", parent=base["Heading1"], fontSize=12, spaceBefore=12, spaceAfter=5, textColor=colors.HexColor("#101828")
        ),
        "h2": ParagraphStyle(
            "MFH2", parent=base["Heading2"], fontSize=10.5, spaceBefore=8, spaceAfter=3, textColor=colors.HexColor("#344054")
        ),
        "h3": ParagraphStyle(
            "MFH3", parent=base["Heading3"], fontSize=9.5, spaceBefore=6, spaceAfter=2, textColor=colors.HexColor("#475467")
        ),
        "body": ParagraphStyle(
            "MFBody", parent=base["BodyText"], fontSize=8.5, leading=11, alignment=TA_LEFT, spaceAfter=3
        ),
        "code": ParagraphStyle(
            "MFCode",
            parent=base["Code"],
            fontSize=7.5,
            leading=9,
            backColor=colors.HexColor("#F2F4F7"),
            spaceBefore=2,
            spaceAfter=4,
        ),
    }


def _esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("`", "")
    )


def _inline(text: str) -> str:
    text = _esc(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    return text


def build(md_path: Path, out_path: Path) -> None:
    styles = _styles()
    story = []
    in_code = False
    code_buf: list[str] = []
    list_buf: list[str] = []

    def flush_list():
        nonlocal list_buf
        if not list_buf:
            return
        items = [ListItem(Paragraph(_inline(x), styles["body"]), leftIndent=8) for x in list_buf]
        story.append(ListFlowable(items, bulletType="bullet", start="•"))
        story.append(Spacer(1, 2 * mm))
        list_buf = []

    def flush_code():
        nonlocal code_buf, in_code
        if not code_buf:
            in_code = False
            return
        story.append(Paragraph("<br/>".join(_esc(l) for l in code_buf), styles["code"]))
        code_buf = []
        in_code = False

    for raw in md_path.read_text(encoding="utf-8").splitlines():
        line = raw.rstrip()
        if line.startswith("```"):
            if in_code:
                flush_code()
            else:
                flush_list()
                in_code = True
                code_buf = []
            continue
        if in_code:
            code_buf.append(line)
            continue
        if not line.strip():
            flush_list()
            continue
        if line.startswith("# "):
            flush_list()
            story.append(Paragraph(_inline(line[2:]), styles["title"]))
        elif line.startswith("## "):
            flush_list()
            if story:
                story.append(PageBreak())
            story.append(Paragraph(_inline(line[3:]), styles["h1"]))
        elif line.startswith("### "):
            flush_list()
            story.append(Paragraph(_inline(line[4:]), styles["h2"]))
        elif line.startswith("#### "):
            flush_list()
            story.append(Paragraph(_inline(line[5:]), styles["h3"]))
        elif line.startswith("|") or line.startswith("---"):
            flush_list()
            if line.startswith("|") and not set(line.replace("|", "").strip()) <= {"-", ":", " "}:
                story.append(Paragraph(_inline(line.replace("|", " · ")), styles["body"]))
        elif line.lstrip().startswith(("- ", "* ")):
            list_buf.append(line.lstrip()[2:])
        elif re.match(r"^\d+\.\s+", line.lstrip()):
            list_buf.append(re.sub(r"^\d+\.\s+", "", line.lstrip()))
        else:
            flush_list()
            story.append(Paragraph(_inline(line), styles["body"]))

    flush_list()
    flush_code()

    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
        title="QMIS ERP Module Flow Test Guide",
    )
    doc.build(story)
    print(f"Wrote {out_path}")


def main() -> None:
    build(MD, OUT)
    OUT_DOCS.parent.mkdir(parents=True, exist_ok=True)
    OUT_DOCS.write_bytes(OUT.read_bytes())
    print(f"Wrote {OUT_DOCS}")


if __name__ == "__main__":
    main()
