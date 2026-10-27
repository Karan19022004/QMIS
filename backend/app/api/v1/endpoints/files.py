from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import bearer, get_current_user, require_any, require_permission
from app.models import User
from app.services.files import delete_library_file, get_file, list_files, save_upload, upload_library_file

router = APIRouter(prefix="/api/v1/files", tags=["files"])

# File Management screen: Administrator / Super Admin / MD (the roles holding users.write).


@router.get("")
def list_files_route(
    search: str = Query(""),
    kind: str = Query("", description="'' all, 'library' File Management uploads, 'module' other modules"),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("users.write")),
) -> list[dict]:
    return list_files(db, user, search=search, kind=kind)


@router.post("/library", status_code=201)
async def upload_library_route(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("users.write")),
) -> dict:
    return upload_library_file(db, user, file)


@router.delete("/{file_id}")
def delete_file_route(
    file_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("users.write")),
) -> dict:
    return delete_library_file(db, user, file_id)


@router.post("", status_code=201)
async def upload_file_route(
    file: UploadFile = File(...),
    resource_type: str = Form("attachment"),
    resource_id: str | None = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("hr.write", "hr.employees.write", "admissions.write")),
) -> dict:
    return save_upload(db, user, file, resource_type=resource_type, resource_id=resource_id)


@router.get("/{file_id}/download")
def download_file_route(
    file_id: UUID,
    request: Request,
    token: str | None = Query(None),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
):
    auth = credentials
    if auth is None and token:
        auth = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    user = get_current_user(request, auth, db)
    row, path = get_file(db, user, file_id)
    return FileResponse(path, media_type=row.content_type, filename=row.original_name)
