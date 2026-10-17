from typing import Any

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import require_permission
from app.models import User
from app.services import campus_audit_collections as svc

router = APIRouter(prefix="/api/v1/campus-audit", tags=["campus-audit"])


@router.get("/{collection}")
def list_route(
    collection: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("campus_audit.read")),
) -> list[dict]:
    return svc.list_records(db, user, collection)


@router.put("/{collection}")
def replace_route(
    collection: str,
    items: list[Any] = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("campus_audit.write")),
) -> list[dict]:
    return svc.replace_records(db, user, collection, items)
