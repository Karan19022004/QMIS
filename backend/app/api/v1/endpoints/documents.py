from datetime import date

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_user
from app.models import User
from app.services import documents as svc

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])


class RecordPatch(BaseModel):
    submitted_date: date | None = None
    status: str | None = None


@router.get("/{kind}")
def list_route(kind: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    return svc.list_records(db, user, kind)


@router.get("/{kind}/{ref}")
def get_route(kind: str, ref: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return svc.get_record(db, user, kind, ref)


@router.put("/{kind}/{ref}/items")
def put_item_route(
    kind: str,
    ref: str,
    label: str = Form(...),
    status: str | None = Form(None),
    submitted_date: date | None = Form(None),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    return svc.put_item(
        db, user, kind, ref, label=label, upload=file, status=status or None, submitted_date=submitted_date
    )


@router.patch("/{kind}/{ref}")
def patch_route(
    kind: str,
    ref: str,
    body: RecordPatch,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    return svc.update_record(db, user, kind, ref, submitted_date=body.submitted_date, status=body.status)


@router.delete("/{kind}/{ref}/items/{item_id}")
def delete_item_route(
    kind: str, ref: str, item_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    remaining = svc.delete_item(db, user, kind, ref, item_id)
    return {"deleted": True, "record": remaining}


@router.delete("/{kind}/{ref}", status_code=204)
def delete_route(kind: str, ref: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Response:
    svc.delete_record(db, user, kind, ref)
    return Response(status_code=204)
