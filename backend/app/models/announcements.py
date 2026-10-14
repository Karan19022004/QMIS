import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, utcnow


class Announcement(Base):
    """A school-wide notice sent by a staff role to a set of audience roles."""

    __tablename__ = "announcements"
    __table_args__ = (UniqueConstraint("campus_id", "code", name="uq_announcements_campus_code"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    campus_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campuses.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(16), nullable=False)  # AN-0001, the id people see
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(60), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    sent_by: Mapped[str] = mapped_column(String(80), nullable=False)  # the sender's role name, set by the server
    sender_role: Mapped[str] = mapped_column(String(48), nullable=False)
    announcement_date: Mapped[date] = mapped_column(Date, nullable=False)
    attachment_file_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("file_assets.id"), nullable=True)
    audience: Mapped[list] = mapped_column(JSON, nullable=False, default=list)  # role codes
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class AnnouncementResponse(Base):
    """A reader's acknowledgement of an announcement (at most one per person)."""

    __tablename__ = "announcement_responses"
    __table_args__ = (UniqueConstraint("announcement_id", "user_id", name="uq_announcement_responses_user"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    announcement_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("announcements.id"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    acknowledged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class AnnouncementReply(Base):
    """A reply a reader left on an announcement."""

    __tablename__ = "announcement_replies"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    announcement_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("announcements.id"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    role_code: Mapped[str] = mapped_column(String(48), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
