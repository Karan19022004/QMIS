"""ProTrack365 proxy status + auth configuration gate."""

import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-phase0-local"
os.environ["ENVIRONMENT"] = "development"
os.environ["PROTRACK_ADMIN_ACCOUNT"] = ""
os.environ["PROTRACK_ADMIN_PASSWORD"] = ""

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


def _admin_headers(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": settings.admin_seed_email, "password": settings.admin_seed_password},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_protrack_status_unconfigured(client):
    headers = _admin_headers(client)
    response = client.get("/api/v1/protrack/status", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["configured"] is False
    assert body["adminConfigured"] is False


def test_protrack_devices_requires_credentials(client):
    headers = _admin_headers(client)
    response = client.get("/api/v1/protrack/devices", headers=headers)
    assert response.status_code == 503
    detail = response.json().get("detail") or {}
    assert detail.get("code") == "protrack_not_configured"
