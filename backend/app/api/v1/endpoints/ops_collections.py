from typing import Any

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_user, require_permission
from app.models import User
from app.services import ops_collections as svc

router = APIRouter(prefix="/api/v1/ops", tags=["ops"])


@router.get("/my-transport")
def my_transport_route(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Parent/student view of their own route assignment. Not the campus fleet."""
    return svc.my_transport(db, user)


@router.get("/my-hostel")
def my_hostel_route(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Parent/student view of their own hostel assignment and payments."""
    return svc.my_hostel(db, user)


@router.get("/{collection}")
def list_route(
    collection: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("ops.read")),
) -> list[dict]:
    return svc.list_records(db, user, collection)


@router.put("/{collection}")
def replace_route(
    collection: str,
    items: list[Any] = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("ops.write")),
) -> list[dict]:
    return svc.replace_records(db, user, collection, items)
