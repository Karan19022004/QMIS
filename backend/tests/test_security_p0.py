"""P0 security hardening tests.

Covers: insecure-production startup refusal, OTP response consistency and debug gating,
login/OTP rate limiting and lockout, password policy, and development-only demo accounts.
Seeded demo credentials are read from settings, never hard-coded here.
"""

import os
import subprocess
import sys
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-phase0-local"

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import DEFAULT_JWT_SECRET, Settings, settings
from app.core.database import SessionLocal
from app.core.passwords import generate_temporary_password, password_problems
from app.main import app
from app.models import AuditLog, Base, OtpChallenge, User
from app.services.admissions import _ensure_parent_user
from app.services.rate_limit import RateLimiter, limiter
from app.services.seed import seed_reference_data

BACKEND_DIR = Path(__file__).resolve().parents[1]
STRONG_SECRET = "k3Jx9vQ2mZpL7wNd4RtYb8HsUe6CfAg1XoVi5BqMz0Ta"
ADMIN = (settings.admin_seed_email, settings.admin_seed_password)
STRONG_PASSWORD = "Fresh-Pass-2026-x"


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


def _login(client, email, password):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def _token(client):
    response = _login(client, *ADMIN)
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


class FakeClock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += seconds


@pytest.fixture()
def clock(monkeypatch):
    fake = FakeClock()
    monkeypatch.setattr(limiter, "_clock", fake)
    return fake


# --------------------------------------------------------------------------------------------
# 1. Startup refuses insecure non-development configuration
# --------------------------------------------------------------------------------------------

