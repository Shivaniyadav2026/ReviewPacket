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
    CollaboratorConfigResponse,
    ReviewIdsResponse,
    ParseValidateRequest,
    ParseValidateResponse,
    ValidationResultItem,
    ExportValidationCsvRequest,
    PdfPlanRequest,
    PdfPlanResponse,
    PdfPlanItem,
)
from backend.services.dump_service import DumpService
from backend.services.keys_service import KeysService
from backend.services.preview_service import PreviewService
from backend.services.collaborator_service import CollaboratorService
from backend.services.parser_service import ParserService
from backend.services.validation_service import ValidationService
from backend.services.pdf_service import PDFService
from backend.services.config_service import ConfigService

router = APIRouter()

dump_service = DumpService()
keys_service = KeysService()
preview_service = PreviewService()
collaborator_service = CollaboratorService()
parser_service = ParserService()
validation_service = ValidationService()
pdf_service = PDFService()
config_service = ConfigService()


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


@router.get("/collaborator/config", response_model=CollaboratorConfigResponse)
def get_collaborator_config() -> CollaboratorConfigResponse:
    config = config_service.get_collaborator_config()
    return CollaboratorConfigResponse(
        base_url=config.base_url,
        review_path_template=config.review_path_template,
        request_timeout_seconds=config.request_timeout_seconds,
        max_retries=config.max_retries,
        batch_size=config.batch_size,
    )


@router.get("/collaborator/review-ids", response_model=ReviewIdsResponse)
def get_collaborator_review_ids() -> ReviewIdsResponse:
    try:
        review_ids = collaborator_service.extract_review_ids()
        return ReviewIdsResponse(review_ids=review_ids)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/collaborator/parse-validate", response_model=ParseValidateResponse)
def parse_and_validate_reviews(payload: ParseValidateRequest) -> ParseValidateResponse:
    if not payload.selected_fields:
        raise HTTPException(status_code=400, detail="At least one field must be selected.")

    results: list[ValidationResultItem] = []
    available_fields_set: set[str] = set()

    for review in payload.reviews:
        parsed_fields = parser_service.parse_review_html(review.html)
        available_fields_set.update(parsed_fields.keys())
        validation_row = validation_service.validate(
            review_id=review.review_id,
            selected_fields=payload.selected_fields,
            parsed_fields=parsed_fields,
        )
        results.append(
            ValidationResultItem(
                review_id=validation_row.review_id,
                field_values=validation_row.field_values,
                missing_fields=validation_row.missing_fields,
                comment=validation_row.comment,
                status=validation_row.status,
            )
        )

    return ParseValidateResponse(
        available_fields=sorted(available_fields_set),
        results=results,
    )


@router.post("/collaborator/export-csv")
def export_collaborator_csv(payload: ExportValidationCsvRequest) -> StreamingResponse:
    buffer = io.StringIO()
    headers = ["Review ID", *payload.selected_fields, "Missing Fields", "Comment", "Status"]
    buffer.write(",".join(_csv_escape(header) for header in headers) + "\n")

    for row in payload.results:
        values = [row.review_id]
        values.extend(row.field_values.get(field, "") for field in payload.selected_fields)
        values.append(", ".join(row.missing_fields))
        values.append(row.comment)
        values.append(row.status)
        buffer.write(",".join(_csv_escape(value) for value in values) + "\n")

    buffer.seek(0)
    response_headers = {
        "Content-Disposition": "attachment; filename=collaborator_validation.csv"
    }
    return StreamingResponse(buffer, media_type="text/csv", headers=response_headers)


@router.post("/collaborator/pdf-plan", response_model=PdfPlanResponse)
def get_pdf_plan(payload: PdfPlanRequest) -> PdfPlanResponse:
    output_dir = pdf_service.build_download_folder()
    review_urls = collaborator_service.build_review_urls(payload.eligible_review_ids)

    jobs = [
        PdfPlanItem(
            review_id=review_id,
            url=url,
            output_file=str(output_dir / pdf_service.build_pdf_filename(review_id)),
        )
        for review_id, url in review_urls.items()
    ]

    return PdfPlanResponse(output_dir=str(output_dir), jobs=jobs)


def _save_upload(file: UploadFile) -> Path:
    temp_dir = Path(__file__).resolve().parent.parent / "uploads"
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_path = temp_dir / file.filename
    with temp_path.open("wb") as target:
        target.write(file.file.read())
    return temp_path


def _csv_escape(value: str) -> str:
    text = str(value).replace('"', '""')
    return f'"{text}"'
