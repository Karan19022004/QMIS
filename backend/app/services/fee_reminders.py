"""In-app fee reminders for parents (no email or WhatsApp; school decision 2026-10-27).

Schedule:
- one reminder per unpaid instalment once it is due within the next 15 days;
- during the final month of the academic year, one weekly reminder per student summarising
  everything still outstanding.

Every reminder carries a stable key (entity_id), so running the sweep again never repeats one.
There is no background scheduler: the sweep runs when the Account Head presses "Send Reminder"
and, for their own children, whenever a parent opens the fee portal.
"""

from __future__ import annotations

import hashlib
from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FinanceRecord, Notification, Student
from app.services import finance as fin
from app.services import finance_actions as fa
from app.services.placement import current_academic_year

REMINDER_DAYS_BEFORE_DUE = 15
FINAL_MONTH_DAYS = 30
SETTLED = {"PAID", "WAIVED", "CANCELLED"}
ENTITY_TYPE = "fee_reminder"


def _digest(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:16]


def _uuid(value) -> UUID | None:
    try:
        return UUID(str(value))
    except (TypeError, ValueError):
        return None


def _add_once(db: Session, *, campus_id, user_id, key: str, title: str, body: str) -> bool:
    exists = db.scalar(
        select(Notification.id).where(
            Notification.user_id == user_id,
            Notification.entity_type == ENTITY_TYPE,
            Notification.entity_id == key,
        )
    )
    if exists is not None:
        return False
    db.add(Notification(campus_id=campus_id, user_id=user_id, title=title, body=body,
                        entity_type=ENTITY_TYPE, entity_id=key))
    return True


def run_sweep(db: Session, campus_id, *, today: date | None = None, student_ids: set[str] | None = None) -> dict:
    today = today or date.today()
    snapshot = db.scalar(
        select(FinanceRecord).where(
            FinanceRecord.campus_id == campus_id,
            FinanceRecord.collection == fin._SNAPSHOT,
            FinanceRecord.public_id == fin._SNAPSHOT_ID,
        )
    )
    data = dict(snapshot.body or {}) if snapshot else {}
    fine_rules = list(data.get("fineRules") or [])

    year = current_academic_year(db, campus_id)
    year_end = year.end_date if year and year.end_date else None
    days_left = (year_end - today).days if year_end else None
    final_month = days_left is not None and 0 <= days_left < FINAL_MONTH_DAYS

    outstanding: dict[str, list[tuple[dict, float, date | None]]] = {}
    for row in data.get("installments") or []:
        sid = str(row.get("studentId") or "")
        if not sid or (student_ids is not None and sid not in student_ids):
            continue
        if str(row.get("forcedStatus") or row.get("status") or "").upper() in SETTLED:
            continue
        _, _, balance = fa._live_payable(row, fine_rules, today)
        if balance <= 0:
            continue
        outstanding.setdefault(sid, []).append((row, balance, fa._parse_iso_date(row.get("dueDate"))))

    sent = {"dueSoon": 0, "finalMonth": 0}
    skipped_no_parent = 0
    for sid, rows in outstanding.items():
        key_id = _uuid(sid)
        student = db.get(Student, key_id) if key_id else None
        if student is None or student.campus_id != campus_id or not student.parent_user_id:
            skipped_no_parent += 1
            continue
        for row, balance, due in rows:
            if due is None or not 0 <= (due - today).days <= REMINDER_DAYS_BEFORE_DUE:
                continue
            label = row.get("installmentLabel") or row.get("feeHead") or "School fee"
            if _add_once(
                db,
                campus_id=campus_id,
                user_id=student.parent_user_id,
                key=f"due15:{_digest(str(row.get('id')))}",
                title=f"Fee due on {due:%d %b %Y}",
                body=f"{student.full_name}: {label} — {fa._inr_label(balance)} due on {due:%d %b %Y}.",
            ):
                sent["dueSoon"] += 1
        if final_month:
            total = sum(balance for _, balance, _ in rows)
            if _add_once(
                db,
                campus_id=campus_id,
                user_id=student.parent_user_id,
                key=f"final:{year_end.isoformat()}:w{days_left // 7}:{_digest(sid)}",
                title=f"Fees outstanding — academic year ends {year_end:%d %b %Y}",
                body=f"{student.full_name}: {fa._inr_label(total)} outstanding across {len(rows)} instalment(s).",
            ):
                sent["finalMonth"] += 1
    db.commit()
    return {
        "success": True,
        "sent": sent["dueSoon"] + sent["finalMonth"],
        "dueSoon": sent["dueSoon"],
        "finalMonth": sent["finalMonth"],
        "studentsWithDues": len(outstanding),
        "skippedNoParentLogin": skipped_no_parent,
        "finalMonthActive": final_month,
        "academicYearEnd": year_end.isoformat() if year_end else None,
    }
