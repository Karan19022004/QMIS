import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, utcnow


class LeaveRequest(Base):
    """Leave / permission request (Academics doc 4.9). Immutable once filed; decided via the approval engine."""

    __tablename__ = "leave_requests"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    campus_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campuses.id"), nullable=False)
    request_no: Mapped[int] = mapped_column(Integer, nullable=False)
    requester_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    requester_role: Mapped[str] = mapped_column(String(48), nullable=False)
    leave_type: Mapped[str] = mapped_column(String(32), nullable=False)
    from_date: Mapped[date] = mapped_column(Date, nullable=False)
    to_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_days: Mapped[int] = mapped_column(Integer, nullable=False)
    hours: Mapped[float | None] = mapped_column(Float, nullable=True)  # Permission only, max 2h
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    approval_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("approval_requests.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
