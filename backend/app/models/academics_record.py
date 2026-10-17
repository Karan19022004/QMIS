import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, utcnow


class AcademicsRecord(Base):
    """Campus academics JSON collections (class timetables, teacher allocations, TT change requests)."""

    __tablename__ = "academics_records"
    __table_args__ = (
        UniqueConstraint("campus_id", "collection", "public_id", name="uq_academics_record"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    campus_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campuses.id"), nullable=False, index=True)
    collection: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    public_id: Mapped[str] = mapped_column(String(80), nullable=False)
    body: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
