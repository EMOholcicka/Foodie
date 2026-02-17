"""demo seed data (demo user + foods + recipes + weekly plan)

Revision ID: 20260217_2030
Revises: 21003840624d
Create Date: 2026-02-17 20:30:00.000000

"""

from __future__ import annotations

import os
import uuid
from datetime import date, timedelta
from decimal import Decimal

import sqlalchemy as sa
from alembic import op

# IMPORTANT: reuse the same hashing implementation as the runtime `/auth/register` route.
from app.core.security import hash_password


# revision identifiers, used by Alembic.
revision = "20260217_2030"
down_revision = "21003840624d"
branch_labels = None
depends_on = None


# Must be a syntactically valid public email domain.
# Pydantic's `EmailStr` (used by the auth schemas) rejects special-use/reserved TLDs like `.local`.
DEMO_EMAIL = "demo@example.com"

# Keep in sync with docs/tests. Used only to generate a proper Argon2 hash at migration runtime.
DEMO_PASSWORD_PLAINTEXT = "demo1234"

# Opt-in env var. Any truthy value enables seeding.
DEMO_SEED_ENV_VAR = "FOODIE_DEMO_SEED"

# Stable identifiers so downgrade can delete precisely.
DEMO_USER_ID = uuid.UUID("00000000-0000-0000-0000-00000000d3e0")

# Foods
FOOD_CHICKEN_ID = uuid.UUID("00000000-0000-0000-0000-00000000f001")
FOOD_RICE_ID = uuid.UUID("00000000-0000-0000-0000-00000000f002")
FOOD_BROCCOLI_ID = uuid.UUID("00000000-0000-0000-0000-00000000f003")
FOOD_EGG_ID = uuid.UUID("00000000-0000-0000-0000-00000000f004")
FOOD_OATS_ID = uuid.UUID("00000000-0000-0000-0000-00000000f005")

# Recipes
RECIPE_CHICKEN_RICE_ID = uuid.UUID("00000000-0000-0000-0000-00000000e101")
RECIPE_OVERNIGHT_OATS_ID = uuid.UUID("00000000-0000-0000-0000-00000000e102")
RECIPE_EGGS_BROCCOLI_ID = uuid.UUID("00000000-0000-0000-0000-00000000e103")

# Weekly plan + children (stable IDs)
DEMO_WEEKLY_PLAN_ID = uuid.UUID("00000000-0000-0000-0000-00000000b001")
DEMO_WEEKLY_PLAN_DAY_IDS = [
    uuid.UUID("00000000-0000-0000-0000-00000000b011"),
    uuid.UUID("00000000-0000-0000-0000-00000000b012"),
    uuid.UUID("00000000-0000-0000-0000-00000000b013"),
    uuid.UUID("00000000-0000-0000-0000-00000000b014"),
    uuid.UUID("00000000-0000-0000-0000-00000000b015"),
    uuid.UUID("00000000-0000-0000-0000-00000000b016"),
    uuid.UUID("00000000-0000-0000-0000-00000000b017"),
]


def _is_demo_seed_enabled() -> bool:
    val = os.getenv(DEMO_SEED_ENV_VAR)
    if val is None:
        return False
    return val.strip().lower() not in {"", "0", "false", "no", "off"}


def _monday_of_week(d: date) -> date:
    # Monday is 0
    return d - timedelta(days=d.weekday())


