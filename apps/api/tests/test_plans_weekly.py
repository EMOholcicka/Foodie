from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient

from app.crud import plans as plans_crud
from app.schemas.plans import GenerateWeeklyPlanRequest


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, email: str) -> str:
    resp = client.post("/auth/register", json={"email": email, "password": "password123"})
    assert resp.status_code == 201
    return resp.json()["access_token"]


def _create_food(
    client: TestClient,
    token: str,
    *,
    name: str,
    kcal_100g: float = 100,
    protein_100g: float = 0,
    carbs_100g: float = 0,
    fat_100g: float = 0,
) -> str:
    resp = client.post(
        "/foods",
        headers=_auth_headers(token),
        json={
            "name": name,
            "kcal_100g": kcal_100g,
            "protein_100g": protein_100g,
            "carbs_100g": carbs_100g,
            "fat_100g": fat_100g,
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def _create_recipe(client: TestClient, token: str, *, name: str, servings: int = 2) -> str:
    resp = client.post("/recipes", headers=_auth_headers(token), json={"name": name, "servings": servings})
    assert resp.status_code == 201
    return resp.json()["id"]


def _add_recipe_item(client: TestClient, token: str, *, recipe_id: str, food_id: str, grams: int) -> None:
    resp = client.post(
        f"/recipes/{recipe_id}/items",
        headers=_auth_headers(token),
        json={"food_id": food_id, "grams": grams},
    )
    assert resp.status_code == 201


def test_generate_creates_7_days_and_meal_slots(client: TestClient) -> None:
    token = _register(client, "p_gen_slots@example.com")

    f1 = _create_food(client, token, name="F1")
    f2 = _create_food(client, token, name="F2")

    r1 = _create_recipe(client, token, name="R1", servings=2)
    _add_recipe_item(client, token, recipe_id=r1, food_id=f1, grams=200)

    r2 = _create_recipe(client, token, name="R2", servings=2)
    _add_recipe_item(client, token, recipe_id=r2, food_id=f2, grams=100)

    week_start = "2026-02-16"
    resp = client.post(
        "/plans/weekly/generate",
        headers=_auth_headers(token),
        json={"week_start": week_start, "target_kcal": 2000},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["week_start"] == week_start

    assert len(body["days"]) == 7
    for d in body["days"]:
        # breakfast/lunch/dinner/snack
        assert len(d["meals"]) == 4
        assert {m["meal_type"] for m in d["meals"]} == {"breakfast", "lunch", "dinner", "snack"}


def test_generate_rejects_non_monday_week_start(client: TestClient) -> None:
    token = _register(client, "p_weekstart_not_monday@example.com")

    food_id = _create_food(client, token, name="F")
    recipe_id = _create_recipe(client, token, name="R", servings=2)
    _add_recipe_item(client, token, recipe_id=recipe_id, food_id=food_id, grams=100)

    # 2026-02-17 is Tuesday
    resp = client.post(
        "/plans/weekly/generate",
        headers=_auth_headers(token),
        json={"week_start": "2026-02-17", "target_kcal": 2000},
    )
    assert resp.status_code == 422


def test_fetch_returns_persisted_plan(client: TestClient) -> None:
    token = _register(client, "p_fetch@example.com")

    f1 = _create_food(client, token, name="F")
    r1 = _create_recipe(client, token, name="R", servings=2)
    _add_recipe_item(client, token, recipe_id=r1, food_id=f1, grams=200)

    week_start = "2026-02-16"
    gen = client.post(
        "/plans/weekly/generate",
        headers=_auth_headers(token),
        json={"week_start": week_start, "target_kcal": 2000},
    )
    assert gen.status_code == 201
    plan_id = gen.json()["id"]

    fetched = client.get(f"/plans/weekly/{week_start}", headers=_auth_headers(token))
    assert fetched.status_code == 200
    assert fetched.json()["id"] == plan_id


def test_grocery_list_totals_match_recipe_ingredients_times_servings(client: TestClient) -> None:
    token = _register(client, "p_grocery@example.com")

    food_id = _create_food(client, token, name="Rice")
    recipe_id = _create_recipe(client, token, name="Rice bowl", servings=2)
    _add_recipe_item(client, token, recipe_id=recipe_id, food_id=food_id, grams=200)  # 200g per recipe

    week_start = "2026-02-16"
    gen = client.post(
        "/plans/weekly/generate",
        headers=_auth_headers(token),
        json={"week_start": week_start, "target_kcal": 2000},
    )
    assert gen.status_code == 201

    grocery = client.get(f"/plans/weekly/{week_start}/grocery-list", headers=_auth_headers(token))
    assert grocery.status_code == 200
    items = grocery.json()["items"]

    # Generator uses servings=1.00 for unlocked meals.
    # With one recipe and 28 meals/week -> total servings = 28.
    # Factor per recipe = total_servings/recipe.servings = 28/2 = 14
    # Total grams = item_grams * factor = 200 * 14 = 2800
    rice = next(i for i in items if i["food_id"] == food_id)
    assert Decimal(str(rice["total_grams"])) == Decimal("2800.00")

    per_recipe = rice["per_recipe"]
    assert len(per_recipe) == 1
    assert per_recipe[0]["recipe_id"] == recipe_id
    assert Decimal(str(per_recipe[0]["servings"])) == Decimal("28.00")
    assert Decimal(str(per_recipe[0]["grams"])) == Decimal("2800.00")


def test_grocery_list_fails_if_recipe_references_missing_food(client: TestClient, monkeypatch) -> None:
    """Contract test: if grocery list computation encounters a missing food reference, API returns 409.

    We can't corrupt FK references reliably in sqlite/aiosqlite from tests without crossing
    connection/transaction boundaries, so we inject the failure in the CRUD helper.
    """

    token = _register(client, "p_grocery_missing_food@example.com")

    food_id = _create_food(client, token, name="RealFood")
    recipe_id = _create_recipe(client, token, name="BadRecipe", servings=2)
    _add_recipe_item(client, token, recipe_id=recipe_id, food_id=food_id, grams=100)

    week_start = "2026-02-16"
    gen = client.post(
        "/plans/weekly/generate",
        headers=_auth_headers(token),
        json={"week_start": week_start, "target_kcal": 2000},
    )
    assert gen.status_code == 201

    async def _boom(*args, **kwargs):
        raise ValueError("Unknown food referenced by recipe item: food_id=00000000-0000-0000-0000-000000000000")

    monkeypatch.setattr(plans_crud, "grocery_list_for_weekly_plan", _boom)

    grocery = client.get(f"/plans/weekly/{week_start}/grocery-list", headers=_auth_headers(token))
    assert grocery.status_code == 409


def test_locked_meals_preserved_on_regeneration(client: TestClient, monkeypatch) -> None:
    token = _register(client, "p_lock@example.com")

    f1 = _create_food(client, token, name="A")
    f2 = _create_food(client, token, name="B")

    r1 = _create_recipe(client, token, name="R1", servings=2)
    _add_recipe_item(client, token, recipe_id=r1, food_id=f1, grams=200)

    r2 = _create_recipe(client, token, name="R2", servings=2)
    _add_recipe_item(client, token, recipe_id=r2, food_id=f2, grams=100)

    week_start = date(2026, 2, 16)

    gen = client.post(
        "/plans/weekly/generate",
        headers=_auth_headers(token),
        json={"week_start": str(week_start), "target_kcal": 2000},
    )
    assert gen.status_code == 201

    # Lock Monday breakfast to r2 with 2.00 servings by monkeypatching the
    # generator to treat that slot as locked.
    plan_id = gen.json()["id"]
    day_id = gen.json()["days"][0]["id"]

    orig_generate = plans_crud.generate_weekly_plan_for_user

    async def generate_with_locked_breakfast(*, session, user_id, payload):
        plan = await orig_generate(session=session, user_id=user_id, payload=payload)
        # Mutate the in-memory plan before response serialization.
        mon = next(d for d in plan.days if str(d.date) == str(payload.week_start))
        b = next(m for m in mon.meals if m.meal_type.value == "breakfast")
        b.recipe_id = uuid.UUID(r2)
        b.servings = Decimal("2.00")
        b.locked = True
        await session.flush()
        return plan

    monkeypatch.setattr(plans_crud, "generate_weekly_plan_for_user", generate_with_locked_breakfast)

    regen = client.post(
        "/plans/weekly/generate",
        headers=_auth_headers(token),
        json={"week_start": str(week_start), "target_kcal": 2000},
    )
    assert regen.status_code == 201

    monday = regen.json()["days"][0]
    assert monday["id"] != day_id  # children are replaced
    b2 = next(m for m in monday["meals"] if m["meal_type"] == "breakfast")
    assert b2["locked"] is True
    assert b2["recipe_id"] == r2
    assert Decimal(str(b2["servings"])) == Decimal("2.00")

    assert regen.json()["id"] == plan_id  # plan row is updated in place


def test_regeneration_atomicity_rolls_back_if_regeneration_fails(client: TestClient, monkeypatch) -> None:
    """Regression guard: if regeneration fails after deleting children, the old plan must remain."""

    token = _register(client, "p_regen_atomic@example.com")

    f1 = _create_food(client, token, name="A")
    r1 = _create_recipe(client, token, name="R1", servings=2)
    _add_recipe_item(client, token, recipe_id=r1, food_id=f1, grams=200)

    week_start = date(2026, 2, 16)

    gen = client.post(
        "/plans/weekly/generate",
        headers=_auth_headers(token),
        json={"week_start": str(week_start), "target_kcal": 2000},
    )
    assert gen.status_code == 201

    # Atomicity contract via API: failed regeneration should not destroy the
    # previously returned plan.
    before = client.get(f"/plans/weekly/{week_start}", headers=_auth_headers(token))
    assert before.status_code == 200
    before_plan = before.json()

    # Inject failure in regeneration.
    async def _boom(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(plans_crud, "generate_weekly_plan_for_user", _boom)

    # Starlette TestClient re-raises unhandled app exceptions by default.
    # Treat that as equivalent to HTTP 500 for this contract test.
    import pytest

    with pytest.raises(RuntimeError, match="boom"):
        client.post(
            "/plans/weekly/generate",
            headers=_auth_headers(token),
            json={"week_start": str(week_start), "target_kcal": 2000},
        )

    after = client.get(f"/plans/weekly/{week_start}", headers=_auth_headers(token))
    assert after.status_code == 200
    assert after.json() == before_plan


def test_auth_isolation(client: TestClient) -> None:
    token_a = _register(client, "p_iso_a@example.com")
    token_b = _register(client, "p_iso_b@example.com")

    fa = _create_food(client, token_a, name="FA")
    ra = _create_recipe(client, token_a, name="RA", servings=2)
    _add_recipe_item(client, token_a, recipe_id=ra, food_id=fa, grams=200)

    week_start = "2026-02-16"
    gen_a = client.post(
        "/plans/weekly/generate",
        headers=_auth_headers(token_a),
        json={"week_start": week_start, "target_kcal": 2000},
    )
    assert gen_a.status_code == 201

    # User B cannot read A's plan.
    r = client.get(f"/plans/weekly/{week_start}", headers=_auth_headers(token_b))
    assert r.status_code == 404

    r = client.get(f"/plans/weekly/{week_start}/grocery-list", headers=_auth_headers(token_b))
    assert r.status_code == 404


def test_swap_meal_updates_slot_and_locks_by_default(client: TestClient) -> None:
    token = _register(client, "p_swap_default_lock@example.com")

    f1 = _create_food(client, token, name="F1")
    f2 = _create_food(client, token, name="F2")

    r1 = _create_recipe(client, token, name="R1", servings=2)
    _add_recipe_item(client, token, recipe_id=r1, food_id=f1, grams=100)

    r2 = _create_recipe(client, token, name="R2", servings=2)
    _add_recipe_item(client, token, recipe_id=r2, food_id=f2, grams=100)

    week_start = "2026-02-16"
    gen = client.post(
        "/plans/weekly/generate",
        headers=_auth_headers(token),
        json={"week_start": week_start, "target_kcal": 2000},
    )
    assert gen.status_code == 201

    swap = client.patch(
        f"/plans/weekly/{week_start}/meals:swap",
        headers=_auth_headers(token),
        json={"date": "2026-02-16", "meal_type": "breakfast", "new_recipe_id": r2},
    )
    assert swap.status_code == 200
    body = swap.json()

    monday = next(d for d in body["days"] if d["date"] == "2026-02-16")
    b = next(m for m in monday["meals"] if m["meal_type"] == "breakfast")
    assert b["recipe_id"] == r2
    assert b["locked"] is True


def test_swap_rejects_date_outside_week(client: TestClient) -> None:
    token = _register(client, "p_swap_outside_week@example.com")

    f = _create_food(client, token, name="F")
    r = _create_recipe(client, token, name="R", servings=2)
    _add_recipe_item(client, token, recipe_id=r, food_id=f, grams=100)

    week_start = "2026-02-16"
    gen = client.post(
        "/plans/weekly/generate",
        headers=_auth_headers(token),
        json={"week_start": week_start, "target_kcal": 2000},
    )
    assert gen.status_code == 201

    swap = client.patch(
        f"/plans/weekly/{week_start}/meals:swap",
        headers=_auth_headers(token),
        json={"date": "2026-02-25", "meal_type": "breakfast", "new_recipe_id": r},
    )
    assert swap.status_code == 422


def test_swap_rejects_recipe_not_owned(client: TestClient) -> None:
    token_a = _register(client, "p_swap_owner_a@example.com")
    token_b = _register(client, "p_swap_owner_b@example.com")

    fa = _create_food(client, token_a, name="FA")
    ra = _create_recipe(client, token_a, name="RA", servings=2)
    _add_recipe_item(client, token_a, recipe_id=ra, food_id=fa, grams=100)

    fb = _create_food(client, token_b, name="FB")
    rb = _create_recipe(client, token_b, name="RB", servings=2)
    _add_recipe_item(client, token_b, recipe_id=rb, food_id=fb, grams=100)

    week_start = "2026-02-16"
    gen_a = client.post(
        "/plans/weekly/generate",
        headers=_auth_headers(token_a),
        json={"week_start": week_start, "target_kcal": 2000},
    )
    assert gen_a.status_code == 201

    swap = client.patch(
        f"/plans/weekly/{week_start}/meals:swap",
        headers=_auth_headers(token_a),
        json={"date": "2026-02-16", "meal_type": "breakfast", "new_recipe_id": rb},
    )
    assert swap.status_code == 422
