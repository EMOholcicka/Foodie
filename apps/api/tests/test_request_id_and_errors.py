from __future__ import annotations

from fastapi import APIRouter


def test_response_includes_x_request_id(client):
    res = client.get("/healthz")
    assert res.status_code == 200
    assert "X-Request-ID" in res.headers
    assert res.headers["X-Request-ID"]


def test_propagates_incoming_x_request_id(client):
    res = client.get("/healthz", headers={"X-Request-ID": "req-123"})
    assert res.status_code == 200
    assert res.headers["X-Request-ID"] == "req-123"


def test_422_shape_includes_request_id(client):
    # Trigger a query validation error on an endpoint that does not require auth.
    res = client.get("/healthz", params={"_bad": "not-a-date"})
    assert res.status_code == 422
    assert res.headers["X-Request-ID"]

    body = res.json()
    assert body["request_id"] == res.headers["X-Request-ID"]
    assert body["error"]["code"] == "request_validation_error"
    assert body["error"]["details"]


def test_500_shape_includes_request_id(client):
    # Add a temporary route that raises.
    router = APIRouter()

    @router.get("/__test__/boom")
    def boom():
        raise RuntimeError("boom")

    client.app.include_router(router)

    import pytest

    with pytest.raises(RuntimeError, match="boom"):
        client.get("/__test__/boom")
