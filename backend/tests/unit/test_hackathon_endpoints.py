"""
HTTP-level unit tests for Stage-1 hackathon API routers (mounted without full app).
"""
import io
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


def _anon_app():
    from app.api import anonymisation_endpoints

    app = FastAPI()
    app.include_router(anonymisation_endpoints.router, prefix="/api/anonymise")
    return app


def _summarise_app():
    from app.api import summarisation_endpoints

    app = FastAPI()
    app.include_router(summarisation_endpoints.router, prefix="/api/summarise")
    return app


def _compare_app():
    from app.api import comparison_endpoints

    app = FastAPI()
    app.include_router(comparison_endpoints.router, prefix="/api/compare")
    return app


def _classify_app():
    from app.api import classification_endpoints

    app = FastAPI()
    app.include_router(classification_endpoints.router, prefix="/api/classify")
    return app


class TestAnonymisationEndpoints:
    def test_post_text_returns_envelope(self):
        mock_pii = MagicMock()
        mock_pii.detect_and_redact.return_value = (
            "redacted",
            {
                "total_redactions": 2,
                "soft_pii_count": 1,
                "redactions_by_type": {"phone": 1},
            },
        )
        mock_pii.audit_logger.get_session_entries.return_value = []
        with patch("app.api.anonymisation_endpoints.pii_detector", mock_pii):
            client = TestClient(_anon_app())
            r = client.post(
                "/api/anonymise/text",
                json={"text": "sample"},
                headers={"X-Session-ID": "sess-1"},
            )
        assert r.status_code == 200
        body = r.json()
        assert body["anonymised_content"] == "redacted"
        assert body["entities_detected"] == 2
        assert "anonymisation_report" in body

    def test_post_document_rejects_unsupported_type(self):
        client = TestClient(_anon_app())
        files = {"file": ("bad.exe", b"x", "application/octet-stream")}
        r = client.post("/api/anonymise/document", files=files)
        assert r.status_code == 400

    def test_post_document_txt(self):
        mock_pii = MagicMock()
        mock_pii.detect_and_redact.return_value = ("ok", {"total_redactions": 0, "soft_pii_count": 0, "redactions_by_type": {}})
        mock_pii.audit_logger.get_session_entries.return_value = []
        with patch("app.api.anonymisation_endpoints.pii_detector", mock_pii):
            client = TestClient(_anon_app())
            files = {"file": ("note.txt", b"hello", "text/plain")}
            r = client.post("/api/anonymise/document", files=files)
        assert r.status_code == 200
        mock_pii.detect_and_redact.assert_called_once()

    def test_post_structured_csv(self):
        """Real CSV path: pandas + structured anonymiser."""
        csv_content = b"patient_name,other\nAlice,1\n"
        files = {"file": ("t.csv", io.BytesIO(csv_content), "text/csv")}
        client = TestClient(_anon_app())
        r = client.post("/api/anonymise/structured", files=files)
        assert r.status_code == 200
        body = r.json()
        assert "anonymised_content" in body
        assert "anonymisation_report" in body

    def test_get_audit(self):
        mock_pii = MagicMock()
        mock_pii.audit_logger.get_session_entries.return_value = [{"entity_type": "X"}]
        with patch("app.api.anonymisation_endpoints.pii_detector", mock_pii):
            client = TestClient(_anon_app())
            r = client.get("/api/anonymise/audit/sess-a", headers={"X-Session-ID": "sess-a"})
        assert r.status_code == 200
        assert r.json()["session_id"] == "sess-a"

    def test_get_audit_rejects_cross_session_access(self):
        client = TestClient(_anon_app())
        r = client.get("/api/anonymise/audit/sess-a", headers={"X-Session-ID": "sess-b"})
        assert r.status_code == 403

    def test_get_report_missing(self):
        from app.api import anonymisation_endpoints
        from app.services.runtime_state_store import runtime_state_store

        anonymisation_endpoints._SESSION_REPORTS.clear()
        runtime_state_store.delete("anonymisation", "unknown", "report")
        client = TestClient(_anon_app())
        r = client.get("/api/anonymise/report/unknown", headers={"X-Session-ID": "unknown"})
        assert r.status_code == 200
        assert "detail" in r.json()

    def test_get_report_rejects_cross_session_access(self):
        client = TestClient(_anon_app())
        r = client.get("/api/anonymise/report/sess-a", headers={"X-Session-ID": "sess-b"})
        assert r.status_code == 403


