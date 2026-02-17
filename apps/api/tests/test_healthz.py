from fastapi.testclient import TestClient

from app.main import create_app


def test_healthz_ok() -> None:
    app = create_app()
    client = TestClient(app)

    resp = client.get("/healthz")

    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_readyz_ok() -> None:
    app = create_app()
    client = TestClient(app)

    resp = client.get("/readyz")

    assert resp.status_code == 200
    assert resp.json() == {"status": "ready"}
