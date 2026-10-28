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


@router.post("/it-support-tickets/raise", status_code=201)
def raise_ticket_route(
    body: dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Any signed-in user raises one IT ticket; it is added without touching the IT team's list."""
    return svc.raise_ticket(db, user, body)


@router.get("/it-support-tickets/mine")
def my_tickets_route(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    """The tickets the signed-in user raised, with their status and history."""
    return svc.my_tickets(db, user)


@router.get("/{collection}")
def list_route(
    collection: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("ops.read")),
) -> list[dict]:
    return svc.list_records(db, user, collection)


@router.put("/{collection}/items/{item_id}")
def upsert_item_route(
    collection: str,
    item_id: str,
    body: dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("ops.write")),
) -> dict:
    """Save one record of an item-saved collection (Star of the Month) without touching the others."""
    return svc.upsert_record(db, user, collection, item_id, body)


@router.delete("/{collection}/items/{item_id}")
def delete_item_route(
    collection: str,
    item_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("ops.write")),
) -> dict:
    return svc.delete_item(db, user, collection, item_id)


@router.put("/{collection}")
def replace_route(
    collection: str,
    items: list[Any] = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("ops.write")),
) -> list[dict]:
    return svc.replace_records(db, user, collection, items)
