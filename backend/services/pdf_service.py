from __future__ import annotations

from datetime import datetime
from pathlib import Path

from backend.config import DEFAULT_DOWNLOADS_DIR


class PDFService:
    def build_download_folder(self) -> Path:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        target = DEFAULT_DOWNLOADS_DIR / timestamp
        target.mkdir(parents=True, exist_ok=True)
        return target

    def build_pdf_filename(self, review_id: str) -> str:
        safe = "".join(ch for ch in review_id if ch.isalnum() or ch in {"-", "_"})
        safe = safe or "review"
        return f"{safe}.pdf"
