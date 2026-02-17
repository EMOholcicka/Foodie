"""phase6 recipes

Revision ID: 20260217_0900
Revises: 20260217_0800_user_targets_null_effective_date_unique
Create Date: 2026-02-17 09:00:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260217_0900"
# Alembic expects `down_revision` to reference the *revision id* of the previous migration.
# The file 20260217_0800_user_targets_null_effective_date_unique.py declares revision id "20260217_0800".
# Using the filename here breaks revision graph resolution.
down_revision = "20260217_0800"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "recipes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("servings", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("servings > 0", name="ck_recipes_servings_gt_0"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_recipes_user_id"), "recipes", ["user_id"], unique=False)
    op.create_index(op.f("ix_recipes_name"), "recipes", ["name"], unique=False)

    op.create_table(
        "recipe_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("recipe_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("food_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("grams", sa.Numeric(10, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("grams > 0", name="ck_recipe_items_grams_gt_0"),
        sa.ForeignKeyConstraint(["recipe_id"], ["recipes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["food_id"], ["foods.id"], ondelete="RESTRICT"),
    )
    op.create_index(op.f("ix_recipe_items_recipe_id"), "recipe_items", ["recipe_id"], unique=False)
    op.create_index(op.f("ix_recipe_items_food_id"), "recipe_items", ["food_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_recipe_items_food_id"), table_name="recipe_items")
    op.drop_index(op.f("ix_recipe_items_recipe_id"), table_name="recipe_items")
    op.drop_table("recipe_items")

    op.drop_index(op.f("ix_recipes_name"), table_name="recipes")
    op.drop_index(op.f("ix_recipes_user_id"), table_name="recipes")
    op.drop_table("recipes")
