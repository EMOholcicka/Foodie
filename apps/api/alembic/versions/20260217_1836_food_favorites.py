"""food favorites

Revision ID: 20260217_1836
Revises: 20260217_1820
Create Date: 2026-02-17 18:36:00

"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op


# revision identifiers, used by Alembic.
revision = "20260217_1836"
# NOTE: The grocery checks migration revision id is "20260217_1820".
# Keep the dependency correct so Alembic can resolve the revision graph.
down_revision = "20260217_1820"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_food_favorites",
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("food_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("foods.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "food_id", name="pk_user_food_favorites"),
    )
    op.create_index(
        "ix_user_food_favorites_user_created_at",
        "user_food_favorites",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_user_food_favorites_user_created_at", table_name="user_food_favorites")
    op.drop_table("user_food_favorites")
