import uuid
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, utcnow


class DocumentRecord(Base):
    """One document folder per student or employee (Admin > Documents).

    Exactly one of ``student_id`` / ``employee_id`` is set; the database enforces that, and that a
    person has only one folder.
    """

    __tablename__ = "document_records"
    __table_args__ = (
        CheckConstraint(
            "(subject_type = 'student' AND student_id IS NOT NULL AND employee_id IS NULL) OR "
            "(subject_type = 'employee' AND employee_id IS NOT NULL AND student_id IS NULL)",
            name="ck_document_records_one_subject",
        ),
        CheckConstraint("status IN ('In Progress', 'Completed')", name="ck_document_records_status"),
        UniqueConstraint("student_id", name="uq_document_records_student"),
        UniqueConstraint("employee_id", name="uq_document_records_employee"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    campus_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campuses.id"), nullable=False)
    subject_type: Mapped[str] = mapped_column(String(16), nullable=False)
    student_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("students.id"), nullable=True)
    employee_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("hr_employees.id"), nullable=True)
    submitted_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="In Progress", nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    items: Mapped[list["DocumentItem"]] = relationship(
        back_populates="record", cascade="all, delete-orphan", order_by="DocumentItem.created_at"
    )


class DocumentItem(Base):
    """One uploaded file inside a folder. ``doc_key`` is the normalised label (unique per folder)."""

    __tablename__ = "document_items"
    __table_args__ = (
        CheckConstraint("status IN ('Submitted', 'Pending', 'Approved')", name="ck_document_items_status"),
        UniqueConstraint("record_id", "doc_key", name="uq_document_items_record_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    record_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("document_records.id"), nullable=False, index=True)
    doc_key: Mapped[str] = mapped_column(String(80), nullable=False)
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    file_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("file_assets.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), default="Pending", nullable=False)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    record: Mapped[DocumentRecord] = relationship(back_populates="items")
