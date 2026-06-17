"""
HTTP-level unit tests for export API router.
"""
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.routers.export_router import router as export_router

def _export_app():
    app = FastAPI()
    app.include_router(export_router, prefix="/api/v1")
    return app

def test_export_word_endpoint():
    client = TestClient(_export_app())
    payload = {
        "agent_response": {
            "agent": "Document_Summarisation",
            "model": "claude-sonnet-4-6",
            "result": {
                "summary": "This is a summary.",
                "risk_level": "LOW",
                "key_sections": ["Section 1"],
                "compliance_gaps": ["None"],
                "recommendations": ["Do this"],
                "regulatory_references": ["Ref 1"],
                "word_count_original": 100
            },
            "timestamp": "2026-06-13T14:38:07Z",
            "token_usage": {"input_tokens": 10, "output_tokens": 20}
        },
        "filename": "test-summary-report.docx"
    }
    response = client.post("/api/v1/export/word", json=payload)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    assert "attachment; filename=\"test-summary-report.docx\"" in response.headers["content-disposition"]
    # Check that it returned non-empty binary docx content
    assert len(response.content) > 0
