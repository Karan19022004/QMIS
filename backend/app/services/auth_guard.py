"""Brute-force protection for login and OTP endpoints.

Policy (all thresholds come from settings):
* Login: failed attempts are counted per email and per client IP. Reaching the limit locks that
  email (or IP) for ``login_lockout_minutes``. A locked email is refused even with the correct
  password. A successful login clears the email's failure counter.
* OTP challenge: every request is counted (known or unknown email alike, so the limiter does not
  reveal which accounts exist) per email and per IP in a sliding window.
* OTP verify: wrong codes are counted per email and per IP; reaching the limit locks the email
  and burns its outstanding code so it cannot be brute-forced across lockouts.

Lockouts are keyed on the email string only (not on whether the account exists), so a 429 never
discloses account existence. Trade-off: someone who knows an email can lock it out for the
lockout window; the window is short and every lockout is written to the audit log.
"""

import math
from datetime import datetime, timezone

from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import OtpChallenge
from app.services.audit import write_audit
from app.services.rate_limit import limiter


def client_ip(request: Request) -> str:
    if settings.trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for", "")
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else "unknown"


def _too_many(retry_after_seconds: int) -> None:
    seconds = max(1, int(retry_after_seconds))
    minutes = math.ceil(seconds / 60)
    raise HTTPException(
        status_code=429,
        detail={
            "code": "too_many_attempts",
            "message": f"Too many attempts. Try again in {minutes} minute{'s' if minutes != 1 else ''}.",
            "retry_after_seconds": seconds,
        },
        headers={"Retry-After": str(seconds)},
    )


def _lock_seconds() -> int:
    return settings.login_lockout_minutes * 60


# ---- login ---------------------------------------------------------------------------------

def _login_keys(email: str, ip: str) -> tuple[str, str]:
    return f"login:email:{email}", f"login:ip:{ip}"


def assert_login_allowed(email: str, ip: str) -> None:
    for key in _login_keys(email, ip):
        remaining = limiter.retry_after(key)
        if remaining:
            _too_many(remaining)


def record_login_failure(db: Session, email: str, ip: str) -> None:
    email_key, ip_key = _login_keys(email, ip)
    window = _lock_seconds()
    if limiter.hit(email_key, window) >= settings.login_max_failures:
        limiter.lock(email_key, window)
        limiter.clear_events(email_key)
        write_audit(db, action="LOGIN_LOCKED", entity_type="user", details=email)
    if limiter.hit(ip_key, window) >= settings.login_ip_max_failures:
        limiter.lock(ip_key, window)
        limiter.clear_events(ip_key)
        write_audit(db, action="LOGIN_IP_BLOCKED", entity_type="user", details=ip)


def record_login_success(email: str) -> None:
    limiter.clear(f"login:email:{email}")


# ---- OTP challenge -------------------------------------------------------------------------

def check_otp_challenge_allowed(email: str, ip: str) -> None:
    window = settings.otp_challenge_window_minutes * 60
    checks = (
        (f"otp-challenge:email:{email}", settings.otp_challenge_max_per_window),
        (f"otp-challenge:ip:{ip}", settings.otp_challenge_ip_max_per_window),
    )
    for key, limit in checks:
        if not limiter.try_hit(key, limit, window):
            age = limiter.oldest_age(key) or 0
            _too_many(window - age)


# ---- OTP verify ----------------------------------------------------------------------------

def assert_otp_verify_allowed(email: str, ip: str) -> None:
    for key in (f"otp-verify:email:{email}", f"otp-verify:ip:{ip}"):
        remaining = limiter.retry_after(key)
        if remaining:
            _too_many(remaining)


def record_otp_failure(db: Session, email: str, ip: str) -> None:
    window = _lock_seconds()
    email_key, ip_key = f"otp-verify:email:{email}", f"otp-verify:ip:{ip}"
    if limiter.hit(email_key, window) >= settings.otp_verify_max_failures:
        limiter.lock(email_key, window)
        limiter.clear_events(email_key)
        for challenge in db.scalars(
            select(OtpChallenge).where(OtpChallenge.email == email, OtpChallenge.consumed_at.is_(None))
        ).all():
            challenge.consumed_at = datetime.now(timezone.utc)
        write_audit(db, action="OTP_LOCKED", entity_type="user", details=email)
    if limiter.hit(ip_key, window) >= settings.otp_verify_ip_max_failures:
        limiter.lock(ip_key, window)
        limiter.clear_events(ip_key)
        write_audit(db, action="OTP_IP_BLOCKED", entity_type="user", details=ip)


def record_otp_success(email: str) -> None:
    limiter.clear(f"otp-verify:email:{email}")
