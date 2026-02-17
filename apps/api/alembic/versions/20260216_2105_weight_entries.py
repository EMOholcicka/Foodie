"""weight entries

Revision ID: 20260216_2105
Revises: 20260216_2058
Create Date: 2026-02-16 21:05:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260216_2105"
down_revision = "20260216_2058"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "weight_entries",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("datetime_utc", sa.DateTime(timezone=True), nullable=False),
        sa.Column("weight_kg", sa.Numeric(5, 2), nullable=False),
        sa.Column("note", sa.String(length=500), nullable=True),
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
    op.create_index("ix_weight_entries_user_id", "weight_entries", ["user_id"], unique=False)
    op.create_index("ix_weight_entries_datetime_utc", "weight_entries", ["datetime_utc"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_weight_entries_datetime_utc", table_name="weight_entries")
    op.drop_index("ix_weight_entries_user_id", table_name="weight_entries")
    op.drop_table("weight_entries")
