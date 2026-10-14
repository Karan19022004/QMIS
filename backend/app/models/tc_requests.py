import uuid
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, utcnow


class TcRequest(Base):
    """A Transfer Certificate request: PRM reviews it, then an administrator decides."""

    __tablename__ = "tc_requests"
    __table_args__ = (
        UniqueConstraint("campus_id", "code", name="uq_tc_requests_campus_code"),
        CheckConstraint(
            "status IN ('Pending PRM Review', 'Pending Super Admin Approval', 'Approved', 'Rejected')",
            name="ck_tc_requests_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    campus_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campuses.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)  # TC-REQ-001
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    transfer_to: Mapped[str] = mapped_column(String(200), nullable=False)
    last_date_of_attendance: Mapped[date | None] = mapped_column(Date, nullable=True)
    requested_by: Mapped[str] = mapped_column(String(80), nullable=False)
    requested_on: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="Pending PRM Review", nullable=False)
    prm_remarks: Mapped[str] = mapped_column(Text, default="", nullable=False)
    admin_remarks: Mapped[str] = mapped_column(Text, default="", nullable=False)
    forwarded_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    decided_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    tc_number: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
