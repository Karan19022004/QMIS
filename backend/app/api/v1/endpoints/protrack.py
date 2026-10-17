"""ProTrack365 proxy endpoints for Transport Manager + Parent/Student track views."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_user, role_code_for
from app.models import User
from app.services import protrack as svc
from app.services.errors import fail

router = APIRouter(prefix="/api/v1/protrack", tags=["protrack"])

_ALLOWED = {
    "admin",
    "superadmin",
    "managing_director",
    "transportmanager",
    "driver",
    "principal",
    "director",
    "jointdirector",
    "parent",
    "student",
    "prm",
}
_ADMIN_PANELS = {
    "admin",
    "superadmin",
    "managing_director",
    "transportmanager",
    "driver",
    "principal",
    "director",
    "jointdirector",
    "prm",
}
_PARENT_PANELS = {"parent", "student"}


def _ensure_allowed(db: Session, user: User) -> str:
    code = role_code_for(db, user)
    if code not in _ALLOWED:
        fail(403, "forbidden", "You are not allowed to use bus tracking.")
    return code


def _panel_for(code: str, requested: str | None) -> str:
    requested = (requested or "").strip().lower()
    if requested in {"admin", "parent"}:
        if requested == "admin" and code not in _ADMIN_PANELS:
            fail(403, "forbidden", "Only transport/admin roles may use the ProTrack admin panel.")
        if requested == "parent" and code not in _PARENT_PANELS | _ADMIN_PANELS:
            fail(403, "forbidden", "Only parent/student (or admin) may use the ProTrack parent panel.")
        return requested
    if code in _PARENT_PANELS:
        return "parent" if svc.status_summary()["parentConfigured"] else "admin"
    return "admin"


@router.get("/status")
def status_route(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    _ensure_allowed(db, user)
    return svc.status_summary()


@router.get("/devices")
def devices_route(
    panel: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    code = _ensure_allowed(db, user)
    return svc.list_devices(_panel_for(code, panel))


@router.get("/track")
def track_route(
    imeis: str = Query(..., description="Comma-separated IMEI list"),
    panel: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    code = _ensure_allowed(db, user)
    parts = [part.strip() for part in imeis.split(",") if part.strip()]
    return svc.track_imeis(parts, _panel_for(code, panel))
