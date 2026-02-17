"""merge heads

Revision ID: 21003840624d
Revises: 20260217_1836, 73ef91b04f87, 20260217_1910
Create Date: 2026-02-17 17:30:59.005588

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision = "21003840624d"
# Merge the phase4 branch with the mainline that now includes the foods favorites migration
# AND the subsequent recipe tags/favorites migration.
down_revision = ("20260217_1836", "73ef91b04f87", "20260217_1910")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
