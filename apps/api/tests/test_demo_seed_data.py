from __future__ import annotations

import datetime as dt

import pytest
import sqlalchemy as sa
from pydantic import EmailStr, TypeAdapter

from app.core.security import verify_password


# Keep in sync with [`apps/api/alembic/versions/20260217_2030_demo_seed_data.py`](apps/api/alembic/versions/20260217_2030_demo_seed_data.py:1)
DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD_PLAINTEXT = "demo1234"
_email_adapter = TypeAdapter(EmailStr)


def test_demo_seed_email_is_valid_emailstr():
    # Prevent regressions like `demo@foodie.local` causing 422 on `/auth/login` due to EmailStr validation.
    _email_adapter.validate_python(DEMO_EMAIL)


def _monday_of_week(d: dt.date) -> dt.date:
    return d - dt.timedelta(days=d.weekday())


@pytest.mark.asyncio
async def test_demo_seed_data_exists(engine, monkeypatch):
    """Asserts demo seed migration inserted demo user + some key rows.

    Demo seeding is opt-in via FOODIE_DEMO_SEED, so this test is only meaningful
    in environments that explicitly enable it.

    The default local unit-test DB is sqlite (see [`apps/api/tests/conftest.py`](apps/api/tests/conftest.py:1)),
    so this test is skipped there.
    """

    if engine.dialect.name != "postgresql":
        pytest.skip("demo seed data migration is validated in compose Postgres tests")

    if not (monkeypatch.getenv("FOODIE_DEMO_SEED") or "").strip():
        pytest.skip("FOODIE_DEMO_SEED not enabled; demo seed migration is opt-in")

    async with engine.connect() as conn:
        demo_user_id = None
        for _ in range(10):
            demo_user_id = (
                await conn.execute(
                    sa.text("SELECT id FROM users WHERE email = :email"),
                    {"email": DEMO_EMAIL},
                )
            ).scalar_one_or_none()
            if demo_user_id is not None:
                break

        assert demo_user_id is not None, "demo user not found after migrations"

        password_hash = (
            await conn.execute(
                sa.text("SELECT password_hash FROM users WHERE id = :uid"),
                {"uid": str(demo_user_id)},
            )
        ).scalar_one()

        assert verify_password(password=DEMO_PASSWORD_PLAINTEXT, password_hash=password_hash) is True

        foods_cnt = (
            await conn.execute(
                sa.text("SELECT COUNT(*) FROM foods WHERE user_id = :uid"),
                {"uid": str(demo_user_id)},
            )
        ).scalar_one()
        assert foods_cnt >= 3

        recipes_cnt = (
            await conn.execute(
                sa.text("SELECT COUNT(*) FROM recipes WHERE user_id = :uid"),
                {"uid": str(demo_user_id)},
            )
        ).scalar_one()
        assert recipes_cnt >= 2

        week_start = _monday_of_week(dt.date.today())
        plan_id = (
            await conn.execute(
                sa.text(
                    """
                    SELECT id FROM weekly_plans
                    WHERE user_id = :uid AND week_start = :week_start
                    """
                ),
                {"uid": str(demo_user_id), "week_start": week_start},
            )
        ).scalar_one()

        days_cnt = (
            await conn.execute(
                sa.text("SELECT COUNT(*) FROM weekly_plan_days WHERE weekly_plan_id = :pid"),
                {"pid": str(plan_id)},
            )
        ).scalar_one()
        assert days_cnt == 7

        meals_cnt = (
            await conn.execute(
                sa.text(
                    """
                    SELECT COUNT(*)
                    FROM weekly_plan_meals m
                    JOIN weekly_plan_days d ON d.id = m.weekly_plan_day_id
                    WHERE d.weekly_plan_id = :pid
                    """
                ),
                {"pid": str(plan_id)},
            )
        ).scalar_one()
        assert meals_cnt >= 7
