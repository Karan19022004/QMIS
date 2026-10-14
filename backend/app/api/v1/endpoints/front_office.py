from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import require_permission
from app.models import User
from app.services import front_office as svc

router = APIRouter(prefix="/api/v1/front-office", tags=["front-office"])


@router.get("/{collection}")
def list_route(
    collection: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("frontoffice.read")),
) -> list[dict]:
    return svc.list_records(db, user, collection)


@router.get("/{collection}/{public_id}")
def get_route(
    collection: str,
    public_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("frontoffice.read")),
) -> dict:
    return svc.get_record(db, user, collection, public_id)


@router.post("/{collection}", status_code=201)
def create_route(
    collection: str,
    body: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("frontoffice.write")),
) -> dict:
    return svc.create_record(db, user, collection, body)


@router.put("/{collection}/{public_id}")
def replace_route(
    collection: str,
    public_id: str,
    body: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("frontoffice.write")),
) -> dict:
    return svc.update_record(db, user, collection, public_id, body)


@router.delete("/{collection}/{public_id}", status_code=204)
def delete_route(
    collection: str,
    public_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("frontoffice.write")),
) -> Response:
    svc.delete_record(db, user, collection, public_id)
    return Response(status_code=204)
