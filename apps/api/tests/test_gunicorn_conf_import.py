from __future__ import annotations


def test_gunicorn_conf_imports() -> None:
    # Smoke test to catch syntax/import errors in the gunicorn config module.
    # NOTE: This file is imported by gunicorn at runtime.
    import app.core.gunicorn_conf  # noqa: F401
