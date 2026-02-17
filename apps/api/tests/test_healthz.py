from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

import app.db.session as db_session
from app.main import create_app


class _FakeConn:
    async def execute(self, *_args: Any, **_kwargs: Any) -> None:
        return None


class _FakeConnCtx:
    async def __aenter__(self) -> _FakeConn:
        return _FakeConn()

    async def __aexit__(
        self,
        _exc_type: type[BaseException] | None,
        _exc: BaseException | None,
        _tb: Any,
    ) -> None:
        return None


class _FakeEngine:
    def connect(self) -> _FakeConnCtx:
        return _FakeConnCtx()


def test_healthz_ok_even_if_db_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    # Simulate a broken DB configuration by making engine construction fail.
    def _boom(*args: Any, **kwargs: Any) -> Any:  # pragma: no cover
        raise RuntimeError("db down")

    monkeypatch.setattr(db_session, "get_engine", _boom)

    app = create_app()
    client = TestClient(app)

    resp = client.get("/healthz")

    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_readyz_ok(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(db_session, "get_engine", lambda: _FakeEngine())

    app = create_app()
    client = TestClient(app)

    resp = client.get("/readyz")

    assert resp.status_code == 200
    assert resp.json() == {"status": "ready"}


def test_readyz_503_when_db_check_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    class _BadConnCtx:
        async def __aenter__(self) -> Any:
            raise RuntimeError("db down")

        async def __aexit__(
            self,
            _exc_type: type[BaseException] | None,
            _exc: BaseException | None,
            _tb: Any,
        ) -> None:
            return None

    class _BadEngine:
        def connect(self) -> _BadConnCtx:
            return _BadConnCtx()

    monkeypatch.setattr(db_session, "get_engine", lambda: _BadEngine())

    app = create_app()
    client = TestClient(app)

    resp = client.get("/readyz")

    assert resp.status_code == 503
    assert resp.json() == {"status": "not_ready"}
