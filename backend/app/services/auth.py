import secrets
from datetime import datetime, timedelta, timezone
from functools import cache

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.passwords import password_policy_message
from app.core.security import create_access_token, hash_password, verify_password
from app.deps import permission_codes_for, role_code_for
from app.models import Campus, OtpChallenge, Role, User
from app.services import auth_guard
from app.services.audit import write_audit
from app.services.errors import fail

OTP_CHALLENGE_MESSAGE = "If an account exists for this email, a one-time code has been generated."


@cache
def _dummy_hash() -> str:
    """A real bcrypt hash used to spend the same time when the account does not exist."""
    return hash_password(secrets.token_urlsafe(16))


def login(db: Session, email: str, password: str, ip: str = "unknown") -> dict:
    normalized = email.lower().strip()
    auth_guard.assert_login_allowed(normalized, ip)
    user = db.scalar(select(User).where(User.email == normalized))
    # Always run one bcrypt check so unknown and known emails take comparable time.
    password_ok = verify_password(password, user.password_hash if user else _dummy_hash())
    if user is None or not password_ok or not user.is_active:
        auth_guard.record_login_failure(db, normalized, ip)
        write_audit(db, action="LOGIN_FAILED", entity_type="user", details=normalized)
        db.commit()
        fail(401, "invalid_credentials", "Invalid email or password.")
    auth_guard.record_login_success(normalized)
    write_audit(
        db,
        action="LOGIN",
        entity_type="user",
        entity_id=str(user.id),
        actor_id=user.id,
        campus_id=user.campus_id,
    )
    db.commit()
    return _token_payload(db, user)


def start_otp(db: Session, email: str, ip: str = "unknown") -> dict:
    """Issue a one-time code. The response is identical for known and unknown emails."""
    normalized = email.lower().strip()
    auth_guard.check_otp_challenge_allowed(normalized, ip)
    user = db.scalar(select(User).where(User.email == normalized))
    body = {
        "email": normalized,
        "expires_in_minutes": settings.otp_expire_minutes,
        "message": OTP_CHALLENGE_MESSAGE,
    }
    code = f"{secrets.randbelow(1_000_000):06d}"
    code_hash = hash_password(code)  # same bcrypt cost whether or not the account exists
    if user is None or not user.is_active:
        write_audit(db, action="OTP_CHALLENGE_UNKNOWN", entity_type="user", details=normalized)
        db.commit()
        return body
    now = datetime.now(timezone.utc)
    for old in db.scalars(
        select(OtpChallenge).where(OtpChallenge.email == normalized, OtpChallenge.consumed_at.is_(None))
    ).all():
        old.consumed_at = now
    db.add(
        OtpChallenge(
            email=normalized,
            code_hash=code_hash,
            expires_at=now + timedelta(minutes=settings.otp_expire_minutes),
        )
    )
    write_audit(
        db,
        action="OTP_CHALLENGE",
        entity_type="user",
        entity_id=str(user.id),
        actor_id=user.id,
        campus_id=user.campus_id,
    )
    db.commit()
    # Development convenience only; never disclosed unless ENVIRONMENT=development and OTP_DEBUG=true.
    if settings.otp_debug_enabled:
        body["debug_code"] = code
    return body


def _otp_failed(db: Session, normalized: str, ip: str) -> None:
    auth_guard.record_otp_failure(db, normalized, ip)
    write_audit(db, action="OTP_FAILED", entity_type="user", details=normalized)
    db.commit()
    fail(401, "invalid_otp", "The code is invalid or expired.")


def verify_otp(db: Session, email: str, code: str, ip: str = "unknown") -> dict:
    normalized = email.lower().strip()
    auth_guard.assert_otp_verify_allowed(normalized, ip)
    now = datetime.now(timezone.utc)
    challenge = db.scalar(
        select(OtpChallenge)
        .where(OtpChallenge.email == normalized, OtpChallenge.consumed_at.is_(None))
        .order_by(OtpChallenge.created_at.desc())
    )
    if challenge is None:
        verify_password(code, _dummy_hash())  # keep timing comparable
        _otp_failed(db, normalized, ip)
    expires = challenge.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < now or not verify_password(code, challenge.code_hash):
        _otp_failed(db, normalized, ip)
    user = db.scalar(select(User).where(User.email == normalized))
    if user is None or not user.is_active:
        _otp_failed(db, normalized, ip)
    auth_guard.record_otp_success(normalized)
    challenge.consumed_at = now
    write_audit(
        db,
        action="OTP_VERIFIED",
        entity_type="user",
        entity_id=str(user.id),
        actor_id=user.id,
        campus_id=user.campus_id,
    )
    db.commit()
    return _token_payload(db, user)


def change_password(
    db: Session, user: User, current_password: str, new_password: str, ip: str = "unknown"
) -> dict:
    # A stolen token must not allow unlimited guessing of the current password.
    auth_guard.assert_login_allowed(user.email, ip)
    if not verify_password(current_password, user.password_hash):
        auth_guard.record_login_failure(db, user.email, ip)
        write_audit(
            db,
            action="PASSWORD_CHANGE_FAILED",
            entity_type="user",
            entity_id=str(user.id),
            actor_id=user.id,
            campus_id=user.campus_id,
        )
        db.commit()
        fail(401, "invalid_credentials", "Current password is incorrect.")
    if current_password == new_password:
        fail(422, "same_password", "Pick a new password that is different from the current one.")
    policy_message = password_policy_message(new_password, email=user.email)
    if policy_message:
        fail(422, "weak_password", policy_message)
    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    write_audit(
        db,
        action="PASSWORD_CHANGED",
        entity_type="user",
        entity_id=str(user.id),
        actor_id=user.id,
        campus_id=user.campus_id,
    )
    db.commit()
    return {"ok": True, "must_change_password": False}


def me_payload(db: Session, user: User) -> dict:
    role = db.get(Role, user.role_id)
    campus = db.get(Campus, user.campus_id)
    return {
        "id": user.id,
        "email": user.email,
        "role": role.code if role else "",
        "role_name": role.name if role else "",
        "campus": {
            "id": campus.id,
            "code": campus.code,
            "name": campus.name,
            "city": campus.city,
        }
        if campus
        else None,
        "permissions": permission_codes_for(db, user),
        "must_change_password": user.must_change_password,
        "is_active": user.is_active,
    }


def _token_payload(db: Session, user: User) -> dict:
    role = role_code_for(db, user)
    return {
        "access_token": create_access_token(user_id=str(user.id), role=role),
        "token_type": "bearer",
        "role": role,
        "must_change_password": user.must_change_password,
    }