def upgrade() -> None:
    # Demo seed is opt-in.
    if not _is_demo_seed_enabled():
        return

    bind = op.get_bind()

    users = sa.table(
        "users",
        sa.column("id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.column("email", sa.String()),
        sa.column("password_hash", sa.String()),
    )

    foods = sa.table(
        "foods",
        sa.column("id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.column("user_id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.column("name", sa.String()),
        sa.column("brand", sa.String()),
        sa.column("kcal_100g", sa.Numeric()),
        sa.column("protein_100g", sa.Numeric()),
        sa.column("carbs_100g", sa.Numeric()),
        sa.column("fat_100g", sa.Numeric()),
    )

    recipes = sa.table(
        "recipes",
        sa.column("id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.column("user_id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.column("name", sa.String()),
        sa.column("servings", sa.Integer()),
    )

    recipe_items = sa.table(
        "recipe_items",
        sa.column("id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.column("recipe_id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.column("food_id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.column("grams", sa.Numeric(10, 2)),
    )

    recipe_tags = sa.table(
        "recipe_tags",
        sa.column("id", sa.Integer()),
        sa.column("name", sa.String()),
    )

    recipe_tag_links = sa.table(
        "recipe_tag_links",
        sa.column("recipe_id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.column("tag_id", sa.Integer()),
    )

    user_recipe_favorites = sa.table(
        "user_recipe_favorites",
        sa.column("user_id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.column("recipe_id", sa.dialects.postgresql.UUID(as_uuid=True)),
    )

    weekly_plans = sa.table(
        "weekly_plans",
        sa.column("id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.column("user_id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.column("week_start", sa.Date()),
        sa.column("target_kcal", sa.Integer()),
        sa.column("protein_g", sa.Integer()),
        sa.column("carbs_g", sa.Integer()),
        sa.column("fat_g", sa.Integer()),
        sa.column("training_schedule_json", sa.String()),
        sa.column("preferences_json", sa.String()),
    )

    weekly_plan_days = sa.table(
        "weekly_plan_days",
        sa.column("id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.column("weekly_plan_id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.column("date", sa.Date()),
    )

    weekly_plan_meals = sa.table(
        "weekly_plan_meals",
        sa.column("id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.column("weekly_plan_day_id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.column("meal_type", sa.Enum("breakfast", "lunch", "dinner", "snack", name="meal_type")),
        sa.column("recipe_id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.column("servings", sa.Numeric(10, 2)),
        sa.column("locked", sa.Boolean()),
    )

    # 1) Demo user
    existing_user_id = bind.execute(sa.text("SELECT id FROM users WHERE email = :email"), {"email": DEMO_EMAIL}).scalar_one_or_none()

    if existing_user_id is not None and str(existing_user_id) != str(DEMO_USER_ID):
        raise RuntimeError(
            f"Refusing to seed demo data: email {DEMO_EMAIL!r} already exists with id={existing_user_id} "
            f"(expected {DEMO_USER_ID})."
        )

    bind.execute(
        sa.text(
            """
            INSERT INTO users (id, email, password_hash)
            VALUES (:id, :email, :password_hash)
            ON CONFLICT (email) DO NOTHING
            """
        ),
        {
            "id": str(DEMO_USER_ID),
            "email": DEMO_EMAIL,
            "password_hash": hash_password(DEMO_PASSWORD_PLAINTEXT),
        },
    )

    demo_user_id = DEMO_USER_ID

    # 2) Foods (owned by demo user so we don't pollute global foods)
    food_rows = [
        {
            "id": FOOD_CHICKEN_ID,
            "user_id": demo_user_id,
            "name": "Chicken breast",
            "brand": None,
            "kcal_100g": Decimal("165.00"),
            "protein_100g": Decimal("31.00"),
            "carbs_100g": Decimal("0.00"),
            "fat_100g": Decimal("3.60"),
        },
        {
            "id": FOOD_RICE_ID,
            "user_id": demo_user_id,
            "name": "Jasmine rice (dry)",
            "brand": None,
            "kcal_100g": Decimal("360.00"),
            "protein_100g": Decimal("7.00"),
            "carbs_100g": Decimal("78.00"),
            "fat_100g": Decimal("0.60"),
        },
        {
            "id": FOOD_BROCCOLI_ID,
            "user_id": demo_user_id,
            "name": "Broccoli",
            "brand": None,
            "kcal_100g": Decimal("34.00"),
            "protein_100g": Decimal("2.80"),
            "carbs_100g": Decimal("7.00"),
            "fat_100g": Decimal("0.40"),
        },
        {
            "id": FOOD_EGG_ID,
            "user_id": demo_user_id,
            "name": "Egg",
            "brand": None,
            "kcal_100g": Decimal("143.00"),
            "protein_100g": Decimal("13.00"),
            "carbs_100g": Decimal("1.10"),
            "fat_100g": Decimal("9.50"),
        },
        {
            "id": FOOD_OATS_ID,
            "user_id": demo_user_id,
            "name": "Oats",
            "brand": None,
            "kcal_100g": Decimal("389.00"),
            "protein_100g": Decimal("17.00"),
            "carbs_100g": Decimal("66.00"),
            "fat_100g": Decimal("7.00"),
        },
    ]

    for r in food_rows:
        bind.execute(
            sa.text(
                """
                INSERT INTO foods (id, user_id, name, brand, kcal_100g, protein_100g, carbs_100g, fat_100g)
                VALUES (:id, :user_id, :name, :brand, :kcal_100g, :protein_100g, :carbs_100g, :fat_100g)
                ON CONFLICT ON CONSTRAINT uq_foods_user_name_brand DO NOTHING
                """
            ),
            {**r, "id": str(r["id"]), "user_id": str(r["user_id"])},
        )

    # 3) Recipes
    recipe_rows = [
        {"id": RECIPE_CHICKEN_RICE_ID, "user_id": demo_user_id, "name": "Chicken & Rice Bowl", "servings": 2},
        {"id": RECIPE_OVERNIGHT_OATS_ID, "user_id": demo_user_id, "name": "Overnight Oats", "servings": 1},
        {"id": RECIPE_EGGS_BROCCOLI_ID, "user_id": demo_user_id, "name": "Eggs with Broccoli", "servings": 1},
    ]
    for r in recipe_rows:
        bind.execute(
            sa.text(
                """
                INSERT INTO recipes (id, user_id, name, servings)
                VALUES (:id, :user_id, :name, :servings)
                ON CONFLICT (id) DO NOTHING
                """
            ),
            {**r, "id": str(r["id"]), "user_id": str(r["user_id"])},
        )

    # 4) Recipe items (idempotent by explicit id)
    recipe_item_rows = [
        # Chicken & Rice Bowl
        {"id": uuid.UUID("00000000-0000-0000-0000-00000000a001"), "recipe_id": RECIPE_CHICKEN_RICE_ID, "food_id": FOOD_CHICKEN_ID, "grams": Decimal("250.00")},
        {"id": uuid.UUID("00000000-0000-0000-0000-00000000a002"), "recipe_id": RECIPE_CHICKEN_RICE_ID, "food_id": FOOD_RICE_ID, "grams": Decimal("150.00")},
        {"id": uuid.UUID("00000000-0000-0000-0000-00000000a003"), "recipe_id": RECIPE_CHICKEN_RICE_ID, "food_id": FOOD_BROCCOLI_ID, "grams": Decimal("200.00")},
        # Overnight Oats
        {"id": uuid.UUID("00000000-0000-0000-0000-00000000a004"), "recipe_id": RECIPE_OVERNIGHT_OATS_ID, "food_id": FOOD_OATS_ID, "grams": Decimal("80.00")},
        {"id": uuid.UUID("00000000-0000-0000-0000-00000000a005"), "recipe_id": RECIPE_OVERNIGHT_OATS_ID, "food_id": FOOD_EGG_ID, "grams": Decimal("0.01")},
        # Eggs with Broccoli
        {"id": uuid.UUID("00000000-0000-0000-0000-00000000a006"), "recipe_id": RECIPE_EGGS_BROCCOLI_ID, "food_id": FOOD_EGG_ID, "grams": Decimal("120.00")},
        {"id": uuid.UUID("00000000-0000-0000-0000-00000000a007"), "recipe_id": RECIPE_EGGS_BROCCOLI_ID, "food_id": FOOD_BROCCOLI_ID, "grams": Decimal("150.00")},
    ]

    for r in recipe_item_rows:
        bind.execute(
            sa.text(
                """
                INSERT INTO recipe_items (id, recipe_id, food_id, grams)
                VALUES (:id, :recipe_id, :food_id, :grams)
                ON CONFLICT (id) DO NOTHING
                """
            ),
            {"id": str(r["id"]), "recipe_id": str(r["recipe_id"]), "food_id": str(r["food_id"]), "grams": r["grams"]},
        )

    # 5) Tags (optional, only if the tags tables exist)
    has_recipe_tags = bind.execute(
        sa.text(
            """
            SELECT 1
            FROM information_schema.tables
            WHERE table_name = 'recipe_tags'
            """
        )
    ).scalar_one_or_none()

    if has_recipe_tags:
        for tag_name in ["demo", "quick", "high-protein"]:
            bind.execute(
                sa.text(
                    """
                    INSERT INTO recipe_tags (name)
                    VALUES (:name)
                    ON CONFLICT (name) DO NOTHING
                    """
                ),
                {"name": tag_name},
            )

        tag_ids = {name: bind.execute(sa.text("SELECT id FROM recipe_tags WHERE name = :name"), {"name": name}).scalar_one() for name in ["demo", "quick", "high-protein"]}

        tag_links = [
            {"recipe_id": RECIPE_CHICKEN_RICE_ID, "tag_id": tag_ids["demo"]},
            {"recipe_id": RECIPE_CHICKEN_RICE_ID, "tag_id": tag_ids["high-protein"]},
            {"recipe_id": RECIPE_OVERNIGHT_OATS_ID, "tag_id": tag_ids["demo"]},
            {"recipe_id": RECIPE_OVERNIGHT_OATS_ID, "tag_id": tag_ids["quick"]},
            {"recipe_id": RECIPE_EGGS_BROCCOLI_ID, "tag_id": tag_ids["demo"]},
            {"recipe_id": RECIPE_EGGS_BROCCOLI_ID, "tag_id": tag_ids["quick"]},
        ]

        for l in tag_links:
            bind.execute(
                sa.text(
                    """
                    INSERT INTO recipe_tag_links (recipe_id, tag_id)
                    VALUES (:recipe_id, :tag_id)
                    ON CONFLICT DO NOTHING
                    """
                ),
                {"recipe_id": str(l["recipe_id"]), "tag_id": l["tag_id"]},
            )

    # 6) Favorite one recipe (optional, only if favorites table exists)
    has_recipe_favs = bind.execute(
        sa.text(
            """
            SELECT 1
            FROM information_schema.tables
            WHERE table_name = 'user_recipe_favorites'
            """
        )
    ).scalar_one_or_none()

    if has_recipe_favs:
        bind.execute(
            sa.text(
                """
                INSERT INTO user_recipe_favorites (user_id, recipe_id)
                VALUES (:user_id, :recipe_id)
                ON CONFLICT DO NOTHING
                """
            ),
            {"user_id": str(demo_user_id), "recipe_id": str(RECIPE_CHICKEN_RICE_ID)},
        )

    # 7) Weekly plan for current week start (Monday)
    week_start = _monday_of_week(date.today())

    bind.execute(
        sa.text(
            """
            INSERT INTO weekly_plans (
                id, user_id, week_start, target_kcal, protein_g, carbs_g, fat_g,
                training_schedule_json, preferences_json
            )
            VALUES (
                :id, :user_id, :week_start, :target_kcal, :protein_g, :carbs_g, :fat_g,
                :training_schedule_json, :preferences_json
            )
            ON CONFLICT (id) DO UPDATE SET
                week_start = EXCLUDED.week_start
            """
        ),
        {
            "id": str(DEMO_WEEKLY_PLAN_ID),
            "user_id": str(demo_user_id),
            "week_start": week_start,
            "target_kcal": 2200,
            "protein_g": 160,
            "carbs_g": 230,
            "fat_g": 70,
            "training_schedule_json": "{\"days\":[\"Mon\",\"Wed\",\"Fri\"]}",
            "preferences_json": "{\"style\":\"simple\",\"notes\":\"demo seed\"}",
        },
    )

    # Create days + meals (4 meals/day). Idempotent via explicit IDs.
    meal_cycle = [
        ("breakfast", RECIPE_OVERNIGHT_OATS_ID, Decimal("1.00")),
        ("lunch", RECIPE_CHICKEN_RICE_ID, Decimal("1.00")),
        ("dinner", RECIPE_EGGS_BROCCOLI_ID, Decimal("1.00")),
        ("snack", RECIPE_OVERNIGHT_OATS_ID, Decimal("0.50")),
    ]

    for i in range(7):
        day_date = week_start + timedelta(days=i)
        day_id = DEMO_WEEKLY_PLAN_DAY_IDS[i]

        bind.execute(
            sa.text(
                """
                INSERT INTO weekly_plan_days (id, weekly_plan_id, date)
                VALUES (:id, :plan_id, :day_date)
                ON CONFLICT (id) DO UPDATE SET
                    date = EXCLUDED.date,
                    weekly_plan_id = EXCLUDED.weekly_plan_id
                """
            ),
            {"id": str(day_id), "plan_id": str(DEMO_WEEKLY_PLAN_ID), "day_date": day_date},
        )

        for meal_idx, (meal_type, recipe_id, servings) in enumerate(meal_cycle):
            meal_id = uuid.UUID(f"00000000-0000-0000-0000-00000000c{(i * 10 + meal_idx + 1):03d}")
            bind.execute(
                sa.text(
                    """
                    INSERT INTO weekly_plan_meals (id, weekly_plan_day_id, meal_type, recipe_id, servings, locked)
                    VALUES (:id, :day_id, :meal_type, :recipe_id, :servings, false)
                    ON CONFLICT (id) DO NOTHING
                    """
                ),
                {
                    "id": str(meal_id),
                    "day_id": str(day_id),
                    "meal_type": meal_type,
                    "recipe_id": str(recipe_id),
                    "servings": servings,
                },
            )


def downgrade() -> None:
    bind = op.get_bind()

    demo_user_id = bind.execute(sa.text("SELECT id FROM users WHERE email = :email"), {"email": DEMO_EMAIL}).scalar_one_or_none()
    if demo_user_id is None:
        return

    # Only operate if the email belongs to the expected stable demo user.
    if str(demo_user_id) != str(DEMO_USER_ID):
        return

    # Delete only the seeded weekly plan (CASCADE removes its days/meals).
    bind.execute(sa.text("DELETE FROM weekly_plans WHERE id = :id"), {"id": str(DEMO_WEEKLY_PLAN_ID)})

    # Favorites + tag links (scoped to seeded data)
    bind.execute(sa.text("DELETE FROM user_recipe_favorites WHERE user_id = :user_id"), {"user_id": str(DEMO_USER_ID)})

    bind.execute(
        sa.text("DELETE FROM recipe_tag_links WHERE recipe_id = ANY(:recipe_ids)"),
        {"recipe_ids": [str(RECIPE_CHICKEN_RICE_ID), str(RECIPE_OVERNIGHT_OATS_ID), str(RECIPE_EGGS_BROCCOLI_ID)]},
    )

    # Recipes (CASCADE will remove recipe_items)
    bind.execute(
        sa.text("DELETE FROM recipes WHERE id = ANY(:recipe_ids)"),
        {"recipe_ids": [str(RECIPE_CHICKEN_RICE_ID), str(RECIPE_OVERNIGHT_OATS_ID), str(RECIPE_EGGS_BROCCOLI_ID)]},
    )

    # Foods
    bind.execute(
        sa.text("DELETE FROM foods WHERE id = ANY(:food_ids)"),
        {
            "food_ids": [
                str(FOOD_CHICKEN_ID),
                str(FOOD_RICE_ID),
                str(FOOD_BROCCOLI_ID),
                str(FOOD_EGG_ID),
                str(FOOD_OATS_ID),
            ]
        },
    )

    # Tags (only those we created, and only if unused)
    bind.execute(
        sa.text(
            """
            DELETE FROM recipe_tags
            WHERE name = ANY(:tag_names)
              AND id NOT IN (SELECT DISTINCT tag_id FROM recipe_tag_links)
            """
        ),
        {"tag_names": ["demo", "quick", "high-protein"]},
    )

    # User
    bind.execute(sa.text("DELETE FROM users WHERE id = :id"), {"id": str(DEMO_USER_ID)})
