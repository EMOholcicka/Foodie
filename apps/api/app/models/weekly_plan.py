from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.meal_entry import MealType


class WeeklyPlan(Base):
    __tablename__ = "weekly_plans"
    __table_args__ = (sa.UniqueConstraint("user_id", "week_start", name="uq_weekly_plans_user_week_start"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Monday of the week (ISO week start). Stored as DATE.
    week_start: Mapped[date] = mapped_column(Date(), nullable=False, index=True)

    # Generation inputs snapshot (MVP) for reproducibility/debug.
    target_kcal: Mapped[int] = mapped_column(Integer(), nullable=False)
    protein_g: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    carbs_g: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    fat_g: Mapped[int | None] = mapped_column(Integer(), nullable=True)

    training_schedule_json: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    preferences_json: Mapped[str | None] = mapped_column(String(4000), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    days: Mapped[list[WeeklyPlanDay]] = relationship(
        back_populates="weekly_plan",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="WeeklyPlanDay.date.asc()",
    )


class WeeklyPlanDay(Base):
    __tablename__ = "weekly_plan_days"
    __table_args__ = (sa.UniqueConstraint("weekly_plan_id", "date", name="uq_weekly_plan_days_plan_date"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    weekly_plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("weekly_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    date: Mapped[date] = mapped_column(Date(), nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    weekly_plan: Mapped[WeeklyPlan] = relationship(back_populates="days")

    meals: Mapped[list[WeeklyPlanMeal]] = relationship(
        back_populates="day",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="WeeklyPlanMeal.meal_type.asc()",
    )


class WeeklyPlanMeal(Base):
    __tablename__ = "weekly_plan_meals"
    __table_args__ = (
        sa.UniqueConstraint("weekly_plan_day_id", "meal_type", name="uq_weekly_plan_meals_day_meal_type"),
        CheckConstraint("servings > 0", name="ck_weekly_plan_meals_servings_gt_0"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    weekly_plan_day_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("weekly_plan_days.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    meal_type: Mapped[MealType] = mapped_column(sa.Enum(MealType, name="meal_type"), nullable=False, index=True)

    recipe_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("recipes.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    servings: Mapped[Decimal] = mapped_column(sa.Numeric(10, 2, asdecimal=True), nullable=False)

    locked: Mapped[bool] = mapped_column(Boolean(), nullable=False, server_default=sa.text("false"))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    day: Mapped[WeeklyPlanDay] = relationship(back_populates="meals")
