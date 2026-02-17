from __future__ import annotations


import anyio


def test_food_favorite_happy_path(client, auth_headers, make_food_for_user, make_day, make_meal_entry):
    food = anyio.run(lambda: make_food_for_user(name="Fav Food"))

    # Favorite
    r = client.post(f"/foods/{food['id']}/favorite", headers=auth_headers)
    assert r.status_code == 204

    r = client.get("/foods/favorites", headers=auth_headers)
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == food["id"]
    assert items[0]["is_favorite"] is True

    # /foods only includes favorite signal when requested
    r = client.get("/foods?query=Fav", headers=auth_headers)
    assert r.status_code == 200
    items = r.json()["items"]
    assert any(i["id"] == food["id"] and i["is_favorite"] is False for i in items)

    r = client.get("/foods?query=Fav&include_favorite=true", headers=auth_headers)
    assert r.status_code == 200
    items = r.json()["items"]
    assert any(i["id"] == food["id"] and i["is_favorite"] is True for i in items)

    # Unfavorite
    r = client.delete(f"/foods/{food['id']}/favorite", headers=auth_headers)
    assert r.status_code == 204

    r = client.get("/foods/favorites", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["items"] == []


def test_food_recent(client, auth_headers, make_food_for_user, make_day, make_meal_entry):
    day = anyio.run(make_day)
    food1 = anyio.run(lambda: make_food_for_user(name="R1"))
    food2 = anyio.run(lambda: make_food_for_user(name="R2"))

    anyio.run(lambda: make_meal_entry(day_id=day["id"], meal_type="breakfast", food_id=food1["id"], grams=100))
    anyio.run(lambda: make_meal_entry(day_id=day["id"], meal_type="breakfast", food_id=food2["id"], grams=100))
    anyio.run(lambda: make_meal_entry(day_id=day["id"], meal_type="breakfast", food_id=food2["id"], grams=120))

    r = client.get("/foods/recent?limit=10", headers=auth_headers)
    assert r.status_code == 200
    items = r.json()["items"]
    ids = [i["id"] for i in items]
    assert food1["id"] in ids
    assert food2["id"] in ids


def test_food_favorite_requires_food_in_scope(client, auth_headers):
    r = client.post("/foods/00000000-0000-0000-0000-000000000000/favorite", headers=auth_headers)
    assert r.status_code == 404
