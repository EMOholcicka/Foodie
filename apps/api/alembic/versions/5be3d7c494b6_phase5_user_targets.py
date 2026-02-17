"""phase5_user_targets

Revision ID: 5be3d7c494b6
Revises: 20260217_0700
Create Date: 2026-02-17 07:45:43.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "5be3d7c494b6"
down_revision = "20260217_0700"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_targets",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("effective_date", sa.Date(), nullable=True),
        sa.Column("kcal_target", sa.Integer(), nullable=False),
        sa.Column("protein_g", sa.Numeric(8, 2), nullable=False),
        sa.Column("carbs_g", sa.Numeric(8, 2), nullable=False),
        sa.Column("fat_g", sa.Numeric(8, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("user_id", "effective_date", name="uq_user_targets_user_effective_date"),
    )
    op.create_index("ix_user_targets_user_id", "user_targets", ["user_id"], unique=False)
    op.create_index("ix_user_targets_effective_date", "user_targets", ["effective_date"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_user_targets_effective_date", table_name="user_targets")
    op.drop_index("ix_user_targets_user_id", table_name="user_targets")
    op.drop_table("user_targets")
