from __future__ import annotations

from decimal import Decimal

import sqlalchemy as sa
from fastapi.testclient import TestClient

import pytest


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
    kcal_100g: float,
    protein_100g: float,
    carbs_100g: float,
    fat_100g: float,
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


def test_create_recipe_requires_auth(client: TestClient) -> None:
    r = client.post("/recipes", json={"name": "R", "servings": 1})
    assert r.status_code == 401


def test_add_recipe_item_requires_auth(client: TestClient) -> None:
    token = _register(client, "r_auth@example.com")
    food_id = _create_food(client, token, name="F", kcal_100g=100, protein_100g=0, carbs_100g=0, fat_100g=0)

    r = client.post("/recipes", headers=_auth_headers(token), json={"name": "R", "servings": 1})
    assert r.status_code == 201
    recipe_id = r.json()["id"]

    r = client.post(f"/recipes/{recipe_id}/items", json={"food_id": food_id, "grams": 100})
    assert r.status_code == 401


@pytest.mark.parametrize("servings", [0, -1])
def test_create_recipe_invalid_servings(client: TestClient, servings: int) -> None:
    token = _register(client, f"r_invalid_servings_{servings}@example.com")

    r = client.post("/recipes", headers=_auth_headers(token), json={"name": "R", "servings": servings})
    assert r.status_code == 422


def test_create_recipe_missing_required_fields(client: TestClient) -> None:
    token = _register(client, "r_missing_fields@example.com")

    r = client.post("/recipes", headers=_auth_headers(token), json={})
    assert r.status_code == 422


@pytest.mark.parametrize("grams", [0, -1])
def test_add_item_invalid_grams(client: TestClient, grams: int) -> None:
    token = _register(client, f"r_invalid_grams_{grams}@example.com")
    food_id = _create_food(client, token, name="F", kcal_100g=100, protein_100g=0, carbs_100g=0, fat_100g=0)

    r = client.post("/recipes", headers=_auth_headers(token), json={"name": "R", "servings": 1})
    assert r.status_code == 201
    recipe_id = r.json()["id"]

    r = client.post(
        f"/recipes/{recipe_id}/items",
        headers=_auth_headers(token),
        json={"food_id": food_id, "grams": grams},
    )
    assert r.status_code == 422


def test_add_item_missing_required_fields(client: TestClient) -> None:
    token = _register(client, "r_item_missing_fields@example.com")
    food_id = _create_food(client, token, name="F", kcal_100g=100, protein_100g=0, carbs_100g=0, fat_100g=0)

    r = client.post("/recipes", headers=_auth_headers(token), json={"name": "R", "servings": 1})
    assert r.status_code == 201
    recipe_id = r.json()["id"]

    r = client.post(f"/recipes/{recipe_id}/items", headers=_auth_headers(token), json={})
    assert r.status_code == 422

    r = client.post(f"/recipes/{recipe_id}/items", headers=_auth_headers(token), json={"food_id": food_id})
    assert r.status_code == 422


@pytest.mark.parametrize("servings", [0, -1])
def test_patch_recipe_invalid_servings(client: TestClient, servings: int) -> None:
    token = _register(client, f"r_patch_invalid_servings_{servings}@example.com")

    r = client.post("/recipes", headers=_auth_headers(token), json={"name": "R", "servings": 1})
    assert r.status_code == 201
    recipe_id = r.json()["id"]

    r = client.patch(f"/recipes/{recipe_id}", headers=_auth_headers(token), json={"servings": servings})
    assert r.status_code == 422


def test_cross_user_patch_recipe_returns_404(client: TestClient) -> None:
    token_a = _register(client, "r_cross_patch_a@example.com")
    token_b = _register(client, "r_cross_patch_b@example.com")

    r = client.post("/recipes", headers=_auth_headers(token_a), json={"name": "R", "servings": 1})
    assert r.status_code == 201
    recipe_id = r.json()["id"]

    r = client.patch(f"/recipes/{recipe_id}", headers=_auth_headers(token_b), json={"servings": 2})
    assert r.status_code == 404


def test_cross_user_add_item_returns_404(client: TestClient) -> None:
    token_a = _register(client, "r_cross_item_a@example.com")
    token_b = _register(client, "r_cross_item_b@example.com")

    food_a_id = _create_food(client, token_a, name="FA", kcal_100g=100, protein_100g=0, carbs_100g=0, fat_100g=0)
    food_b_id = _create_food(client, token_b, name="FB", kcal_100g=100, protein_100g=0, carbs_100g=0, fat_100g=0)

    r = client.post("/recipes", headers=_auth_headers(token_a), json={"name": "R", "servings": 1})
    assert r.status_code == 201
    recipe_id = r.json()["id"]

    # User B cannot add items to user A recipe (even with user B food).
    r = client.post(
        f"/recipes/{recipe_id}/items",
        headers=_auth_headers(token_b),
        json={"food_id": food_b_id, "grams": 100},
    )
    assert r.status_code == 404

    # User B also cannot add their own food to user A recipe.
    r = client.post(
        f"/recipes/{recipe_id}/items",
        headers=_auth_headers(token_b),
        json={"food_id": food_a_id, "grams": 100},
    )
    assert r.status_code == 404


