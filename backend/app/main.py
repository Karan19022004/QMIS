from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.endpoints.admissions import router as admissions_router
from app.api.v1.endpoints.admin_users import router as admin_users_router
from app.api.v1.endpoints.audit import router as audit_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.files import router as files_router
from app.api.v1.endpoints.finance import router as finance_router
from app.api.v1.endpoints.hr import router as hr_router
from app.api.v1.endpoints.masters import router as masters_router
from app.api.v1.endpoints.parents import router as parents_router
from app.api.v1.endpoints.students import router as students_router
from app.api.v1.endpoints.attendance import router as attendance_router
from app.api.v1.endpoints.approvals import router as approvals_router
from app.api.v1.endpoints.lesson_plans import router as lesson_plans_router
from app.api.v1.endpoints.exams import router as exams_router
from app.api.v1.endpoints.escalations import router as escalations_router
from app.api.v1.endpoints.leave import router as leave_router
from app.core.config import settings
from app.core.database import SessionLocal, engine
from app.models import Base
from app.services.admissions_migrate import ensure_admissions_schema
from app.services.hr_migrate import ensure_hr_employee_columns
from app.services.masters_migrate import ensure_masters_schema
from app.services.seed import seed_reference_data


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_hr_employee_columns()
    ensure_admissions_schema()
    ensure_masters_schema()
    db = SessionLocal()
    try:
        seed_reference_data(db)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title=settings.app_name, version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(audit_router)
app.include_router(admin_users_router)
app.include_router(masters_router)
app.include_router(admissions_router)
app.include_router(parents_router)
app.include_router(students_router)
app.include_router(attendance_router)
app.include_router(approvals_router)
app.include_router(lesson_plans_router)
app.include_router(exams_router)
app.include_router(leave_router)
app.include_router(escalations_router)
app.include_router(finance_router)
app.include_router(hr_router)
app.include_router(files_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
