"""Shared auth helpers for pytest (module name avoids site-packages `tests` clashes)."""

from sqlalchemy import select


def login_headers(client, email: str, password: str) -> dict:
    """Authenticate and clear must_change_password so protected APIs are usable in tests.

    Clears the flag in the DB (password unchanged) so later tests can re-login with the
    same credentials — change-password would break shared seeded/fixture accounts.
    """
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    body = response.json()
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    if body.get("must_change_password"):
        from app.core.database import SessionLocal
        from app.models import User

        db = SessionLocal()
        try:
            user = db.scalar(select(User).where(User.email == email.strip().lower()))
            assert user is not None
            user.must_change_password = False
            db.commit()
        finally:
            db.close()
    return headers
