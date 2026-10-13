"""Password policy for *setting* passwords.

The policy is applied when a password is created or changed (change-password, parent account
creation). It is deliberately NOT applied at login, so accounts created under the old, weaker
rule keep working until their owner next changes the password.
"""

import re
import secrets

from app.core.config import settings

MAX_PASSWORD_BYTES = 72  # bcrypt silently ignores anything beyond 72 bytes

# Passwords that satisfy the length/character rules but are trivially guessable.
_COMMON_PASSWORDS = frozenset(
    {
        "password123",
        "password1234",
        "password12345",
        "passw0rd123",
        "qwerty12345",
        "qwertyuiop1",
        "1234567890a",
        "abcd123456",
        "abcdefg1234",
        "welcome1234",
        "welcome12345",
        "letmein1234",
        "iloveyou123",
        "admin12345",
        "administrator1",
        "changeme123",
        "school12345",
        "qmis123456",
        "qmis@123456",
        "parent12345",
        "teacher12345",
    }
)

_TEMP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"


def password_problems(password: str, *, email: str | None = None) -> list[str]:
    """Return human-readable reasons the password is unacceptable (empty list = acceptable)."""
    problems: list[str] = []
    minimum = settings.password_min_length
    if len(password) < minimum:
        problems.append(f"be at least {minimum} characters long")
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        problems.append(f"be at most {MAX_PASSWORD_BYTES} bytes long")
    if password != password.strip():
        problems.append("not start or end with a space")
    if not re.search(r"[A-Za-z]", password):
        problems.append("contain at least one letter")
    if not re.search(r"\d", password):
        problems.append("contain at least one number")
    lowered = password.lower()
    if lowered in _COMMON_PASSWORDS or len(set(lowered)) <= 3:
        problems.append("not be a common or repetitive password")
    if email:
        local_part = email.split("@", 1)[0].lower()
        if len(local_part) >= 4 and local_part in lowered:
            problems.append("not contain your email name")
    return problems


def password_policy_message(password: str, *, email: str | None = None) -> str | None:
    problems = password_problems(password, email=email)
    if not problems:
        return None
    return "Password must " + ", ".join(problems) + "."


def generate_temporary_password() -> str:
    """Random one-time password for staff accounts (always forced to change on first login)."""
    while True:
        body = "".join(secrets.choice(_TEMP_ALPHABET) for _ in range(10))
        candidate = f"Qmis@{body}"
        if not password_problems(candidate):
            return candidate