class TestSummarisationEndpoints:
    def test_sugam_application(self):
        from app.api import summarisation_endpoints

        with patch.object(
            summarisation_endpoints.sugam_summariser,
            "summarise",
            new_callable=AsyncMock,
            return_value={"sections": {}},
        ):
            client = TestClient(_summarise_app())
            r = client.post(
                "/api/summarise/sugam-application",
                json={"document_text": "doc", "checklist_type": "ct04"},
            )
        assert r.status_code == 200
        assert r.json()["sections"] == {}

    def test_sae_case(self):
        from app.api import summarisation_endpoints

        with patch.object(
            summarisation_endpoints.sae_summariser,
            "summarise",
            new_callable=AsyncMock,
            return_value={"case_id": "C1"},
        ):
            client = TestClient(_summarise_app())
            r = client.post("/api/summarise/sae-case", json={"sae_text": "text"})
        assert r.json()["case_id"] == "C1"

    def test_meeting(self):
        from app.api import summarisation_endpoints

        with patch.object(
            summarisation_endpoints.meeting_summariser,
            "summarise_transcript",
            new_callable=AsyncMock,
            return_value={"meeting_overview": "x"},
        ):
            client = TestClient(_summarise_app())
            r = client.post("/api/summarise/meeting", json={"transcript_text": "t"})
        assert r.json()["meeting_overview"] == "x"

    def test_meeting_audio_bad_extension(self):
        client = TestClient(_summarise_app())
        files = {"file": ("a.txt", b"x", "text/plain")}
        r = client.post("/api/summarise/meeting-audio", files=files)
        assert r.status_code == 400

    def test_meeting_audio_bad_signature(self):
        client = TestClient(_summarise_app())
        files = {"file": ("a.wav", b"not-a-wave", "audio/wav")}
        r = client.post("/api/summarise/meeting-audio", files=files)
        assert r.status_code == 400

    def test_schema_routes(self):
        client = TestClient(_summarise_app())
        r = client.get("/api/summarise/schema/sugam-application")
        assert r.status_code == 200
        assert "sections" in r.json()
        r404 = client.get("/api/summarise/schema/unknown")
        assert r404.status_code == 404


class TestComparisonEndpoints:
    def test_versions(self):
        from app.api import comparison_endpoints

        fake = {
            "summary": {"total_changes": 0, "substantive_changes": 0, "formatting_only_changes": 0, "table_changes": 0, "risk_level": "LOW"},
            "structural_changes": [],
            "substantive_changes": [],
            "table_changes": [],
            "regulatory_impact": {},
            "diff_html": "<html/>",
        }
        with patch.object(
            comparison_endpoints.comparator,
            "compare_versions",
            new_callable=AsyncMock,
            return_value=fake,
        ):
            client = TestClient(_compare_app())
            r = client.post(
                "/api/compare/versions",
                json={"doc_v1_text": "a", "doc_v2_text": "b", "doc_type": "protocol"},
                headers={"X-Session-ID": "cmp-1"},
            )
        assert r.status_code == 200
        assert r.json()["diff_html"] == "<html/>"

    def test_completeness_ct04(self):
        client = TestClient(_compare_app())
        r = client.post("/api/compare/completeness", json={"data": {}, "form_type": "CT04"})
        assert r.status_code == 200
        assert "completeness_score" in r.json()

    def test_sae_completeness(self):
        client = TestClient(_compare_app())
        r = client.post("/api/compare/sae-completeness", json={"data": {}, "form_type": "SAE"})
        assert r.status_code == 200
        assert "missing_fields" in r.json()

    def test_diff_and_report_get(self):
        from app.api import comparison_endpoints
        from app.services.runtime_state_store import runtime_state_store

        comparison_endpoints._DIFF_STORE.clear()
        comparison_endpoints._REPORT_STORE.clear()
        runtime_state_store.delete("comparison", "none", "diff_html")
        runtime_state_store.delete("comparison", "none", "report")
        client = TestClient(_compare_app())
        assert client.get("/api/compare/diff/none", headers={"X-Session-ID": "none"}).json()["diff_html"] == ""
        assert "detail" in client.get("/api/compare/report/none", headers={"X-Session-ID": "none"}).json()

    def test_diff_rejects_cross_session_access(self):
        client = TestClient(_compare_app())
        r = client.get("/api/compare/diff/sess-a", headers={"X-Session-ID": "sess-b"})
        assert r.status_code == 403

    def test_report_rejects_cross_session_access(self):
        client = TestClient(_compare_app())
        r = client.get("/api/compare/report/sess-a", headers={"X-Session-ID": "sess-b"})
        assert r.status_code == 403


