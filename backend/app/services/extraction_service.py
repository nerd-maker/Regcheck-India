from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pdfplumber
from docx import Document


async def extract_document_text(file_bytes: bytes, filename: str) -> tuple[str, int | None]:
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        return _extract_pdf(file_bytes)
    if suffix == ".docx":
        return _extract_docx(file_bytes)
    return "", None


def _extract_pdf(file_bytes: bytes) -> tuple[str, int]:
    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        pages = []
        for page in pdf.pages:
            pages.append(page.extract_text() or "")
        return "\n\n".join(text for text in pages if text).strip(), len(pdf.pages)


def _extract_docx(file_bytes: bytes) -> tuple[str, int | None]:
    doc = Document(BytesIO(file_bytes))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs).strip(), None
