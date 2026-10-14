from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import require_permission
from app.models import User
from app.services import tc_requests as svc

router = APIRouter(prefix="/api/v1/tc-requests", tags=["tc-requests"])


class CreateIn(BaseModel):
    studentRef: str
    reason: str
    transferTo: str
    lastDateOfAttendance: date | None = None
    requestedBy: str | None = None


class RemarksIn(BaseModel):
    remarks: str = ""


class DecideIn(BaseModel):
    decision: str
    remarks: str = ""


@router.get("")
def list_route(db: Session = Depends(get_db), user: User = Depends(require_permission("tc.read"))) -> list[dict]:
    return svc.list_requests(db, user)


@router.get("/{ref}")
def get_route(ref: str, db: Session = Depends(get_db), user: User = Depends(require_permission("tc.read"))) -> dict:
    return svc.get_request(db, user, ref)


@router.post("", status_code=201)
def create_route(
    body: CreateIn, db: Session = Depends(get_db), user: User = Depends(require_permission("tc.write"))
) -> dict:
    return svc.create(
        db, user, student_ref=body.studentRef, reason=body.reason, transfer_to=body.transferTo,
        last_date=body.lastDateOfAttendance, requested_by=body.requestedBy,
    )


@router.post("/{ref}/forward")
def forward_route(
    ref: str, body: RemarksIn, db: Session = Depends(get_db), user: User = Depends(require_permission("tc.write"))
) -> dict:
    return svc.forward(db, user, ref, body.remarks)


@router.post("/{ref}/decide")
def decide_route(
    ref: str, body: DecideIn, db: Session = Depends(get_db), user: User = Depends(require_permission("tc.decide"))
) -> dict:
    return svc.decide(db, user, ref, decision=body.decision, remarks=body.remarks)