def _prod(**overrides):
    values = {
        "environment": "production",
        "jwt_secret": STRONG_SECRET,
        "otp_debug": False,
        "cors_origins": "https://erp.example.org",
        "integrations_mode": "",
        "database_url": "postgresql+psycopg://erp_user:Zq8-long-db-credential@db.internal:5432/erp",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_secure_production_config_is_accepted():
    config = _prod()
    assert not config.is_development
    assert not config.seed_demo_accounts
    assert not config.otp_debug_enabled


@pytest.mark.parametrize(
    "overrides, fragment",
    [
        ({"jwt_secret": DEFAULT_JWT_SECRET}, "JWT_SECRET is the shipped default"),
        ({"jwt_secret": "short-secret"}, "at least 32 characters"),
        ({"jwt_secret": "please-change-me-" + "x" * 30}, "placeholder"),
        ({"otp_debug": True}, "OTP_DEBUG must be false"),
        ({"cors_origins": "*"}, "not '*'"),
        ({"integrations_mode": "demo"}, "INTEGRATIONS_MODE=demo"),
        ({"database_url": "postgresql+psycopg://postgres:root@localhost:5432/qmis_erp"}, "default database password"),
    ],
)
def test_insecure_production_config_is_rejected(overrides, fragment, monkeypatch):
    monkeypatch.delenv("INTEGRATIONS_MODE", raising=False)
    with pytest.raises(ValidationError) as excinfo:
        _prod(**overrides)
    assert fragment in str(excinfo.value)
    assert "Refusing to start" in str(excinfo.value)


def _clean_env(monkeypatch):
    for key in ("ENVIRONMENT", "JWT_SECRET", "OTP_DEBUG", "INTEGRATIONS_MODE"):
        monkeypatch.delenv(key, raising=False)


def test_environment_defaults_to_production(monkeypatch):
    _clean_env(monkeypatch)
    with pytest.raises(ValidationError) as excinfo:
        Settings(_env_file=None)  # shipped defaults must not boot without explicit development
    assert "JWT_SECRET is the shipped default" in str(excinfo.value)


@pytest.mark.parametrize("name", ["staging", "prod", "production", "", "test"])
def test_only_explicit_development_names_relax_checks(name, monkeypatch):
    _clean_env(monkeypatch)
    with pytest.raises(ValidationError) as excinfo:
        Settings(_env_file=None, environment=name)
    assert "Refusing to start" in str(excinfo.value)


@pytest.mark.parametrize("name", ["development", "Development", "dev", "local"])
def test_explicit_development_allows_local_defaults(name):
    config = Settings(_env_file=None, environment=name, otp_debug=True)
    assert config.is_development
    assert config.otp_debug_enabled
    assert config.seed_demo_accounts


def _import_app_in_subprocess(extra_env):
    env = {key: value for key, value in os.environ.items() if key not in {"ENVIRONMENT", "JWT_SECRET", "OTP_DEBUG"}}
    env.update(extra_env)
    return subprocess.run(
        [sys.executable, "-c", "import app.main"],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )


def test_application_import_fails_with_insecure_production_environment():
    result = _import_app_in_subprocess(
        {"ENVIRONMENT": "production", "JWT_SECRET": DEFAULT_JWT_SECRET, "OTP_DEBUG": "true",
         "DATABASE_URL": "sqlite+pysqlite:///:memory:"}
    )
    assert result.returncode != 0
    assert "Refusing to start" in result.stderr
    assert "JWT_SECRET is the shipped default" in result.stderr


def test_application_import_succeeds_with_secure_production_environment():
    result = _import_app_in_subprocess(
        {"ENVIRONMENT": "production", "JWT_SECRET": STRONG_SECRET, "OTP_DEBUG": "false",
         "INTEGRATIONS_MODE": "", "CORS_ORIGINS": "https://erp.example.org",
         "DATABASE_URL": "sqlite+pysqlite:///:memory:"}
    )
    # Database URL is sqlite here only so the import has no external dependency.
    assert result.returncode == 0, result.stderr


# --------------------------------------------------------------------------------------------
# 2. Demo accounts exist only in development
# --------------------------------------------------------------------------------------------

def _fresh_session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def test_demo_accounts_are_not_created_in_production_mode(monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    db = _fresh_session()
    try:
        seed_reference_data(db)
        assert db.scalar(select(func.count()).select_from(User)) == 0
        assert db.scalar(select(User).where(User.email == settings.admin_seed_email.lower())) is None
    finally:
        db.close()


def test_demo_accounts_are_created_in_development_mode(monkeypatch):
    monkeypatch.setattr(settings, "environment", "development")
    db = _fresh_session()
    try:
        seed_reference_data(db)
        assert db.scalar(select(User).where(User.email == settings.admin_seed_email.lower())) is not None
        assert db.scalar(select(User).where(User.email == settings.hr_seed_email.lower())) is not None
    finally:
        db.close()


# --------------------------------------------------------------------------------------------
# 3. OTP: consistent responses and no debug disclosure outside development
# --------------------------------------------------------------------------------------------

UNKNOWN_EMAIL = "nobody.such.user@example.com"


def _shape(body):
    return {key: value for key, value in body.items() if key != "email"}


def test_otp_challenge_response_is_identical_for_known_and_unknown_accounts(client, monkeypatch):
    monkeypatch.setattr(settings, "otp_debug", False)
    known = client.post("/api/v1/auth/otp/challenge", json={"email": ADMIN[0]})
    unknown = client.post("/api/v1/auth/otp/challenge", json={"email": UNKNOWN_EMAIL})
    assert known.status_code == unknown.status_code == 200
    assert _shape(known.json()) == _shape(unknown.json())
    assert "debug_code" not in known.json()
    assert "debug_code" not in unknown.json()


def test_otp_challenge_for_unknown_account_creates_no_code_but_is_audited(client):
    client.post("/api/v1/auth/otp/challenge", json={"email": UNKNOWN_EMAIL})
    db = SessionLocal()
    try:
        assert db.scalar(select(OtpChallenge).where(OtpChallenge.email == UNKNOWN_EMAIL)) is None
        audited = db.scalar(
            select(AuditLog).where(AuditLog.action == "OTP_CHALLENGE_UNKNOWN", AuditLog.details == UNKNOWN_EMAIL)
        )
        assert audited is not None
    finally:
        db.close()


def test_debug_code_is_never_returned_outside_development(client, monkeypatch):
    monkeypatch.setattr(settings, "otp_debug", True)
    monkeypatch.setattr(settings, "environment", "production")
    body = client.post("/api/v1/auth/otp/challenge", json={"email": ADMIN[0]}).json()
    assert "debug_code" not in body


def test_debug_code_is_returned_only_in_development_with_flag(client, monkeypatch):
    monkeypatch.setattr(settings, "otp_debug", True)
    monkeypatch.setattr(settings, "environment", "development")
    body = client.post("/api/v1/auth/otp/challenge", json={"email": ADMIN[0]}).json()
    assert len(body["debug_code"]) == 6
    monkeypatch.setattr(settings, "otp_debug", False)
    limiter.reset()
    assert "debug_code" not in client.post("/api/v1/auth/otp/challenge", json={"email": ADMIN[0]}).json()


def test_otp_verify_failure_is_identical_for_known_and_unknown_accounts(client):
    client.post("/api/v1/auth/otp/challenge", json={"email": ADMIN[0]})
    known = client.post("/api/v1/auth/otp/verify", json={"email": ADMIN[0], "code": "000000"})
    unknown = client.post("/api/v1/auth/otp/verify", json={"email": UNKNOWN_EMAIL, "code": "000000"})
    assert known.status_code == unknown.status_code == 401
    assert known.json() == unknown.json()


# --------------------------------------------------------------------------------------------
# 4. Rate limiting and lockout
# --------------------------------------------------------------------------------------------

def test_rate_limiter_sliding_window_and_try_hit(clock):
    rl = RateLimiter(clock=clock)
    assert [rl.try_hit("k", 2, 60) for _ in range(3)] == [True, True, False]
    # The blocked attempt was not recorded, so it cannot extend the block.
    clock.advance(61)
    assert rl.try_hit("k", 2, 60) is True
    rl.lock("x", 30)
    assert rl.retry_after("x") == 31
    clock.advance(31)
    assert rl.retry_after("x") == 0


def test_login_is_locked_after_repeated_failures_for_known_account(client):
    for _ in range(settings.login_max_failures):
        assert _login(client, ADMIN[0], "wrong-password-1").status_code == 401
    blocked = _login(client, ADMIN[0], "wrong-password-1")
    assert blocked.status_code == 429
    assert blocked.json()["detail"]["code"] == "too_many_attempts"
    assert int(blocked.headers["Retry-After"]) > 0
    # Even the correct password is refused while locked.
    assert _login(client, *ADMIN).status_code == 429


def test_login_lockout_response_is_the_same_for_unknown_account(client):
    for _ in range(settings.login_max_failures):
        assert _login(client, UNKNOWN_EMAIL, "wrong-password-1").status_code == 401
    blocked = _login(client, UNKNOWN_EMAIL, "wrong-password-1")
    assert blocked.status_code == 429
    assert blocked.json()["detail"]["code"] == "too_many_attempts"
    assert "Retry-After" in blocked.headers


def test_login_lockout_expires_after_the_window(client, clock):
    for _ in range(settings.login_max_failures):
        _login(client, ADMIN[0], "wrong-password-1")
    assert _login(client, *ADMIN).status_code == 429
    clock.advance(settings.login_lockout_minutes * 60 + 5)
    assert _login(client, *ADMIN).status_code == 200


def test_successful_login_resets_the_failure_counter(client):
    for _ in range(settings.login_max_failures - 1):
        _login(client, ADMIN[0], "wrong-password-1")
    assert _login(client, *ADMIN).status_code == 200
    for _ in range(settings.login_max_failures - 1):
        assert _login(client, ADMIN[0], "wrong-password-1").status_code == 401
    assert _login(client, *ADMIN).status_code == 200


def test_login_lockout_is_audited(client):
    for _ in range(settings.login_max_failures):
        _login(client, ADMIN[0], "wrong-password-1")
    db = SessionLocal()
    try:
        assert db.scalar(select(AuditLog).where(AuditLog.action == "LOGIN_LOCKED", AuditLog.details == ADMIN[0])) is not None
    finally:
        db.close()


def test_one_client_ip_is_blocked_after_failures_across_many_accounts(client, monkeypatch):
    monkeypatch.setattr(settings, "login_ip_max_failures", 4)
    for index in range(4):
        assert _login(client, f"spray{index}@example.com", "wrong-password-1").status_code == 401
    assert _login(client, "spray-new@example.com", "wrong-password-1").status_code == 429
    assert _login(client, *ADMIN).status_code == 429


def test_otp_challenge_requests_are_rate_limited_for_known_and_unknown_accounts(client):
    for email in (ADMIN[0], UNKNOWN_EMAIL):
        limiter.reset()
        statuses = [
            client.post("/api/v1/auth/otp/challenge", json={"email": email}).status_code
            for _ in range(settings.otp_challenge_max_per_window + 1)
        ]
        assert statuses == [200] * settings.otp_challenge_max_per_window + [429]


def test_otp_verify_locks_out_and_burns_the_code(client, clock, monkeypatch):
    monkeypatch.setattr(settings, "otp_debug", True)
    code = client.post("/api/v1/auth/otp/challenge", json={"email": ADMIN[0]}).json()["debug_code"]
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(settings.otp_verify_max_failures):
        assert client.post("/api/v1/auth/otp/verify", json={"email": ADMIN[0], "code": wrong}).status_code == 401
    locked = client.post("/api/v1/auth/otp/verify", json={"email": ADMIN[0], "code": code})
    assert locked.status_code == 429
    assert "Retry-After" in locked.headers
    # After the lockout lifts the original code is still dead: it was burned by the lockout.
    clock.advance(settings.login_lockout_minutes * 60 + 5)
    retry = client.post("/api/v1/auth/otp/verify", json={"email": ADMIN[0], "code": code})
    assert retry.status_code == 401


def test_change_password_current_password_guessing_is_limited(client):
    headers = {"Authorization": f"Bearer {_token(client)}"}
    for _ in range(settings.login_max_failures):
        response = client.post(
            "/api/v1/auth/change-password",
            headers=headers,
            json={"current_password": "wrong-password-1", "new_password": STRONG_PASSWORD},
        )
        assert response.status_code == 401
    blocked = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"current_password": ADMIN[1], "new_password": STRONG_PASSWORD},
    )
    assert blocked.status_code == 429


