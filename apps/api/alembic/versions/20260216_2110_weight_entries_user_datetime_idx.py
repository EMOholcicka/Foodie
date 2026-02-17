"""weight_entries composite index (user_id, datetime_utc)

Revision ID: 20260216_2110
Revises: 20260216_2105
Create Date: 2026-02-16 21:10:00.000000

"""

from __future__ import annotations

from alembic import op

revision = "20260216_2110"
down_revision = "20260216_2105"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_weight_entries_user_id_datetime_utc",
        "weight_entries",
        ["user_id", "datetime_utc"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_weight_entries_user_id_datetime_utc", table_name="weight_entries")
