from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class UserTarget(Base):
    __tablename__ = "user_targets"
    __table_args__ = (
        # NOTE: This UNIQUE constraint does NOT enforce uniqueness for NULL effective_date in Postgres
        # (NULLs are treated as distinct). NULL uniqueness is enforced via a partial unique index
        # created in Alembic: uq_user_targets_user_id_effective_date_null.
        UniqueConstraint("user_id", "effective_date", name="uq_user_targets_user_effective_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # If null => active/default target (MVP)
    effective_date: Mapped[date | None] = mapped_column(Date(), nullable=True, index=True)

    kcal_target: Mapped[int] = mapped_column(Integer(), nullable=False)

    protein_g: Mapped[Decimal] = mapped_column(Numeric(8, 2, asdecimal=True), nullable=False)
    carbs_g: Mapped[Decimal] = mapped_column(Numeric(8, 2, asdecimal=True), nullable=False)
    fat_g: Mapped[Decimal] = mapped_column(Numeric(8, 2, asdecimal=True), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
