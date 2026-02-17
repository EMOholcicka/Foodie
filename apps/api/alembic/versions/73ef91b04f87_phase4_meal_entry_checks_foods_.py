"""phase4 meal_entry checks + foods uniqueness indexes

Revision ID: 73ef91b04f87
Revises: 20260217_0700
Create Date: 2026-02-17 07:53:39.333295

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "73ef91b04f87"
down_revision = "20260217_0700"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -----------------------------
    # meal_entries integrity checks
    # -----------------------------
    op.create_check_constraint(
        "ck_meal_entries_grams_gt_0",
        "meal_entries",
        "grams > 0",
    )
    op.create_check_constraint(
        "ck_meal_entries_servings_gt_0_or_null",
        "meal_entries",
        "servings IS NULL OR servings > 0",
    )
    op.create_check_constraint(
        "ck_meal_entries_food_xor_recipe",
        "meal_entries",
        "(food_id IS NULL) <> (recipe_id IS NULL)",
    )

    # ----------------------
    # foods macros constraints
    # ----------------------
    op.create_check_constraint("ck_foods_kcal_100g_gte_0", "foods", "kcal_100g >= 0")
    op.create_check_constraint("ck_foods_protein_100g_gte_0", "foods", "protein_100g >= 0")
    op.create_check_constraint("ck_foods_carbs_100g_gte_0", "foods", "carbs_100g >= 0")
    op.create_check_constraint("ck_foods_fat_100g_gte_0", "foods", "fat_100g >= 0")

    # -----------------------------------------------------------------
    # foods uniqueness with NULL brand semantics (treat NULL as empty)
    # -----------------------------------------------------------------
    # 1) Global scope (user_id IS NULL)
    op.create_index(
        "uq_foods_global_name_brand_norm",
        "foods",
        ["name", sa.text("coalesce(brand, '')")],
        unique=True,
        postgresql_where=sa.text("user_id IS NULL"),
    )

    # 2) User scope (user_id IS NOT NULL)
    op.create_index(
        "uq_foods_user_name_brand_norm",
        "foods",
        ["user_id", "name", sa.text("coalesce(brand, '')")],
        unique=True,
        postgresql_where=sa.text("user_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_foods_user_name_brand_norm", table_name="foods")
    op.drop_index("uq_foods_global_name_brand_norm", table_name="foods")

    op.drop_constraint("ck_foods_fat_100g_gte_0", "foods", type_="check")
    op.drop_constraint("ck_foods_carbs_100g_gte_0", "foods", type_="check")
    op.drop_constraint("ck_foods_protein_100g_gte_0", "foods", type_="check")
    op.drop_constraint("ck_foods_kcal_100g_gte_0", "foods", type_="check")

    op.drop_constraint("ck_meal_entries_food_xor_recipe", "meal_entries", type_="check")
    op.drop_constraint("ck_meal_entries_servings_gt_0_or_null", "meal_entries", type_="check")
    op.drop_constraint("ck_meal_entries_grams_gt_0", "meal_entries", type_="check")
