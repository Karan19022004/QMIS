import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, utcnow


class LessonPlan(Base):
    """Monthly lesson plan (Academics 4.5). Locked once submitted; a denied plan is revised as a new version."""

    __tablename__ = "lesson_plans"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    campus_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campuses.id"), nullable=False)
    teacher_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    class_name: Mapped[str] = mapped_column(String(64), nullable=False)
    section: Mapped[str | None] = mapped_column(String(16), nullable=True)
    subject: Mapped[str] = mapped_column(String(80), nullable=False)
    month: Mapped[str] = mapped_column(String(7), nullable=False)  # YYYY-MM (target month)
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    content_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    file_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    approval_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("approval_requests.id"), nullable=True)
    late: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
