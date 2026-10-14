from datetime import date

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import require_permission
from app.models import User
from app.services import announcements as svc

router = APIRouter(prefix="/api/v1/announcements", tags=["announcements"])


class ReplyIn(BaseModel):
    text: str


@router.get("/categories")
def categories_route(user: User = Depends(require_permission("announcements.read"))) -> list[str]:
    return svc.CATEGORIES


@router.get("")
def list_route(db: Session = Depends(get_db), user: User = Depends(require_permission("announcements.read"))) -> list[dict]:
    return svc.list_announcements(db, user)


@router.get("/{ref}")
def get_route(
    ref: str, db: Session = Depends(get_db), user: User = Depends(require_permission("announcements.read"))
) -> dict:
    return svc.get_announcement(db, user, ref)


@router.post("", status_code=201)
def create_route(
    title: str = Form(...),
    category: str = Form(...),
    message: str = Form(...),
    announcement_date: date | None = Form(None),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("announcements.write")),
) -> dict:
    return svc.create(
        db, user, title=title, category=category, message=message, announcement_date=announcement_date, upload=file
    )


@router.post("/{ref}/acknowledge")
def acknowledge_route(
    ref: str, db: Session = Depends(get_db), user: User = Depends(require_permission("announcements.read"))
) -> dict:
    return svc.acknowledge(db, user, ref)


@router.post("/{ref}/replies", status_code=201)
def reply_route(
    ref: str,
    body: ReplyIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("announcements.read")),
) -> dict:
    return svc.reply(db, user, ref, body.text)