# --------------------------------------------------------------------------------------------
# 5. Password validation
# --------------------------------------------------------------------------------------------

@pytest.mark.parametrize(
    "password, fragment",
    [
        ("Ab1", "at least 10"),
        ("abcdefghijkl", "at least one number"),
        ("1234567890123", "at least one letter"),
        ("password123", "common"),
        ("aaaaaaaaa1", "common or repetitive"),
        (" Valid-Pass-123", "start or end with a space"),
        ("Aa1" + "x" * 80, "at most 72 bytes"),
    ],
)
def test_password_policy_rejects_weak_passwords(password, fragment):
    assert any(fragment in problem for problem in password_problems(password))


def test_password_policy_rejects_email_name():
    assert password_problems("jessica.m-2026-pass", email="jessica.m@example.com") != []
    assert password_problems("Different-Pass-2026", email="jessica.m@example.com") == []


def test_password_policy_accepts_strong_passwords():
    for value in ("Fresh-Pass-2026-x", "correct horse 7 battery", "Qmis@" + "Zx8Kd2Mq4P"):
        assert password_problems(value) == [], value


def test_temporary_passwords_meet_the_policy_and_are_random():
    values = {generate_temporary_password() for _ in range(25)}
    assert len(values) == 25
    for value in values:
        assert password_problems(value) == []
        assert len(value) >= 15


