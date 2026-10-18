"""Dev helper: create/link parent-test@gmail.com for Tanya Castro admission."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.passwords import password_policy_message
from app.core.security import hash_password
from app.models import Admission, Role, Student, User

EMAIL = "parent-test@gmail.com"
PASSWORD = "Qmis@Parent2026!"


def main() -> None:
    msg = password_policy_message(PASSWORD, email=EMAIL)
    if msg:
        raise SystemExit(msg)

    db = SessionLocal()
    try:
        role = db.scalar(select(Role).where(Role.code == "parent"))
        if role is None:
            raise SystemExit("Parent role is not seeded.")

        admission = db.scalar(select(Admission).where(Admission.parent_account_email == EMAIL))
        user = db.scalar(select(User).where(User.email == EMAIL))
        campus_id = admission.campus_id if admission else None
        if campus_id is None:
            raise SystemExit("No admission with parent_account_email=parent-test@gmail.com")

        if user is None:
            user = User(
                campus_id=campus_id,
                role_id=role.id,
                email=EMAIL,
                password_hash=hash_password(PASSWORD),
                is_active=True,
                must_change_password=False,
            )
            db.add(user)
            db.flush()
            print(f"created user {user.id}")
        else:
            user.password_hash = hash_password(PASSWORD)
            user.is_active = True
            user.must_change_password = False
            print(f"updated password for {user.id}")

        admission.parent_user_id = user.id
        if admission.enrolled_student_id:
            student = db.get(Student, admission.enrolled_student_id)
            if student is not None:
                student.parent_user_id = user.id
                print(f"linked student {student.full_name}")

        db.commit()
        print(f"OK — login: {EMAIL} / {PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
