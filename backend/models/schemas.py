from __future__ import annotations

from pydantic import BaseModel


class DumpUploadResponse(BaseModel):
    rows: int
    columns: list[str]


class KeysUploadResponse(BaseModel):
    count: int


class PreviewRequest(BaseModel):
    filters: list[str]


class PreviewResponse(BaseModel):
    rows: list[dict]


class KeysTextRequest(BaseModel):
    keys: str


class ErrorResponse(BaseModel):
    detail: str