def test_create_recipe_add_items_and_compute_nutrition(client: TestClient) -> None:
    token = _register(client, "r1@example.com")

    food1_id = _create_food(client, token, name="F1", kcal_100g=100, protein_100g=10, carbs_100g=0, fat_100g=0)
    food2_id = _create_food(client, token, name="F2", kcal_100g=200, protein_100g=0, carbs_100g=20, fat_100g=0)

    r = client.post("/recipes", headers=_auth_headers(token), json={"name": "My recipe", "servings": 2})
    assert r.status_code == 201
    recipe_id = r.json()["id"]

    r = client.post(
        f"/recipes/{recipe_id}/items",
        headers=_auth_headers(token),
        json={"food_id": food1_id, "grams": 150},
    )
    assert r.status_code == 201

    r = client.post(
        f"/recipes/{recipe_id}/items",
        headers=_auth_headers(token),
        json={"food_id": food2_id, "grams": 50},
    )
    assert r.status_code == 201

    r = client.get(f"/recipes/{recipe_id}", headers=_auth_headers(token))
    assert r.status_code == 200
    body = r.json()

    assert Decimal(str(body["total_macros"]["kcal"])) == Decimal("250")
    assert Decimal(str(body["total_macros"]["protein"])) == Decimal("15")
    assert Decimal(str(body["total_macros"]["carbs"])) == Decimal("10")
    assert Decimal(str(body["total_macros"]["fat"])) == Decimal("0")

    assert Decimal(str(body["macros_per_serving"]["kcal"])) == Decimal("125")
    assert Decimal(str(body["macros_per_serving"]["protein"])) == Decimal("7.5")
    assert Decimal(str(body["macros_per_serving"]["carbs"])) == Decimal("5")
    assert Decimal(str(body["macros_per_serving"]["fat"])) == Decimal("0")


def test_update_servings_recomputes(client: TestClient) -> None:
    token = _register(client, "r2@example.com")
    food_id = _create_food(client, token, name="F", kcal_100g=100, protein_100g=0, carbs_100g=0, fat_100g=0)

    r = client.post("/recipes", headers=_auth_headers(token), json={"name": "R", "servings": 2})
    assert r.status_code == 201
    recipe_id = r.json()["id"]

    r = client.post(
        f"/recipes/{recipe_id}/items",
        headers=_auth_headers(token),
        json={"food_id": food_id, "grams": 100},
    )
    assert r.status_code == 201

    r = client.get(f"/recipes/{recipe_id}", headers=_auth_headers(token))
    assert Decimal(str(r.json()["macros_per_serving"]["kcal"])) == Decimal("50")

    r = client.patch(f"/recipes/{recipe_id}", headers=_auth_headers(token), json={"servings": 4})
    assert r.status_code == 200
    assert Decimal(str(r.json()["macros_per_serving"]["kcal"])) == Decimal("25")


def test_user_isolation(client: TestClient) -> None:
    token_a = _register(client, "ra@example.com")
    token_b = _register(client, "rb@example.com")

    food_id = _create_food(client, token_a, name="F", kcal_100g=100, protein_100g=0, carbs_100g=0, fat_100g=0)

    r = client.post("/recipes", headers=_auth_headers(token_a), json={"name": "R", "servings": 1})
    recipe_id = r.json()["id"]

    client.post(
        f"/recipes/{recipe_id}/items",
        headers=_auth_headers(token_a),
        json={"food_id": food_id, "grams": 100},
    )

    r = client.get(f"/recipes/{recipe_id}", headers=_auth_headers(token_b))
    assert r.status_code == 404

    r = client.delete(f"/recipes/{recipe_id}", headers=_auth_headers(token_b))
    assert r.status_code == 404


def test_delete_cascade_items(client: TestClient) -> None:
    token = _register(client, "r3@example.com")
    food_id = _create_food(client, token, name="F", kcal_100g=100, protein_100g=0, carbs_100g=0, fat_100g=0)

    r = client.post("/recipes", headers=_auth_headers(token), json={"name": "R", "servings": 1})
    recipe_id = r.json()["id"]

    r = client.post(
        f"/recipes/{recipe_id}/items",
        headers=_auth_headers(token),
        json={"food_id": food_id, "grams": 100},
    )
    item_id = r.json()["id"]

    r = client.delete(f"/recipes/{recipe_id}", headers=_auth_headers(token))
    assert r.status_code == 204

    r = client.delete(f"/recipes/{recipe_id}/items/{item_id}", headers=_auth_headers(token))
    assert r.status_code == 404


@pytest.mark.anyio
async def test_recipe_macros_ignore_out_of_scope_food(client: TestClient, session) -> None:
    token_a = _register(client, "r_scope_a@example.com")
    token_b = _register(client, "r_scope_b@example.com")

    # Food owned by user B.
    food_b_id = _create_food(client, token_b, name="FB", kcal_100g=100, protein_100g=0, carbs_100g=0, fat_100g=0)

    # User A recipe.
    r = client.post("/recipes", headers=_auth_headers(token_a), json={"name": "R", "servings": 1})
    assert r.status_code == 201
    recipe_id = r.json()["id"]

    # Compromise recipe_items directly (bypass API scoping) to reference user B's food.
    await session.execute(
        sa.text(
            """
            INSERT INTO recipe_items (id, recipe_id, food_id, grams, created_at, updated_at)
            VALUES (:id, :recipe_id, :food_id, :grams, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """
        ),
        {
            "id": "00000000-0000-0000-0000-000000000001",
            "recipe_id": str(recipe_id),
            "food_id": str(food_b_id),
            "grams": "100.00",
        },
    )
    await session.commit()

    res = client.get(f"/recipes/{recipe_id}", headers=_auth_headers(token_a))
    assert res.status_code == 200
    body = res.json()

    assert Decimal(str(body["total_macros"]["kcal"])) == Decimal("0")
    assert Decimal(str(body["macros_per_serving"]["kcal"])) == Decimal("0")
