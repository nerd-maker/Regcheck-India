import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Any
from app.services.report_service import generate_word_report

router = APIRouter(prefix="/export", tags=["export"])
logger = logging.getLogger(__name__)


class ExportRequest(BaseModel):
    agent_response: dict[str, Any]
    filename: str = "regcheck-report"


@router.post("/word")
async def export_word_report(payload: ExportRequest) -> Response:
    """
    Accept a full AgentResponse dict and return a .docx file as a binary stream.
    The filename in Content-Disposition comes from the payload.filename field.
    """
    try:
        docx_bytes = generate_word_report(payload.agent_response)
    except Exception as e:
        logger.error("word_export_failed", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Report generation failed: {e}")

    safe_filename = payload.filename.replace(" ", "_").replace("/", "-")
    if not safe_filename.endswith(".docx"):
        safe_filename += ".docx"

    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'},
    )
