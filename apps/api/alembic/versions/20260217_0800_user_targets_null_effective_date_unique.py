"""user_targets_null_effective_date_unique

Revision ID: 20260217_0800
Revises: 5be3d7c494b6
Create Date: 2026-02-17 08:00:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "20260217_0800"
down_revision = "5be3d7c494b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enforce at most one "active/default" target per user.
    # NOTE: Postgres UNIQUE constraints treat NULLs as distinct, so we need a partial unique index.
    #
    # This migration is designed for Postgres (it uses a Postgres partial unique index via
    # `postgresql_where=`). The cleanup query is portable SQL, but the lock statement below is
    # Postgres-specific and is guarded for portability.
    #
    # Operational note:
    # This migration performs cleanup deletes and then creates a unique index. Application writes
    # to `user_targets` should be paused (or drained) while this runs to avoid race conditions.
    #
    # Resilience policy (pre-index cleanup):
    # If there are already multiple rows for the same user where effective_date IS NULL,
    # we keep exactly one and delete the rest.
    #
    # Which row is kept?
    # - Prefer the newest by created_at
    # - Tie-breaker: highest id
    #
    # This makes the migration idempotent on dirty data and guarantees index creation succeeds.
    #
    # Optional safety: take a table lock to prevent concurrent inserts/updates while we cleanup
    # and create the unique index.
    if op.get_bind().dialect.name == "postgresql":
        op.execute(sa.text("LOCK TABLE user_targets IN SHARE ROW EXCLUSIVE MODE;"))

    op.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY user_id
                        ORDER BY created_at DESC NULLS LAST, id DESC
                    ) AS rn
                FROM user_targets
                WHERE effective_date IS NULL
            )
            DELETE FROM user_targets ut
            USING ranked r
            WHERE ut.id = r.id
              AND r.rn > 1;
            """
        )
    )

    op.create_index(
        "uq_user_targets_user_id_effective_date_null",
        "user_targets",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("effective_date IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_user_targets_user_id_effective_date_null", table_name="user_targets")
