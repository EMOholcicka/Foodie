from __future__ import annotations

import os
import uuid
from collections.abc import AsyncIterator, Iterator
from datetime import date

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

# IMPORTANT: settings are constructed at app import time in this project.
# Set DATABASE_URL as early as possible so importing app.main doesn't crash.
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./.pytest_auth.db")

from app.core.settings import get_settings
from app.db.session import get_db_session
from app.main import create_app
from app.models.base import Base
from app.models.day import Day
from app.models.food import Food
from app.models.meal_entry import MealEntry
from app.models.user import User




@pytest.fixture(scope="session")
def _test_db_url() -> str:
    # Use an on-disk sqlite DB so multiple connections see the same schema.
    return "sqlite+aiosqlite:///./.pytest_auth.db"


@pytest.fixture(scope="session")
def engine(_test_db_url: str) -> AsyncEngine:
    return create_async_engine(_test_db_url)


@pytest.fixture(scope="session", autouse=True)
def _set_database_url_env(_test_db_url: str) -> None:
    # Ensure Settings() can be constructed in tests without requiring real env.
    # NOTE: setdefault is not sufficient here because app settings may be
    # instantiated during import-time (before this fixture runs).
    os.environ["DATABASE_URL"] = _test_db_url


@pytest.fixture(scope="session")
async def _create_schema(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

        # Ensure newly added CHECK constraints and partial unique indexes
        # (added via Alembic migrations for Postgres) are also enforced in
        # the sqlite-based test DB.
        # sqlite can only execute one statement at a time (via aiosqlite),
        # so keep DDL statements separate.
        await conn.execute(
            sa.text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_foods_global_name_brand_norm
                ON foods (name, coalesce(brand, ''))
                WHERE user_id IS NULL
                """
            )
        )
        await conn.execute(
            sa.text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_foods_user_name_brand_norm
                ON foods (user_id, name, coalesce(brand, ''))
                WHERE user_id IS NOT NULL
                """
            )
        )

        await conn.execute(
            sa.text(
                """
                CREATE TRIGGER IF NOT EXISTS meal_entries_grams_gt_0
                BEFORE INSERT ON meal_entries
                FOR EACH ROW
                WHEN NEW.grams <= 0
                BEGIN
                    SELECT RAISE(ABORT, 'grams must be > 0');
                END;
                """
            )
        )
        await conn.execute(
            sa.text(
                """
                CREATE TRIGGER IF NOT EXISTS meal_entries_grams_gt_0_u
                BEFORE UPDATE ON meal_entries
                FOR EACH ROW
                WHEN NEW.grams <= 0
                BEGIN
                    SELECT RAISE(ABORT, 'grams must be > 0');
                END;
                """
            )
        )

        await conn.execute(
            sa.text(
                """
                CREATE TRIGGER IF NOT EXISTS meal_entries_xor_food_recipe
                BEFORE INSERT ON meal_entries
                FOR EACH ROW
                WHEN ((NEW.food_id IS NULL) = (NEW.recipe_id IS NULL))
                BEGIN
                    SELECT RAISE(ABORT, 'exactly one of food_id or recipe_id must be provided');
                END;
                """
            )
        )
        await conn.execute(
            sa.text(
                """
                CREATE TRIGGER IF NOT EXISTS meal_entries_xor_food_recipe_u
                BEFORE UPDATE ON meal_entries
                FOR EACH ROW
                WHEN ((NEW.food_id IS NULL) = (NEW.recipe_id IS NULL))
                BEGIN
                    SELECT RAISE(ABORT, 'exactly one of food_id or recipe_id must be provided');
                END;
                """
            )
        )

        await conn.execute(
            sa.text(
                """
                CREATE TRIGGER IF NOT EXISTS foods_kcal_gte_0
                BEFORE INSERT ON foods
                FOR EACH ROW
                WHEN NEW.kcal_100g < 0 OR NEW.protein_100g < 0 OR NEW.carbs_100g < 0 OR NEW.fat_100g < 0
                BEGIN
                    SELECT RAISE(ABORT, 'macros must be >= 0');
                END;
                """
            )
        )
        await conn.execute(
            sa.text(
                """
                CREATE TRIGGER IF NOT EXISTS foods_kcal_gte_0_u
                BEFORE UPDATE ON foods
                FOR EACH ROW
                WHEN NEW.kcal_100g < 0 OR NEW.protein_100g < 0 OR NEW.carbs_100g < 0 OR NEW.fat_100g < 0
                BEGIN
                    SELECT RAISE(ABORT, 'macros must be >= 0');
                END;
                """
            )
        )

        await conn.execute(
            sa.text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_user_targets_user_id_effective_date_null
                ON user_targets (user_id)
                WHERE effective_date IS NULL
                """
            )
        )

        await conn.execute(
            sa.text(
                """
                CREATE TRIGGER IF NOT EXISTS recipes_servings_gt_0
                BEFORE INSERT ON recipes
                FOR EACH ROW
                WHEN NEW.servings <= 0
                BEGIN
                    SELECT RAISE(ABORT, 'servings must be > 0');
                END;
                """
            )
        )
        await conn.execute(
            sa.text(
                """
                CREATE TRIGGER IF NOT EXISTS recipes_servings_gt_0_u
                BEFORE UPDATE ON recipes
                FOR EACH ROW
                WHEN NEW.servings <= 0
                BEGIN
                    SELECT RAISE(ABORT, 'servings must be > 0');
                END;
                """
            )
        )

        await conn.execute(
            sa.text(
                """
                CREATE TRIGGER IF NOT EXISTS recipe_items_grams_gt_0
                BEFORE INSERT ON recipe_items
                FOR EACH ROW
                WHEN NEW.grams <= 0
                BEGIN
                    SELECT RAISE(ABORT, 'grams must be > 0');
                END;
                """
            )
        )
        await conn.execute(
            sa.text(
                """
                CREATE TRIGGER IF NOT EXISTS recipe_items_grams_gt_0_u
                BEFORE UPDATE ON recipe_items
                FOR EACH ROW
                WHEN NEW.grams <= 0
                BEGIN
                    SELECT RAISE(ABORT, 'grams must be > 0');
                END;
                """
            )
        )


@pytest.fixture(autouse=True)
def _reset_settings_cache() -> None:
    # Tests mutate env vars (e.g. CORS_ORIGINS) and expect create_app() to see them.
    # Settings are cached by @lru_cache, so clear between tests.
    get_settings.cache_clear()


@pytest.fixture()
async def db_connection(engine: AsyncEngine, _create_schema: None) -> AsyncIterator[AsyncConnection]:
    async with engine.connect() as conn:
        trans = await conn.begin()
        try:
            yield conn
        finally:
            await trans.rollback()


@pytest.fixture()
async def session(db_connection: AsyncConnection) -> AsyncIterator[AsyncSession]:
    maker: async_sessionmaker[AsyncSession] = async_sessionmaker(
        bind=db_connection,
        expire_on_commit=False,
        autoflush=False,
        autocommit=False,
    )
    async with maker() as s:
        yield s


@pytest.fixture()
def client(session: AsyncSession) -> Iterator[TestClient]:
    app = create_app()

    async def _override_get_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app.dependency_overrides[get_db_session] = _override_get_db_session

    with TestClient(app) as c:
        yield c


@pytest.fixture()
def auth_headers(client: TestClient) -> dict[str, str]:
    r = client.post(
        "/auth/register",
        json={"email": f"u-{uuid.uuid4()}@example.com", "password": "password123"},
    )
    assert r.status_code == 201
    access = r.json()["access_token"]
    return {"Authorization": f"Bearer {access}"}


@pytest.fixture()
async def make_food_for_user(session: AsyncSession, user_id_for_auth: uuid.UUID):
    async def _make(*, name: str = "Food", brand: str | None = None):
        food = Food(
            user_id=user_id_for_auth,
            name=name,
            brand=brand,
            kcal_100g=100,
            protein_100g=10,
            carbs_100g=10,
            fat_100g=10,
        )
        session.add(food)
        await session.flush()
        return {"id": str(food.id), "user_id": str(food.user_id), "name": food.name}

    return _make


@pytest.fixture()
async def user_id_for_auth(session: AsyncSession, auth_headers: dict[str, str]) -> uuid.UUID:
    # We can't decode user_id from JWT easily in tests; instead select last created user.
    res = await session.execute(sa.select(User).order_by(User.created_at.desc()).limit(1))
    user = res.scalar_one()
    return user.id


@pytest.fixture()
async def make_day(session: AsyncSession, user_id_for_auth: uuid.UUID):
    async def _make(*, day_date: str = "2026-02-17"):
        d = Day(user_id=user_id_for_auth, date=date.fromisoformat(day_date))
        session.add(d)
        await session.flush()
        return {"id": str(d.id), "user_id": str(d.user_id), "date": d.date.isoformat()}

    return _make


@pytest.fixture()
async def make_meal_entry(session: AsyncSession):
    async def _make(*, day_id: str, meal_type: str, food_id: str, grams: float = 100):
        me = MealEntry(
            day_id=uuid.UUID(day_id),
            meal_type=meal_type,
            food_id=uuid.UUID(food_id),
            grams=grams,
        )
        session.add(me)
        await session.flush()
        return {"id": str(me.id)}

    return _make
