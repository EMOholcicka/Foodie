"""phase 4 foods + days + meal entries

Revision ID: 20260217_0700
Revises: 20260216_2110
Create Date: 2026-02-17 07:00:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260217_0700"
down_revision = "20260216_2110"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "foods",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("brand", sa.String(length=120), nullable=True),
        sa.Column("kcal_100g", sa.Numeric(7, 2), nullable=False),
        sa.Column("protein_100g", sa.Numeric(7, 2), nullable=False),
        sa.Column("carbs_100g", sa.Numeric(7, 2), nullable=False),
        sa.Column("fat_100g", sa.Numeric(7, 2), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("user_id", "name", "brand", name="uq_foods_user_name_brand"),
    )
    op.create_index("ix_foods_user_id", "foods", ["user_id"], unique=False)
    op.create_index("ix_foods_name", "foods", ["name"], unique=False)
    op.create_index("ix_foods_brand", "foods", ["brand"], unique=False)

    op.create_table(
        "days",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("user_id", "date", name="uq_days_user_date"),
    )
    op.create_index("ix_days_user_id", "days", ["user_id"], unique=False)
    op.create_index("ix_days_date", "days", ["date"], unique=False)

    op.create_table(
        "meal_entries",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "day_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("days.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("meal_type", sa.Enum("breakfast", "lunch", "dinner", "snack", name="meal_type"), nullable=False),
        sa.Column(
            "food_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("foods.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("recipe_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("grams", sa.Numeric(8, 2), nullable=False),
        sa.Column("servings", sa.Numeric(8, 2), nullable=True),
        sa.Column("serving_label", sa.String(length=50), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_meal_entries_day_id", "meal_entries", ["day_id"], unique=False)
    op.create_index("ix_meal_entries_meal_type", "meal_entries", ["meal_type"], unique=False)
    op.create_index("ix_meal_entries_food_id", "meal_entries", ["food_id"], unique=False)
    op.create_index("ix_meal_entries_recipe_id", "meal_entries", ["recipe_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_meal_entries_recipe_id", table_name="meal_entries")
    op.drop_index("ix_meal_entries_food_id", table_name="meal_entries")
    op.drop_index("ix_meal_entries_meal_type", table_name="meal_entries")
    op.drop_index("ix_meal_entries_day_id", table_name="meal_entries")
    op.drop_table("meal_entries")

    op.drop_index("ix_days_date", table_name="days")
    op.drop_index("ix_days_user_id", table_name="days")
    op.drop_table("days")

    op.drop_index("ix_foods_brand", table_name="foods")
    op.drop_index("ix_foods_name", table_name="foods")
    op.drop_index("ix_foods_user_id", table_name="foods")
    op.drop_table("foods")

    op.execute("DROP TYPE IF EXISTS meal_type")
