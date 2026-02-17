from __future__ import annotations


def test_cors_preflight_allows_configured_origin(monkeypatch) -> None:
    # Settings are read when app.main.create_app() constructs Settings().
    monkeypatch.setenv("CORS_ORIGINS", "http://example.com")

    from app.main import create_app

    app = create_app()

    from fastapi.testclient import TestClient

    with TestClient(app) as client:
        resp = client.options(
            "/healthz",
            headers={
                "Origin": "http://example.com",
                "Access-Control-Request-Method": "GET",
            },
        )

    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://example.com"
    assert resp.headers.get("access-control-allow-credentials") == "true"


def test_cors_preflight_rejects_unlisted_origin(monkeypatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "http://allowed.com")

    from app.main import create_app

    app = create_app()

    from fastapi.testclient import TestClient

    with TestClient(app) as client:
        resp = client.options(
            "/healthz",
            headers={
                "Origin": "http://not-allowed.com",
                "Access-Control-Request-Method": "GET",
            },
        )

    # Starlette returns 400 for disallowed CORS preflight.
    assert resp.status_code == 400
    assert resp.headers.get("access-control-allow-origin") is None


def test_cors_invalid_star_with_credentials_fails_fast(monkeypatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "*")

    from app.main import create_app

    try:
        create_app()
    except ValueError as e:
        assert "Invalid CORS_ORIGINS" in str(e)
    else:
        raise AssertionError("Expected create_app() to fail fast for CORS_ORIGINS='*'")
