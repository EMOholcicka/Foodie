from __future__ import annotations

import uuid
from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class GroceryListItemCheck(Base):
    __tablename__ = "grocery_list_item_checks"
    __table_args__ = (
        UniqueConstraint("user_id", "week_start", "item_key", name="uq_grocery_checks_user_week_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Monday of the week. Stored as DATE.
    week_start: Mapped[date] = mapped_column(Date(), nullable=False, index=True)

    # Stable key for a grocery list item so it matches regenerated lists.
    item_key: Mapped[str] = mapped_column(String(300), nullable=False)

    checked: Mapped[bool] = mapped_column(Boolean(), nullable=False, server_default=sa.text("false"))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
