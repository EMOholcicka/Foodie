"""phase7_weekly_plans

Revision ID: 20260217_1015
Revises: 20260217_0900
Create Date: 2026-02-17 10:15:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "20260217_1015"
down_revision = "20260217_0900"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "weekly_plans",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("target_kcal", sa.Integer(), nullable=False),
        sa.Column("protein_g", sa.Integer(), nullable=True),
        sa.Column("carbs_g", sa.Integer(), nullable=True),
        sa.Column("fat_g", sa.Integer(), nullable=True),
        sa.Column("training_schedule_json", sa.String(length=2000), nullable=True),
        sa.Column("preferences_json", sa.String(length=4000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("user_id", "week_start", name="uq_weekly_plans_user_week_start"),
    )
    op.create_index("ix_weekly_plans_user_id", "weekly_plans", ["user_id"], unique=False)
    op.create_index("ix_weekly_plans_week_start", "weekly_plans", ["week_start"], unique=False)

    op.create_table(
        "weekly_plan_days",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "weekly_plan_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("weekly_plans.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("weekly_plan_id", "date", name="uq_weekly_plan_days_plan_date"),
    )
    op.create_index("ix_weekly_plan_days_weekly_plan_id", "weekly_plan_days", ["weekly_plan_id"], unique=False)
    op.create_index("ix_weekly_plan_days_date", "weekly_plan_days", ["date"], unique=False)

    # Reuse existing enum type 'meal_type' created in phase 4.
    # Important: don't attempt to recreate the type.
    meal_type = sa.Enum("breakfast", "lunch", "dinner", "snack", name="meal_type", create_type=False)

    op.create_table(
        "weekly_plan_meals",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "weekly_plan_day_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("weekly_plan_days.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("meal_type", meal_type, nullable=False),
        sa.Column("recipe_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("recipes.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("servings", sa.Numeric(10, 2, asdecimal=True), nullable=False),
        sa.Column("locked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("weekly_plan_day_id", "meal_type", name="uq_weekly_plan_meals_day_meal_type"),
        sa.CheckConstraint("servings > 0", name="ck_weekly_plan_meals_servings_gt_0"),
    )
    op.create_index("ix_weekly_plan_meals_weekly_plan_day_id", "weekly_plan_meals", ["weekly_plan_day_id"], unique=False)
    op.create_index("ix_weekly_plan_meals_recipe_id", "weekly_plan_meals", ["recipe_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_weekly_plan_meals_recipe_id", table_name="weekly_plan_meals")
    op.drop_index("ix_weekly_plan_meals_weekly_plan_day_id", table_name="weekly_plan_meals")
    op.drop_table("weekly_plan_meals")

    op.drop_index("ix_weekly_plan_days_date", table_name="weekly_plan_days")
    op.drop_index("ix_weekly_plan_days_weekly_plan_id", table_name="weekly_plan_days")
    op.drop_table("weekly_plan_days")

    op.drop_index("ix_weekly_plans_week_start", table_name="weekly_plans")
    op.drop_index("ix_weekly_plans_user_id", table_name="weekly_plans")
    op.drop_table("weekly_plans")
