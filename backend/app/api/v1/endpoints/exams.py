from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import require_permission
from app.models import User
from app.services import exams as svc

router = APIRouter(prefix="/api/v1", tags=["exams"])


class ExamTypeIn(BaseModel):
    code: str = Field(min_length=1, max_length=24)
    name: str = Field(min_length=1, max_length=80)


class ExamIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    examType: str
    className: str = Field(min_length=1, max_length=40)
    startDate: date
    endDate: date


class WeightIn(BaseModel):
    examType: str
    weight: float


class WeightageIn(BaseModel):
    weights: list[WeightIn]


class EntryIn(BaseModel):
    studentId: str
    marks: float | None = None
    absent: bool = False
    remarks: str | None = None


class BatchIn(BaseModel):
    examId: UUID
    subject: str = Field(min_length=1, max_length=80)
    section: str | None = Field(default=None, max_length=16)
    maxMarks: float
    entries: list[EntryIn]


class EntriesIn(BaseModel):
    entries: list[EntryIn]


# ---- exam types / exams -------------------------------------------------


@router.get("/exam-types")
def types_route(db: Session = Depends(get_db), user: User = Depends(require_permission("exams.read"))) -> list[dict]:
    return svc.list_types(db, user)


@router.post("/exam-types", status_code=201)
def create_type_route(
    body: ExamTypeIn, db: Session = Depends(get_db), user: User = Depends(require_permission("exams.configure"))
) -> dict:
    return svc.create_type(db, user, code=body.code, name=body.name)


@router.post("/exams", status_code=201)
def create_exam_route(
    body: ExamIn, db: Session = Depends(get_db), user: User = Depends(require_permission("exams.write"))
) -> dict:
    return svc.create_exam(
        db, user, name=body.name, exam_type=body.examType, class_name=body.className,
        start_date=body.startDate, end_date=body.endDate,
    )


@router.get("/exams")
def list_exams_route(
    class_name: str | None = Query(default=None, alias="className"),
    status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("exams.read")),
) -> list[dict]:
    return svc.list_exams(db, user, class_name=class_name, status=status)


@router.get("/exams/{exam_id}")
def get_exam_route(
    exam_id: UUID, db: Session = Depends(get_db), user: User = Depends(require_permission("exams.read"))
) -> dict:
    return svc.get_exam(db, user, exam_id)


@router.post("/exams/{exam_id}/submit")
def submit_exam_route(
    exam_id: UUID, db: Session = Depends(get_db), user: User = Depends(require_permission("exams.write"))
) -> dict:
    return svc.submit_exam(db, user, exam_id)


@router.get("/exams/{exam_id}/results")
def exam_results_route(
    exam_id: UUID, db: Session = Depends(get_db), user: User = Depends(require_permission("exams.read"))
) -> dict:
    """Published marks only, with auto ranks and class-high per subject."""
    return svc.exam_results(db, user, exam_id)


# ---- weightage -----------------------------------------------------------


@router.get("/exam-weightage")
def get_weightage_route(
    class_name: str = Query(alias="className"),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("exams.read")),
) -> dict:
    return svc.get_weightage(db, user, class_name)


@router.put("/exam-weightage")
def set_weightage_route(
    body: WeightageIn,
    class_name: str = Query(alias="className"),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("exams.configure")),
) -> dict:
    return svc.set_weightage(db, user, class_name, [w.model_dump() for w in body.weights])


# ---- marks batches ---------------------------------------------------------


@router.post("/marks-batches", status_code=201)
def create_batch_route(
    body: BatchIn, db: Session = Depends(get_db), user: User = Depends(require_permission("marks.write"))
) -> dict:
    return svc.create_batch(
        db, user, exam_id=body.examId, subject=body.subject, section=body.section,
        max_marks=body.maxMarks, entries=[e.model_dump() for e in body.entries],
    )


@router.get("/marks-batches")
def list_batches_route(
    exam_id: UUID | None = Query(default=None, alias="examId"),
    status: str | None = None,
    mine: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("marks.read")),
) -> list[dict]:
    return svc.list_batches(db, user, exam_id=exam_id, status=status, mine=mine)


@router.get("/marks-batches/{batch_id}")
def get_batch_route(
    batch_id: UUID, db: Session = Depends(get_db), user: User = Depends(require_permission("marks.read"))
) -> dict:
    return svc.get_batch(db, user, batch_id)


@router.put("/marks-batches/{batch_id}/entries")
def replace_entries_route(
    batch_id: UUID,
    body: EntriesIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("marks.write")),
) -> dict:
    return svc.replace_entries(db, user, batch_id, [e.model_dump() for e in body.entries])


@router.post("/marks-batches/{batch_id}/submit")
def submit_batch_route(
    batch_id: UUID, db: Session = Depends(get_db), user: User = Depends(require_permission("marks.write"))
) -> dict:
    return svc.submit_batch(db, user, batch_id)


@router.post("/marks-batches/{batch_id}/revise", status_code=201)
def revise_batch_route(
    batch_id: UUID, db: Session = Depends(get_db), user: User = Depends(require_permission("marks.write"))
) -> dict:
    return svc.revise_batch(db, user, batch_id)


# ---- student results (parents via their child) ------------------------------


@router.get("/results/students/{student_id}")
def student_results_route(
    student_id: UUID, db: Session = Depends(get_db), user: User = Depends(require_permission("results.read"))
) -> dict:
    return svc.student_results(db, user, student_id)
