from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import require_permission
from app.models import User
from app.services import dashboard as svc

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.get("/dashboard")
def dashboard_route(
    db: Session = Depends(get_db), user: User = Depends(require_permission("dashboard.read"))
) -> dict:
    return svc.snapshot(db, user)
