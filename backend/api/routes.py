from __future__ import annotations

import io
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse

from backend.config import DEFAULT_FILTERS
from backend.models.schemas import (
    DumpUploadResponse,
    KeysUploadResponse,
    PreviewRequest,
    PreviewResponse,
    KeysTextRequest,
)
from backend.services.dump_service import DumpService
from backend.services.keys_service import KeysService
from backend.services.preview_service import PreviewService

router = APIRouter()

dump_service = DumpService()
keys_service = KeysService()
preview_service = PreviewService()


@router.get("/default-filters", response_model=list[str])
def get_default_filters() -> list[str]:
    return DEFAULT_FILTERS


@router.get("/headers", response_model=list[str])
def get_headers() -> list[str]:
    return dump_service.get_headers()


@router.post("/dump", response_model=DumpUploadResponse)
async def upload_dump(file: UploadFile = File(...)) -> DumpUploadResponse:
    try:
        temp_path = _save_upload(file)
        df = dump_service.load_dump(temp_path)
        return DumpUploadResponse(rows=len(df), columns=list(df.columns))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/keys/file", response_model=KeysUploadResponse)
async def upload_keys(file: UploadFile = File(...)) -> KeysUploadResponse:
    try:
        temp_path = _save_upload(file)
        keys = keys_service.load_keys(temp_path)
        return KeysUploadResponse(count=len(keys))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/keys/text", response_model=KeysUploadResponse)
def set_keys_text(payload: KeysTextRequest) -> KeysUploadResponse:
    keys = keys_service.set_keys_from_text(payload.keys)
    return KeysUploadResponse(count=len(keys))


@router.post("/preview", response_model=PreviewResponse)
def preview(payload: PreviewRequest) -> PreviewResponse:
    try:
        df = preview_service.build_preview(payload.filters)
        rows = df.to_dict(orient="records")
        return PreviewResponse(rows=rows)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/export")
def export_csv(payload: PreviewRequest) -> StreamingResponse:
    try:
        df = preview_service.build_preview(payload.filters)
        buffer = io.StringIO()
        df.to_csv(buffer, index=False)
        buffer.seek(0)
        headers = {
            "Content-Disposition": "attachment; filename=review_packets.csv"
        }
        return StreamingResponse(buffer, media_type="text/csv", headers=headers)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


def _save_upload(file: UploadFile) -> Path:
    temp_dir = Path(__file__).resolve().parent.parent / "uploads"
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_path = temp_dir / file.filename
    with temp_path.open("wb") as target:
        target.write(file.file.read())
    return temp_path
