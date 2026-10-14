"""Render reports/daily-work-report.md to a manager-facing PDF.

Source of truth stays the markdown under reports/ (workspace rule).
PDF output lives in this documentation folder — never under reports/.
"""

from __future__ import annotations

import re
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

BASE = Path(__file__).resolve().parent
ROOT = BASE.parent
SRC_MD = ROOT / "reports" / "daily-work-report.md"
OUT_PDF = BASE / "QMIS-ERP-Daily-Work-Report.pdf"


def _escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _inline(md: str) -> str:
    text = _escape(md)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"`(.+?)`", r"<font face='Courier' size='9'>\1</font>", text)
    return text


def build_story(md: str):
    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "TitleQ",
        parent=styles["Heading1"],
        fontSize=16,
        textColor=HexColor("#111827"),
        spaceAfter=8,
        leading=20,
    )
    h2 = ParagraphStyle(
        "H2Q",
        parent=styles["Heading2"],
        fontSize=12,
        textColor=HexColor("#1f2937"),
        spaceBefore=14,
        spaceAfter=6,
        leading=16,
    )
    h3 = ParagraphStyle(
        "H3Q",
        parent=styles["Heading3"],
        fontSize=11,
        textColor=HexColor("#374151"),
        spaceBefore=10,
        spaceAfter=4,
        leading=14,
    )
    body = ParagraphStyle(
        "BodyQ",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        alignment=TA_LEFT,
        spaceAfter=4,
    )
    bullet = ParagraphStyle(
        "BulletQ",
        parent=body,
        leftIndent=14,
        bulletIndent=0,
        spaceAfter=3,
    )

    story = []
    for raw in md.splitlines():
        line = raw.rstrip()
        if not line.strip():
            story.append(Spacer(1, 3 * mm))
            continue
        if line.startswith("---"):
            story.append(Spacer(1, 2 * mm))
            continue
        if line.startswith("# "):
            story.append(Paragraph(_inline(line[2:]), title))
        elif line.startswith("## "):
            story.append(Paragraph(_inline(line[3:]), h2))
        elif line.startswith("### "):
            story.append(Paragraph(_inline(line[4:]), h3))
        elif re.match(r"^\d+\.\s", line.strip()):
            story.append(Paragraph(_inline(line.strip()), bullet))
        elif line.lstrip().startswith("- "):
            story.append(Paragraph("• " + _inline(line.lstrip()[2:]), bullet))
        else:
            story.append(Paragraph(_inline(line), body))
    return story


def main() -> None:
    if not SRC_MD.is_file():
        raise SystemExit(f"Missing source: {SRC_MD}")
    md = SRC_MD.read_text(encoding="utf-8")
    doc = SimpleDocTemplate(
        str(OUT_PDF),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title="QMIS ERP — Daily Work Report",
        author="QMIS ERP delivery",
    )
    doc.build(build_story(md))
    print("Wrote", OUT_PDF, OUT_PDF.stat().st_size)


if __name__ == "__main__":
    main()
