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


class CollaboratorConfigResponse(BaseModel):
    base_url: str
    review_path_template: str
    request_timeout_seconds: int
    max_retries: int
    batch_size: int


class ReviewIdsResponse(BaseModel):
    review_ids: list[str]


class ReviewHtmlItem(BaseModel):
    review_id: str
    html: str


class ParseValidateRequest(BaseModel):
    selected_fields: list[str]
    reviews: list[ReviewHtmlItem]


class ValidationResultItem(BaseModel):
    review_id: str
    field_values: dict[str, str]
    missing_fields: list[str]
    comment: str
    status: str


class ParseValidateResponse(BaseModel):
    available_fields: list[str]
    results: list[ValidationResultItem]


class ExportValidationCsvRequest(BaseModel):
    selected_fields: list[str]
    results: list[ValidationResultItem]


class PdfPlanItem(BaseModel):
    review_id: str
    url: str
    output_file: str


class PdfPlanRequest(BaseModel):
    eligible_review_ids: list[str]


class PdfPlanResponse(BaseModel):
    output_dir: str
    jobs: list[PdfPlanItem]
