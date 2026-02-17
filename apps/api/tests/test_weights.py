from __future__ import annotations

from datetime import datetime, timezone

from fastapi.testclient import TestClient


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, email: str = "w@example.com") -> str:
    resp = client.post("/auth/register", json={"email": email, "password": "password123"})
    assert resp.status_code == 201
    return resp.json()["access_token"]


def test_weights_requires_auth(client: TestClient) -> None:
    assert client.get("/weights").status_code == 401
    assert client.post("/weights", json={"datetime": "2026-01-01T10:00:00Z", "weight_kg": 80}).status_code == 401


def test_post_and_list_weights_normalizes_datetime_to_utc(client: TestClient) -> None:
    token = _register(client, "w1@example.com")

    created = client.post(
        "/weights",
        headers=_auth_headers(token),
        json={"datetime": "2026-02-16T10:00:00+01:00", "weight_kg": 80.5, "note": "morning"},
    )
    assert created.status_code == 201
    body = created.json()
    assert body["note"] == "morning"
    # Expect UTC-ish: some serializers may omit the explicit "+00:00" suffix
    # while still returning the normalized clock time.
    assert body["datetime"].startswith("2026-02-16T09:00:00")

    listed = client.get("/weights", headers=_auth_headers(token))
    assert listed.status_code == 200
    items = listed.json()["items"]
    assert len(items) == 1

    dt = datetime.fromisoformat(items[0]["datetime"].replace("Z", "+00:00"))
    # Serializer may omit tz suffix; validate normalized wall clock time.
    assert dt.hour == 9


def test_get_weights_range_filter(client: TestClient) -> None:
    token = _register(client, "w2@example.com")

    for iso in [
        "2026-02-01T10:00:00Z",
        "2026-02-10T10:00:00Z",
        "2026-02-20T10:00:00Z",
    ]:
        resp = client.post("/weights", headers=_auth_headers(token), json={"datetime": iso, "weight_kg": 80.0})
        assert resp.status_code == 201

    filtered = client.get(
        "/weights",
        headers=_auth_headers(token),
        params={"from": "2026-02-05T00:00:00Z", "to": "2026-02-15T23:59:59Z"},
    )
    assert filtered.status_code == 200
    assert len(filtered.json()["items"]) == 1


def test_patch_and_delete_weight_entry(client: TestClient) -> None:
    token = _register(client, "w3@example.com")

    created = client.post(
        "/weights",
        headers=_auth_headers(token),
        json={"datetime": "2026-02-16T10:00:00Z", "weight_kg": 80.0},
    )
    entry_id = created.json()["id"]

    patched = client.patch(
        f"/weights/{entry_id}",
        headers=_auth_headers(token),
        json={"weight_kg": 81.25, "note": "after training"},
    )
    assert patched.status_code == 200
    assert patched.json()["weight_kg"] == 81.25
    assert patched.json()["note"] == "after training"

    # Explicit null clears note
    cleared = client.patch(
        f"/weights/{entry_id}",
        headers=_auth_headers(token),
        json={"note": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["note"] is None

    deleted = client.delete(f"/weights/{entry_id}", headers=_auth_headers(token))
    assert deleted.status_code == 204

    # Deleting again yields 404
    deleted2 = client.delete(f"/weights/{entry_id}", headers=_auth_headers(token))
    assert deleted2.status_code == 404


def test_weights_from_gt_to_returns_422(client: TestClient) -> None:
    token = _register(client, "w5@example.com")

    resp = client.get(
        "/weights",
        headers=_auth_headers(token),
        params={"from": "2026-02-16T10:00:01Z", "to": "2026-02-16T10:00:00Z"},
    )
    assert resp.status_code == 422


def test_naive_datetime_is_treated_as_utc_on_create(client: TestClient) -> None:
    token = _register(client, "w6@example.com")

    created = client.post(
        "/weights",
        headers=_auth_headers(token),
        json={"datetime": "2026-02-16T10:00:00", "weight_kg": 80.0},
    )
    assert created.status_code == 201
    dt_str = created.json()["datetime"]
    dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
    # Serializer may omit explicit tz suffix; still verify the time wasn't shifted.
    assert dt.hour == 10


def test_cannot_access_other_users_entries(client: TestClient) -> None:
    token_a = _register(client, "wa@example.com")
    token_b = _register(client, "wb@example.com")

    created = client.post(
        "/weights",
        headers=_auth_headers(token_a),
        json={"datetime": "2026-02-16T10:00:00Z", "weight_kg": 80.0},
    )
    entry_id = created.json()["id"]

    # Patch as other user -> 404 (not found in their scope)
    patched = client.patch(f"/weights/{entry_id}", headers=_auth_headers(token_b), json={"weight_kg": 70.0})
    assert patched.status_code == 404

    deleted = client.delete(f"/weights/{entry_id}", headers=_auth_headers(token_b))
    assert deleted.status_code == 404


def test_weight_validation_range(client: TestClient) -> None:
    token = _register(client, "w4@example.com")

    low = client.post(
        "/weights",
        headers=_auth_headers(token),
        json={"datetime": "2026-02-16T10:00:00Z", "weight_kg": 5},
    )
    assert low.status_code == 422

    high = client.post(
        "/weights",
        headers=_auth_headers(token),
        json={"datetime": "2026-02-16T10:00:00Z", "weight_kg": 999},
    )
    assert high.status_code == 422