def test_change_password_rejects_weak_password_and_keeps_old_one(client):
    headers = {"Authorization": f"Bearer {_token(client)}"}
    weak = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"current_password": ADMIN[1], "new_password": "abc123"},
    )
    assert weak.status_code == 422
    assert weak.json()["detail"]["code"] == "weak_password"
    assert "at least" in weak.json()["detail"]["message"]
    assert _login(client, *ADMIN).status_code == 200


def test_change_password_rejects_reusing_the_current_password(client):
    headers = {"Authorization": f"Bearer {_token(client)}"}
    response = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"current_password": ADMIN[1], "new_password": ADMIN[1]},
    )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "same_password"


def test_existing_accounts_with_older_weaker_passwords_can_still_log_in(client):
    # The seeded demo password predates the policy and does not satisfy it; login must not enforce it.
    assert password_problems(ADMIN[1]) != []
    assert _login(client, *ADMIN).status_code == 200


def test_strong_password_change_succeeds_and_new_password_works(client):
    from app.core.security import hash_password

    db = SessionLocal()
    try:
        email = "policy.user@example.com"
        admin = db.scalar(select(User).where(User.email == settings.admin_seed_email.lower()))
        user = User(
            campus_id=admin.campus_id,
            role_id=admin.role_id,
            email=email,
            password_hash=hash_password("Old-Pass-2025-ab"),
            is_active=True,
            must_change_password=True,
        )
        db.add(user)
        db.commit()
    finally:
        db.close()
    token = _login(client, "policy.user@example.com", "Old-Pass-2025-ab").json()["access_token"]
    # While must_change_password is set, only change-password / me / logout are allowed.
    blocked = client.get("/api/v1/hr/employees", headers={"Authorization": f"Bearer {token}"})
    assert blocked.status_code == 403
    assert blocked.json()["detail"]["code"] == "password_change_required"
    me_ok = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_ok.status_code == 200
    changed = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "Old-Pass-2025-ab", "new_password": STRONG_PASSWORD},
    )
    assert changed.status_code == 200
    assert _login(client, "policy.user@example.com", STRONG_PASSWORD).status_code == 200
    assert _login(client, "policy.user@example.com", "Old-Pass-2025-ab").status_code == 401


def test_parent_account_creation_enforces_password_policy(client):
    db = SessionLocal()
    try:
        admin = db.scalar(select(User).where(User.email == settings.admin_seed_email.lower()))
        with pytest.raises(HTTPException) as excinfo:
            _ensure_parent_user(db, admin, email="weak.parent@example.com", password="parent1", skip=False)
        assert excinfo.value.status_code == 400
        assert excinfo.value.detail["code"] == "weak_password"
        user, created = _ensure_parent_user(
            db, admin, email="strong.parent@example.com", password=STRONG_PASSWORD, skip=False
        )
        assert created and user.must_change_password is True
        db.rollback()
    finally:
        db.close()
