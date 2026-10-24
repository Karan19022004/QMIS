"""ProTrack365 GPS proxy — multi-account Open API with token cache keyed by account."""

from __future__ import annotations

import hashlib
import time
from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.services.errors import fail

BASE_URL = "https://api.protrack365.com"

# ProTrack docs: requesting a new access_token immediately invalidates the previous one.
# Cache MUST be keyed by account name (not UI panel), or admin+parent sharing one login
# will keep killing each other's tokens.
_token_cache: dict[str, dict[str, Any]] = {}
# imei → account that last listed / tracked it
_imei_owners: dict[str, str] = {}


def _md5(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def _configured_accounts() -> list[tuple[str, str, str]]:
    """
    Unique (label, account, password) entries for Open API calls.
    Order: admin primary, parent (if different), secondary fleet.
    """
    ordered: list[tuple[str, str, str]] = []
    seen_accounts: set[str] = set()

    def _add(label: str, account: str, password: str) -> None:
        account = (account or "").strip()
        password = (password or "").strip()
        if not account or not password:
            return
        key = account.lower()
        if key in seen_accounts:
            return
        seen_accounts.add(key)
        ordered.append((label, account, password))

    _add("admin", settings.protrack_admin_account, settings.protrack_admin_password)
    _add("parent", settings.protrack_parent_account, settings.protrack_parent_password)
    _add("secondary", settings.protrack_secondary_account, settings.protrack_secondary_password)
    return ordered


def _accounts_for_panel(panel: str) -> list[tuple[str, str, str]]:
    """Prefer parent account first for parent/student UI; otherwise admin-first order."""
    all_accounts = _configured_accounts()
    if not all_accounts:
        fail(
            503,
            "protrack_not_configured",
            "ProTrack365 credentials are not set. "
            "Add PROTRACK_ADMIN_ACCOUNT / PROTRACK_ADMIN_PASSWORD to backend/.env.",
        )
    panel = (panel or "admin").strip().lower()
    if panel != "parent":
        return all_accounts

    parent_acc = (settings.protrack_parent_account or "").strip().lower()
    if not parent_acc:
        return all_accounts
    preferred = [row for row in all_accounts if row[1].lower() == parent_acc]
    rest = [row for row in all_accounts if row[1].lower() != parent_acc]
    return preferred + rest


def _authorize_account(account: str, password: str, *, force: bool = False) -> str:
    cache_key = account.strip().lower()
    cached = _token_cache.get(cache_key)
    now = time.time()
    if not force and cached and cached.get("expires_at", 0) > now + 60:
        return str(cached["access_token"])

    unix_time = int(time.time())
    signature = _md5(_md5(password) + str(unix_time))
    url = f"{BASE_URL}/api/authorization"
    params = {"time": unix_time, "account": account, "signature": signature}
    try:
        with httpx.Client(timeout=20.0) as client:
            response = client.get(url, params=params)
    except httpx.HTTPError as exc:
        fail(502, "protrack_unreachable", f"Could not reach ProTrack365: {exc}")

    payload = response.json() if response.content else {}
    if response.status_code >= 400 or int(payload.get("code", -1)) != 0:
        message = payload.get("message") or response.text or "Authorization failed"
        fail(502, "protrack_auth_failed", f"ProTrack365 login failed ({account}): {message}")

    record = payload.get("record") or {}
    token = record.get("access_token")
    expires_in = int(record.get("expires_in") or 7200)
    if not token:
        fail(502, "protrack_auth_failed", "ProTrack365 returned no access_token.")
    _token_cache[cache_key] = {"access_token": token, "expires_at": now + expires_in, "password": password}
    return str(token)


def _get_for_account(account: str, password: str, path: str, params: dict[str, Any] | None = None) -> dict:
    token = _authorize_account(account, password)
    query = {"access_token": token, **(params or {})}
    url = f"{BASE_URL}{path}"
    try:
        with httpx.Client(timeout=25.0) as client:
            response = client.get(url, params=query)
    except httpx.HTTPError as exc:
        fail(502, "protrack_unreachable", f"Could not reach ProTrack365: {exc}")

    payload = response.json() if response.content else {}
    code = int(payload.get("code", 0))
    message = str(payload.get("message") or "").lower()
    # Token invalidated / expired — ProTrack also returns plain "access_token is invalid"
    if code in {1002, 1003, 1008} or "access_token is invalid" in message or "invalid access" in message:
        _token_cache.pop(account.strip().lower(), None)
        token = _authorize_account(account, password, force=True)
        query["access_token"] = token
        try:
            with httpx.Client(timeout=25.0) as client:
                response = client.get(url, params=query)
            payload = response.json() if response.content else {}
        except httpx.HTTPError as exc:
            fail(502, "protrack_unreachable", f"Could not reach ProTrack365: {exc}")

    if response.status_code >= 400 or int(payload.get("code", -1)) != 0:
        err_code = int(payload.get("code", -1))
        err_message = payload.get("message") or response.text or "ProTrack request failed"
        if err_code == 10007:
            err_message = (
                f"{err_message}. This IMEI is not assigned to the configured ProTrack account "
                "(ask the vendor to add the device to the Open API account)."
            )
        fail(502, "protrack_error", str(err_message))
    return payload


def _as_list(payload: dict) -> list[dict]:
    record = payload.get("record")
    if isinstance(record, list):
        return record
    if isinstance(record, dict):
        return [record]
    return []


def _list_devices_account(account: str, password: str) -> list[dict]:
    rows = _as_list(_get_for_account(account, password, "/api/device/list"))
    for row in rows:
        imei = str(row.get("imei") or "").strip()
        if imei:
            _imei_owners[imei] = account.strip().lower()
    return rows


def _track_account(account: str, password: str, imeis: list[str]) -> list[dict]:
    return _as_list(_get_for_account(account, password, "/api/track", {"imeis": ",".join(imeis)}))


def list_devices(panel: str = "admin") -> list[dict]:
    """Merge device lists across unique ProTrack accounts (dedupe by IMEI)."""
    accounts = _accounts_for_panel(panel)
    merged: dict[str, dict] = {}
    last_exc: HTTPException | None = None
    any_ok = False

    for _label, account, password in accounts:
        try:
            for row in _list_devices_account(account, password):
                imei = str(row.get("imei") or "").strip()
                key = imei or f"{account}:{row.get('platenumber') or id(row)}"
                if key not in merged:
                    merged[key] = row
            any_ok = True
        except HTTPException as exc:
            last_exc = exc
            continue

    if not any_ok and last_exc:
        raise last_exc
    return list(merged.values())


def track_imeis(imeis: list[str], panel: str = "admin") -> list[dict]:
    clean = [str(i).strip() for i in imeis if str(i).strip()]
    if not clean:
        fail(422, "invalid_body", "Provide at least one IMEI.")
    if len(clean) > 100:
        fail(422, "invalid_body", "Maximum 100 IMEIs per request.")

    accounts = _accounts_for_panel(panel)
    account_by_key = {acc.lower(): (label, acc, pw) for label, acc, pw in accounts}

    by_account: dict[str, list[str]] = {}
    unknown: list[str] = []
    for imei in clean:
        owner = _imei_owners.get(imei)
        if owner and owner in account_by_key:
            by_account.setdefault(owner, []).append(imei)
        else:
            unknown.append(imei)

    results: list[dict] = []
    last_exc: HTTPException | None = None

    for owner, group in by_account.items():
        _label, account, password = account_by_key[owner]
        try:
            results.extend(_track_account(account, password, group))
        except HTTPException as exc:
            last_exc = exc
            unknown.extend(group)

    for imei in unknown:
        tracked = False
        for _label, account, password in accounts:
            try:
                rows = _track_account(account, password, [imei])
                results.extend(rows)
                _imei_owners[imei] = account.strip().lower()
                tracked = True
                break
            except HTTPException as exc:
                last_exc = exc
                continue
        if not tracked and last_exc and len(clean) == 1:
            raise last_exc

    if not results and last_exc:
        raise last_exc
    return results


def status_summary() -> dict:
    accounts = _configured_accounts()
    labels = {label for label, _acc, _pw in accounts}
    return {
        "configured": bool(accounts),
        "adminConfigured": "admin" in labels or bool((settings.protrack_admin_account or "").strip()),
        "parentConfigured": bool((settings.protrack_parent_account or "").strip()),
        "secondaryConfigured": bool((settings.protrack_secondary_account or "").strip()),
        "baseUrl": BASE_URL,
        "accounts": {
            "admin": (settings.protrack_admin_account or "").strip() or None,
            "parent": (settings.protrack_parent_account or "").strip() or None,
            "secondary": (settings.protrack_secondary_account or "").strip() or None,
        },
        "uniqueOpenApiAccounts": [acc for _label, acc, _pw in accounts],
    }
