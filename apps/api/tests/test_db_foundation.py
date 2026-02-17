import os

import pytest
from pydantic import ValidationError


def test_settings_database_url_required(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)

    from app.core.settings import Settings

    with pytest.raises(ValidationError):
        Settings()


def test_db_session_module_importable(monkeypatch: pytest.MonkeyPatch) -> None:
    # Ensure settings can load
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://user:pass@localhost:5432/foodie")

    # Import should not connect (engine is lazy)
    from app.db import session as session_module  # noqa: F401

    assert hasattr(session_module, "get_engine")
