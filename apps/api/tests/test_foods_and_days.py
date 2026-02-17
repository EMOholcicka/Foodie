from __future__ import annotations

from fastapi.testclient import TestClient


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, email: str) -> str:
    resp = client.post("/auth/register", json={"email": email, "password": "password123"})
    assert resp.status_code == 201
    return resp.json()["access_token"]


def test_foods_requires_auth(client: TestClient) -> None:
    assert client.get("/foods").status_code == 401
    assert client.post(
        "/foods",
        json={
            "name": "Banana",
            "kcal_100g": 89,
            "protein_100g": 1.1,
            "carbs_100g": 22.8,
            "fat_100g": 0.3,
        },
    ).status_code == 401


def test_create_search_and_update_food_enforces_ownership(client: TestClient) -> None:
    token_a = _register(client, "fa@example.com")
    token_b = _register(client, "fb@example.com")

    created = client.post(
        "/foods",
        headers=_auth_headers(token_a),
        json={
            "name": "Banana",
            "brand": "",
            "kcal_100g": 89,
            "protein_100g": 1.1,
            "carbs_100g": 22.8,
            "fat_100g": 0.3,
        },
    )
    assert created.status_code == 201
    food_id = created.json()["id"]

    # Search finds it for same user
    listed = client.get("/foods", headers=_auth_headers(token_a), params={"query": "ban"})
    assert listed.status_code == 200
    assert any(i["id"] == food_id for i in listed.json()["items"])

    # Other user can see it? (user-owned should NOT be visible) -> should not appear
    listed_b = client.get("/foods", headers=_auth_headers(token_b), params={"query": "ban"})
    assert listed_b.status_code == 200
    assert all(i["id"] != food_id for i in listed_b.json()["items"])

    # Other user cannot update it
    denied = client.put(
        f"/foods/{food_id}",
        headers=_auth_headers(token_b),
        json={"kcal_100g": 90},
    )
    assert denied.status_code == 404

    updated = client.put(
        f"/foods/{food_id}",
        headers=_auth_headers(token_a),
        json={"kcal_100g": 90},
    )
    assert updated.status_code == 200
    assert updated.json()["kcal_100g"] == 90


def test_day_add_entries_and_totals(client: TestClient) -> None:
    token = _register(client, "d1@example.com")

    food = client.post(
        "/foods",
        headers=_auth_headers(token),
        json={
            "name": "Rice",
            "kcal_100g": 130,
            "protein_100g": 2.7,
            "carbs_100g": 28.0,
            "fat_100g": 0.3,
        },
    )
    food_id = food.json()["id"]

    add = client.post(
        "/days/2026-02-17/entries",
        headers=_auth_headers(token),
        json=[
            {"meal_type": "breakfast", "food_id": food_id, "grams": 150},
            {"meal_type": "lunch", "food_id": food_id, "grams": 200},
        ],
    )
    assert add.status_code == 201

    day = client.get("/days/2026-02-17", headers=_auth_headers(token))
    assert day.status_code == 200
    body = day.json()

    # Breakfast totals: 150g => 1.5x
    breakfast = next(m for m in body["meals"] if m["meal_type"] == "breakfast")
    assert breakfast["totals"]["kcal"] == 195.0
    assert breakfast["totals"]["protein_g"] == 4.05
    assert breakfast["totals"]["carbs_g"] == 42.0
    assert breakfast["totals"]["fat_g"] == 0.45

    # Day totals: 150g + 200g = 350g => 3.5x
    assert body["totals"]["kcal"] == 455.0
    assert body["totals"]["protein_g"] == 9.45
    assert body["totals"]["carbs_g"] == 98.0
    assert body["totals"]["fat_g"] == 1.05


def test_day_get_empty_is_not_404(client: TestClient) -> None:
    token = _register(client, "d2@example.com")

    day = client.get("/days/2026-02-18", headers=_auth_headers(token))
    assert day.status_code == 200
    body = day.json()
    assert body["totals"]["kcal"] == 0
    assert sum(len(m["entries"]) for m in body["meals"]) == 0


def test_day_add_entries_grams_must_be_gt_0(client: TestClient) -> None:
    token = _register(client, "d_grams@example.com")

    food = client.post(
        "/foods",
        headers=_auth_headers(token),
        json={
            "name": "Oats",
            "kcal_100g": 389,
            "protein_100g": 16.9,
            "carbs_100g": 66.3,
            "fat_100g": 6.9,
        },
    )
    assert food.status_code == 201
    food_id = food.json()["id"]

    for bad in [0, -1]:
        resp = client.post(
            "/days/2026-02-17/entries",
            headers=_auth_headers(token),
            json=[{"meal_type": "breakfast", "food_id": food_id, "grams": bad}],
        )
        assert resp.status_code == 422


def test_day_add_entries_xor_food_and_recipe(client: TestClient) -> None:
    token = _register(client, "d_xor@example.com")

    # neither food_id nor recipe_id
    resp = client.post(
        "/days/2026-02-17/entries",
        headers=_auth_headers(token),
        json=[{"meal_type": "breakfast", "grams": 100}],
    )
    assert resp.status_code == 422

    # both food_id and recipe_id
    resp2 = client.post(
        "/days/2026-02-17/entries",
        headers=_auth_headers(token),
        json=[
            {
                "meal_type": "breakfast",
                "food_id": "00000000-0000-0000-0000-000000000000",
                "recipe_id": "00000000-0000-0000-0000-000000000001",
                "grams": 100,
            }
        ],
    )
    assert resp2.status_code == 422


def test_food_negative_macros_rejected(client: TestClient) -> None:
    token = _register(client, "f_neg@example.com")

    resp = client.post(
        "/foods",
        headers=_auth_headers(token),
        json={
            "name": "Bad food",
            "kcal_100g": -1,
            "protein_100g": 0,
            "carbs_100g": 0,
            "fat_100g": 0,
        },
    )
    assert resp.status_code == 422


def test_day_rounding_edge_cases(client: TestClient) -> None:
    token = _register(client, "d_round@example.com")

    food = client.post(
        "/foods",
        headers=_auth_headers(token),
        json={
            "name": "Rounding",
            "kcal_100g": 33.3333,
            "protein_100g": 10.005,
            "carbs_100g": 0,
            "fat_100g": 0,
        },
    )
    assert food.status_code == 201
    food_id = food.json()["id"]

    add = client.post(
        "/days/2026-02-17/entries",
        headers=_auth_headers(token),
        json=[{"meal_type": "breakfast", "food_id": food_id, "grams": 10}],
    )
    assert add.status_code == 201

    day = client.get("/days/2026-02-17", headers=_auth_headers(token))
    assert day.status_code == 200
    body = day.json()
    breakfast = next(m for m in body["meals"] if m["meal_type"] == "breakfast")
    entry = breakfast["entries"][0]

    # 10g => factor 0.1. Values should be rounded to 2 decimals in output.
    assert entry["macros"]["kcal"] == round(33.3333 * 0.1, 2)
    assert entry["macros"]["protein_g"] == round(10.005 * 0.1, 2)


def test_day_add_entry_food_must_exist(client: TestClient) -> None:
    token = _register(client, "d3@example.com")

    resp = client.post(
        "/days/2026-02-17/entries",
        headers=_auth_headers(token),
        json=[{"meal_type": "breakfast", "food_id": "00000000-0000-0000-0000-000000000000", "grams": 100}],
    )
    assert resp.status_code == 404
