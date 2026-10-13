"""Pytest defaults: stub integrations (ignore demo mode from backend/.env) and run as development.

The API refuses to start with insecure settings unless ENVIRONMENT is development, and demo
accounts are only seeded in development, so the suite pins ENVIRONMENT before any app import.
Tests that exercise production behaviour build their own Settings / use subprocesses.
"""

import os

import pytest

# Initial process default before collection.
os.environ["INTEGRATIONS_MODE"] = ""
os.environ.setdefault("RFID_IMPORT_ENABLED", "false")
os.environ["ENVIRONMENT"] = "development"


@pytest.fixture(autouse=True)
def _stub_integrations_unless_test_overrides(monkeypatch):
    """Reset after any test that set INTEGRATIONS_MODE=demo; clear brute-force counters."""
    monkeypatch.setenv("INTEGRATIONS_MODE", "")
    monkeypatch.setenv("RFID_IMPORT_ENABLED", "false")
    try:
        from app.core import config

        config.settings.integrations_mode = ""
    except Exception:
        pass
    try:
        from app.services.rate_limit import limiter

        limiter.reset()
    except Exception:
        pass
    yield
    try:
        from app.services.rate_limit import limiter

        limiter.reset()
    except Exception:
        pass