class TestClassificationEndpoints:
    def test_classify_sae(self):
        from app.api import classification_endpoints

        with patch.object(
            classification_endpoints.sae_classifier,
            "classify",
            new_callable=AsyncMock,
            return_value={"primary_category": "OTHER"},
        ):
            client = TestClient(_classify_app())
            r = client.post("/api/classify/sae", json={"sae_text": "report"})
        assert r.json()["primary_category"] == "OTHER"

    def test_sae_batch(self):
        from app.api import classification_endpoints

        with patch.object(
            classification_endpoints.sae_classifier,
            "classify",
            new_callable=AsyncMock,
            return_value={"ok": True},
        ):
            client = TestClient(_classify_app())
            r = client.post("/api/classify/sae-batch", json={"sae_texts": ["a", "b"]})
        assert len(r.json()["results"]) == 2

    def test_duplicate_check(self):
        from app.api import classification_endpoints

        with patch.object(
            classification_endpoints.duplicate_engine,
            "check_duplicate",
            new_callable=AsyncMock,
            return_value={"recommendation": "PROCEED"},
        ):
            client = TestClient(_classify_app())
            r = client.post(
                "/api/classify/duplicate-check",
                json={"sae_case": {"case_id": "c1"}},
            )
        assert r.json()["recommendation"] == "PROCEED"

    def test_prioritise_queue_stats(self):
        from app.api import classification_endpoints
        from app.services.runtime_state_store import runtime_state_store

        classification_endpoints._QUEUE.clear()
        runtime_state_store.delete("classification", "default_session", "queue")
        client = TestClient(_classify_app())
        pr = client.post(
            "/api/classify/prioritise",
            json={"cases": [{"severity": "DEATH", "days_to_deadline": 5}]},
        )
        assert pr.status_code == 200
        assert len(pr.json()["queue"]) == 1
        q = client.get("/api/classify/queue")
        assert len(q.json()["queue"]) == 1
        st = client.get("/api/classify/stats")
        assert st.json()["total_cases"] == 1

    def test_queue_is_session_scoped(self):
        from app.api import classification_endpoints
        from app.services.runtime_state_store import runtime_state_store

        classification_endpoints._QUEUE.clear()
        runtime_state_store.delete("classification", "queue-a", "queue")
        runtime_state_store.delete("classification", "queue-b", "queue")
        client = TestClient(_classify_app())
        first = client.post(
            "/api/classify/prioritise",
            json={"cases": [{"severity": "DEATH", "days_to_deadline": 2}]},
            headers={"X-Session-ID": "queue-a"},
        )
        assert first.status_code == 200
        second = client.get("/api/classify/queue", headers={"X-Session-ID": "queue-b"})
        assert second.status_code == 200
        assert second.json()["queue"] == []
