import re
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import FileAsset, User
from app.services.audit import write_audit
from app.services.errors import fail

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_MAX_BYTES = 10 * 1024 * 1024
_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")

# Identity / school documents: only these extensions, and the file's first bytes must agree with them.
DOCUMENT_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    ".pdf": (b"%PDF-",),
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
}
DOCUMENT_CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}
DOCUMENT_MAX_BYTES = 5 * 1024 * 1024


def _uploads_dir() -> Path:
    configured = Path(settings.upload_dir)
    root = configured if configured.is_absolute() else _BACKEND_ROOT / configured
    root.mkdir(parents=True, exist_ok=True)
    return root


def store_upload(
    db: Session,
    actor: User,
    upload: UploadFile,
    *,
    resource_type: str = "attachment",
    resource_id: str | None = None,
    max_bytes: int = _MAX_BYTES,
    allowed_signatures: dict[str, tuple[bytes, ...]] | None = None,
) -> FileAsset:
    """Write the bytes and add a ``FileAsset`` row WITHOUT committing, so the caller can make the file and
    the record that points at it succeed or fail together. On a later failure call ``discard_stored_bytes``."""
    data = upload.file.read(max_bytes + 1)
    if not data:
        fail(422, "empty_file", "The uploaded file is empty.")
    if len(data) > max_bytes:
        fail(413, "file_too_large", f"Files larger than {max_bytes // (1024 * 1024)} MB are not accepted.")
    original = (upload.filename or "upload.bin").strip() or "upload.bin"
    content_type = upload.content_type or "application/octet-stream"
    if allowed_signatures is not None:
        extension = Path(original).suffix.lower()
        signatures = allowed_signatures.get(extension)
        if not signatures or not data.startswith(signatures):
            fail(415, "unsupported_file_type", "Only PDF, JPG or PNG files are accepted.")
        content_type = DOCUMENT_CONTENT_TYPES.get(extension, content_type)  # never trust the client's header
    safe = _SAFE_NAME.sub("_", original)[:180]
    stored = f"{uuid.uuid4().hex}_{safe}"
    path = _uploads_dir() / stored
    path.write_bytes(data)
    row = FileAsset(
        campus_id=actor.campus_id,
        uploaded_by=actor.id,
        original_name=original,
        stored_name=stored,
        content_type=content_type,
        size_bytes=len(data),
        resource_type=(resource_type or "attachment")[:64],
        resource_id=(resource_id or None),
    )
    db.add(row)
    db.flush()
    write_audit(
        db,
        action="FILE_UPLOADED",
        entity_type="file_asset",
        entity_id=str(row.id),
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=original,
    )
    return row


def discard_stored_bytes(row: FileAsset) -> None:
    """Delete the file's bytes from disk (the database row is the caller's business)."""
    try:
        (_uploads_dir() / row.stored_name).unlink(missing_ok=True)
    except OSError:
        pass


def save_upload(
    db: Session,
    actor: User,
    upload: UploadFile,
    *,
    resource_type: str = "attachment",
    resource_id: str | None = None,
) -> dict:
    row = store_upload(db, actor, upload, resource_type=resource_type, resource_id=resource_id)
    db.commit()
    db.refresh(row)
    return _public(row)


def get_file(db: Session, actor: User, file_id: uuid.UUID) -> tuple[FileAsset, Path]:
    row = db.get(FileAsset, file_id)
    if row is None or row.campus_id != actor.campus_id:
        fail(404, "not_found", "File was not found.")
    # Files that belong to a student/employee document folder follow that folder's permissions.
    from app.services import announcements, documents

    documents.authorize_file_download(db, actor, row)
    # An announcement's attachment is only for the people who can see that announcement.
    announcements.authorize_file_download(db, actor, row)
    path = _uploads_dir() / row.stored_name
    if not path.is_file():
        fail(404, "not_found", "File bytes are missing.")
    return row, path


def _public(row: FileAsset) -> dict:
    return {
        "id": str(row.id),
        "original_name": row.original_name,
        "content_type": row.content_type,
        "size_bytes": row.size_bytes,
        "resource_type": row.resource_type,
        "resource_id": row.resource_id,
        "download_url": f"/api/v1/files/{row.id}/download",
    }
