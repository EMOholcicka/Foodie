"""grocery_checked_items

Revision ID: 20260217_1820
Revises: 20260217_1015
Create Date: 2026-02-17 18:20:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "20260217_1820"
down_revision = "20260217_1015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "grocery_list_item_checks",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("item_key", sa.String(length=300), nullable=False),
        sa.Column("checked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("user_id", "week_start", "item_key", name="uq_grocery_checks_user_week_key"),
    )

    op.create_index("ix_grocery_list_item_checks_user_id", "grocery_list_item_checks", ["user_id"], unique=False)
    op.create_index("ix_grocery_list_item_checks_week_start", "grocery_list_item_checks", ["week_start"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_grocery_list_item_checks_week_start", table_name="grocery_list_item_checks")
    op.drop_index("ix_grocery_list_item_checks_user_id", table_name="grocery_list_item_checks")
    op.drop_table("grocery_list_item_checks")
