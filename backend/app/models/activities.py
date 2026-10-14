import uuid
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, utcnow


class Activity(Base):
    """A cultural, sports or competition event (Admin > Activities)."""

    __tablename__ = "activities"
    __table_args__ = (
        UniqueConstraint("campus_id", "code", name="uq_activities_campus_code"),
        CheckConstraint("activity_type IN ('cultural', 'sports', 'competition')", name="ck_activities_type"),
        CheckConstraint("md_approval_status IN ('Pending', 'Approved', 'Rejected')", name="ck_activities_approval"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    campus_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campuses.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    activity_type: Mapped[str] = mapped_column(String(16), nullable=False)
    event_name: Mapped[str] = mapped_column(String(200), nullable=False)
    event_type: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    class_name: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[str] = mapped_column(String(16), default="", nullable=False)
    end_time: Mapped[str] = mapped_column(String(16), default="", nullable=False)
    venue: Mapped[str] = mapped_column(String(160), default="", nullable=False)
    coordinator: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    coach: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    submitted_by: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    submitted_date: Mapped[date] = mapped_column(Date, nullable=False)
    md_approval_status: Mapped[str] = mapped_column(String(16), default="Pending", nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    players: Mapped[list["ActivityPlayer"]] = relationship(
        back_populates="activity", cascade="all, delete-orphan", order_by="ActivityPlayer.rank"
    )


class ActivityPlayer(Base):
    """A placed player on a sports (usually chess) result."""

    __tablename__ = "activity_players"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    activity_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("activities.id"), nullable=False, index=True)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    category: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    class_name: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    school: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    rating: Mapped[str] = mapped_column(String(16), default="", nullable=False)
    score: Mapped[str] = mapped_column(String(16), default="", nullable=False)
    tie_break: Mapped[str] = mapped_column(String(16), default="", nullable=False)
    result: Mapped[str] = mapped_column(String(24), default="Completed", nullable=False)

    activity: Mapped[Activity] = relationship(back_populates="players")
