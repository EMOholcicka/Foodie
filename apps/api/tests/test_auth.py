from __future__ import annotations

from fastapi.testclient import TestClient


def test_register_then_login(client: TestClient) -> None:
    register = client.post(
        "/auth/register",
        json={"email": "user@example.com", "password": "password123"},
    )
    assert register.status_code == 201
    body = register.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["refresh_token"]

    login = client.post(
        "/auth/login",
        json={"email": "user@example.com", "password": "password123"},
    )
    assert login.status_code == 200
    body2 = login.json()
    assert body2["access_token"]
    assert body2["refresh_token"]


def test_register_duplicate_email_409(client: TestClient) -> None:
    first = client.post(
        "/auth/register",
        json={"email": "dupe@example.com", "password": "password123"},
    )
    assert first.status_code == 201

    second = client.post(
        "/auth/register",
        json={"email": "dupe@example.com", "password": "password123"},
    )
    assert second.status_code == 409


def test_login_invalid_credentials_401(client: TestClient) -> None:
    resp = client.post(
        "/auth/login",
        json={"email": "missing@example.com", "password": "password123"},
    )
    assert resp.status_code == 401


def test_refresh_rotates_tokens_and_rejects_reuse(client: TestClient) -> None:
    register = client.post(
        "/auth/register",
        json={"email": "refresh@example.com", "password": "password123"},
    )
    assert register.status_code == 201
    refresh_token_1 = register.json()["refresh_token"]

    refreshed_1 = client.post("/auth/refresh", json={"refresh_token": refresh_token_1})
    assert refreshed_1.status_code == 200
    body_1 = refreshed_1.json()
    assert body_1["access_token"]
    assert body_1["refresh_token"]
    assert body_1["refresh_token"] != refresh_token_1

    # Replay of the already-rotated token must be rejected.
    replay = client.post("/auth/refresh", json={"refresh_token": refresh_token_1})
    assert replay.status_code == 401

    # The rotated token should still be usable (and rotate again).
    refresh_token_2 = body_1["refresh_token"]
    refreshed_2 = client.post("/auth/refresh", json={"refresh_token": refresh_token_2})
    assert refreshed_2.status_code == 200
    body_2 = refreshed_2.json()
    assert body_2["refresh_token"] != refresh_token_2


def test_refresh_rejects_access_token(client: TestClient) -> None:
    register = client.post(
        "/auth/register",
        json={"email": "wrongtype@example.com", "password": "password123"},
    )
    assert register.status_code == 201
    access = register.json()["access_token"]

    refreshed = client.post("/auth/refresh", json={"refresh_token": access})
    assert refreshed.status_code == 401
