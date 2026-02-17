from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient


def _register_and_get_access_token(*, client: TestClient) -> str:
    r = client.post(
        "/auth/register",
        json={"email": "targets@example.com", "password": "password123"},
    )
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def test_targets_requires_auth(client: TestClient) -> None:
    r = client.get("/targets")
    assert r.status_code == 401


def test_targets_get_404_when_not_set(client: TestClient) -> None:
    token = _register_and_get_access_token(client=client)
    r = client.get("/targets", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 404


def test_targets_set_and_get_roundtrip(client: TestClient) -> None:
    token = _register_and_get_access_token(client=client)

    payload = {
        "kcal_target": 2200,
        "protein_g": 170,
        "carbs_g": 230,
        "fat_g": 60,
        "effective_date": None,
    }
    put_r = client.put("/targets", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert put_r.status_code == 200, put_r.text

    data = put_r.json()
    assert data["kcal_target"] == 2200
    assert float(data["protein_g"]) == 170.0
    assert float(data["carbs_g"]) == 230.0
    assert float(data["fat_g"]) == 60.0
    assert data["effective_date"] is None
    assert isinstance(data["id"], str)

    get_r = client.get("/targets", headers={"Authorization": f"Bearer {token}"})
    assert get_r.status_code == 200
    get_data = get_r.json()
    assert get_data["id"] == data["id"]


def test_targets_at_date_precedence(client: TestClient) -> None:
    token = _register_and_get_access_token(client=client)

    # Create a default (NULL effective_date) target
    base_payload = {
        "kcal_target": 2000,
        "protein_g": 150,
        "carbs_g": 200,
        "fat_g": 56,
        "effective_date": None,
    }
    r0 = client.put("/targets", json=base_payload, headers={"Authorization": f"Bearer {token}"})
    assert r0.status_code == 200, r0.text
    base_id = r0.json()["id"]

    # Add dated targets (keep macros consistent with kcal_target to satisfy validation)
    d1_payload = {
        **base_payload,
        "kcal_target": 2100,
        "protein_g": 150,
        "carbs_g": 243,
        "fat_g": 60,
        "effective_date": "2026-01-10",
    }
    r1 = client.put("/targets", json=d1_payload, headers={"Authorization": f"Bearer {token}"})
    assert r1.status_code == 200, r1.text
    d1_id = r1.json()["id"]

    d2_payload = {
        **base_payload,
        "kcal_target": 2300,
        "protein_g": 160,
        "carbs_g": 270,
        "fat_g": 64,
        "effective_date": "2026-02-01",
    }
    r2 = client.put("/targets", json=d2_payload, headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200, r2.text
    d2_id = r2.json()["id"]

    # at_date before any dated -> fallback to NULL
    g0 = client.get(
        "/targets",
        params={"at_date": "2026-01-01"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert g0.status_code == 200
    assert g0.json()["id"] == base_id

    # at_date between dated targets -> pick latest <= at_date
    g1 = client.get(
        "/targets",
        params={"at_date": "2026-01-20"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert g1.status_code == 200
    assert g1.json()["id"] == d1_id

    # at_date after all dated targets -> pick latest
    g2 = client.get(
        "/targets",
        params={"at_date": "2026-02-10"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert g2.status_code == 200
    assert g2.json()["id"] == d2_id


@pytest.mark.anyio
async def test_targets_second_null_effective_date_fails(session) -> None:
    # Direct DB insertion to assert partial unique index behavior.
    from sqlalchemy.exc import IntegrityError

    from app.models.user import User
    from app.models.user_target import UserTarget

    user = User(email="nulluniq@example.com", password_hash="x")
    session.add(user)
    await session.flush()

    t1 = UserTarget(user_id=user.id, effective_date=None, kcal_target=2000, protein_g=100, carbs_g=200, fat_g=50)
    session.add(t1)
    await session.flush()

    t2 = UserTarget(user_id=user.id, effective_date=None, kcal_target=2100, protein_g=110, carbs_g=210, fat_g=55)
    session.add(t2)

    with pytest.raises(IntegrityError):
        await session.flush()


def test_targets_validation_rejects_macro_mismatch(client: TestClient) -> None:
    token = _register_and_get_access_token(client=client)

    # 10/10/10 => 170 kcal; mismatch should be rejected
    payload = {
        "kcal_target": 2200,
        "protein_g": 10,
        "carbs_g": 10,
        "fat_g": 10,
        "effective_date": None,
    }
    r = client.put("/targets", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 422


def test_targets_templates_and_scaling(client: TestClient) -> None:
    token = _register_and_get_access_token(client=client)

    r = client.get("/targets/templates", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    tpl = r.json()
    assert "templates" in tpl
    assert any(t["key"] == "recomp_2200" for t in tpl["templates"])

    scaled_r = client.get(
        "/targets/templates/recomp_2200/scaled?kcal_target=2750",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert scaled_r.status_code == 200
    scaled = scaled_r.json()
    assert scaled["targets"]["kcal_target"] == 2750
    assert scaled["targets"]["protein_g"] > 170
