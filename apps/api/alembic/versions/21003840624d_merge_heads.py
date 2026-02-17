"""merge heads

Revision ID: 21003840624d
Revises: 73ef91b04f87, 20260217_1910
Create Date: 2026-02-17 17:30:59.005588

"""

from __future__ import annotations

# Merge migrations should not introduce a redundant dependency chain.
#
# Previously this file listed three down_revisions:
#   ("20260217_1836", "73ef91b04f87", "20260217_1910")
#
# but `20260217_1910` already depends on `20260217_1836`.
# This can confuse Alembic's head maintenance (it tries to delete a head that
# is not present), leading to:
#   KeyError: '20260217_1836'
# during `alembic upgrade head`.
#
# The correct merge is between the two actual branch heads:
#   - 73ef91b04f87
#   - 20260217_1910

revision = "21003840624d"
down_revision = ("73ef91b04f87", "20260217_1910")
branch_labels = None
depends_on = None


def upgrade() -> None:
    # merge point (no-op)
    pass


def downgrade() -> None:
    # merge point (no-op)
    pass
