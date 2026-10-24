"""Geo helpers — resolve Google Maps share links for transport pickup/destination."""

from __future__ import annotations

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_user, role_code_for
from app.models import User
from app.services import maps_resolve as svc
from app.services.errors import fail

router = APIRouter(prefix="/api/v1/geo", tags=["geo"])

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


class ResolveMapsBody(BaseModel):
    url: str = Field(..., min_length=8, max_length=2048)


@router.post("/resolve-maps-url")
def resolve_maps_url(
    body: ResolveMapsBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    code = role_code_for(db, user)
    if code not in _ALLOWED:
        fail(403, "forbidden", "You are not allowed to resolve map links.")
    return svc.resolve_google_maps_url(body.url)
