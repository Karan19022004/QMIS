"""Who still refers to a class or a section.

Classes are linked to other records by NAME TEXT, not by a foreign key (students, admissions,
enquiries, exams, exam weightages, lesson plans, attendance). The database therefore cannot stop a
class from being deleted or a section from being renamed underneath them, so the API asks here first.

Everything is scoped to one campus. Matching ignores case. The class name is shared by every
academic year (the rows only carry the text), so a class is also "in use" when the SAME NAME is used
by another year's records. That errs on the safe side: it can refuse a delete that would have been
harmless, never allow one that would orphan a record.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Base

# (table, label used in the message). Every table has campus_id and class_name.
_CLASS_NAME_TABLES = (
    ("students", "student(s)"),
    ("admissions", "admission(s)"),
    ("admission_enquiries", "admission enquiry(ies)"),
    ("exams", "exam(s)"),
    ("exam_weightages", "exam weightage(s)"),
    ("lesson_plans", "lesson plan(s)"),
    ("student_attendance", "attendance record(s)"),
)


def _count(db: Session, table_name: str, *conditions) -> int:
    table = Base.metadata.tables[table_name]
    return int(db.scalar(select(func.count()).select_from(table).where(*conditions)) or 0)


def class_references(db: Session, campus_id, class_name: str) -> dict[str, int]:
    """Counts of records that name this class, by label. Only non-zero entries are returned."""
    wanted = class_name.strip().lower()
    found: dict[str, int] = {}
    for table_name, label in _CLASS_NAME_TABLES:
        table = Base.metadata.tables[table_name]
        n = _count(
            db,
            table_name,
            table.c.campus_id == campus_id,
            func.lower(table.c.class_name) == wanted,
        )
        if n:
            found[label] = n
    return found


def section_references(db: Session, campus_id, class_name: str, section_name: str) -> dict[str, int]:
    """Counts of records that name this class AND section."""
    wanted_class = class_name.strip().lower()
    wanted_section = section_name.strip().lower()
    found: dict[str, int] = {}
    for table_name, label in (
        ("student_attendance", "attendance record(s)"),
        ("lesson_plans", "lesson plan(s)"),
    ):
        table = Base.metadata.tables[table_name]
        n = _count(
            db,
            table_name,
            table.c.campus_id == campus_id,
            func.lower(table.c.class_name) == wanted_class,
            func.lower(table.c.section) == wanted_section,
        )
        if n:
            found[label] = n

    batches = Base.metadata.tables["marks_batches"]
    exams = Base.metadata.tables["exams"]
    n = int(
        db.scalar(
            select(func.count())
            .select_from(batches.join(exams, exams.c.id == batches.c.exam_id))
            .where(
                batches.c.campus_id == campus_id,
                func.lower(exams.c.class_name) == wanted_class,
                func.lower(batches.c.section) == wanted_section,
            )
        )
        or 0
    )
    if n:
        found["marks batch(es)"] = n
    return found


def describe(references: dict[str, int]) -> str:
    """'10 student(s), 3 attendance record(s)'"""
    return ", ".join(f"{count} {label}" for label, count in references.items())
