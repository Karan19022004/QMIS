"""Live smoke: create synthetic admission → enroll parent → login as parent.

Usage (API already running on :8000):
  python scripts/smoke_parent_login.py
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from uuid import uuid4

BASE = "http://127.0.0.1:8000/api/v1"


def call(method: str, path: str, token: str | None = None, body: dict | None = None):
    data = None if body is None else json.dumps(body).encode()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()
        try:
            payload = json.loads(raw)
        except Exception:
            payload = raw
        return exc.code, payload


def main() -> int:
    suffix = uuid4().hex[:8]
    parent_email = f"smoke.parent.{suffix}@example.com"
    parent_password = "parent12"
    child_name = f"Smoke Child {suffix}"

    st, login = call("POST", "/auth/login", body={"email": "admin@qmis.edu", "password": "admin123"})
    if st != 200:
        print("FAIL admin login", st, login)
        return 1
    admin = login["access_token"]
    print("PASS admin login")

    st, enquiry = call(
        "POST",
        "/admissions/enquiries",
        token=admin,
        body={
            "name": child_name,
            "mobile_number": "9000099999",
            "class_name": "Grade 1",
            "email": parent_email,
            "source": "Automation",
        },
    )
    if st != 201:
        print("FAIL create enquiry", st, enquiry)
        return 1
    print("PASS create enquiry", enquiry["enquiry_code"])

    st, admission = call("POST", f"/admissions/enquiries/{enquiry['id']}/convert", token=admin)
    if st != 200:
        print("FAIL convert", st, admission)
        return 1
    print("PASS convert", admission["admission_code"])

    st, patched = call(
        "PATCH",
        f"/admissions/{admission['id']}",
        token=admin,
        body={
            "first_name": "Smoke",
            "last_name": f"Child {suffix}",
            "mobile_number": "9000099999",
            "class_name": "Grade 1",
            "parent_account_email": parent_email,
        },
    )
    if st != 200:
        print("FAIL patch parent email", st, patched)
        return 1
    print("PASS save parent email")

    st, enrolled = call(
        "POST",
        f"/admissions/{admission['id']}/enroll",
        token=admin,
        body={
            "parent_account_email": parent_email,
            "parent_account_password": parent_password,
        },
    )
    if st != 200:
        print("FAIL enroll", st, enrolled)
        return 1
    print("PASS enroll", enrolled.get("student_code"), "parent_created=", enrolled.get("parent_created"))

    st, parent_login = call(
        "POST",
        "/auth/login",
        body={"email": parent_email, "password": parent_password},
    )
    if st != 200 or parent_login.get("role") != "parent":
        print("FAIL parent login", st, parent_login)
        return 1
    print("PASS parent login", parent_email)

    st, me = call("GET", "/auth/me", token=parent_login["access_token"])
    if st != 200 or me.get("role") != "parent":
        print("FAIL parent /me", st, me)
        return 1
    print("PASS parent /me")

    st, children = call("GET", "/parents/me/children", token=parent_login["access_token"])
    if st != 200 or not isinstance(children, list) or len(children) < 1:
        print("FAIL /parents/me/children", st, children)
        return 1
    print("PASS /parents/me/children", children[0].get("name"), children[0].get("admissionNumber"))

    print("---")
    print("Synthetic parent ready for UI:")
    print(f"  email:    {parent_email}")
    print(f"  password: {parent_password}")
    print("All smoke checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
