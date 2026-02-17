from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Food(Base):
    __tablename__ = "foods"
    __table_args__ = (
        # User cannot have duplicate name+brand among their own foods.
        # Global foods (user_id NULL) can also be unique within global scope.
        UniqueConstraint("user_id", "name", "brand", name="uq_foods_user_name_brand"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # NULL => global food, otherwise user-owned.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    brand: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)

    kcal_100g: Mapped[float] = mapped_column(Numeric(7, 2), nullable=False)
    protein_100g: Mapped[float] = mapped_column(Numeric(7, 2), nullable=False)
    carbs_100g: Mapped[float] = mapped_column(Numeric(7, 2), nullable=False)
    fat_100g: Mapped[float] = mapped_column(Numeric(7, 2), nullable=False)

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
