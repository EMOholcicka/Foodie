"""recipe tags and favorites

Revision ID: 20260217_1910
Revises: 20260217_1836
Create Date: 2026-02-17 19:10:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = "20260217_1910"
down_revision = "20260217_1836"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "recipe_tags",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ux_recipe_tags_name", "recipe_tags", ["name"], unique=True)

    op.create_table(
        "recipe_tag_links",
        sa.Column(
            "recipe_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("recipes.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "tag_id",
            sa.Integer(),
            sa.ForeignKey("recipe_tags.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_recipe_tag_links_recipe", "recipe_tag_links", ["recipe_id"])
    op.create_index("ix_recipe_tag_links_tag", "recipe_tag_links", ["tag_id"])

    op.create_table(
        "user_recipe_favorites",
        sa.Column(
            "user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "recipe_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("recipes.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_user_recipe_favorites_user_created_at", "user_recipe_favorites", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_user_recipe_favorites_user_created_at", table_name="user_recipe_favorites")
    op.drop_table("user_recipe_favorites")

    op.drop_index("ix_recipe_tag_links_tag", table_name="recipe_tag_links")
    op.drop_index("ix_recipe_tag_links_recipe", table_name="recipe_tag_links")
    op.drop_table("recipe_tag_links")

    op.drop_index("ux_recipe_tags_name", table_name="recipe_tags")
    op.drop_table("recipe_tags")
