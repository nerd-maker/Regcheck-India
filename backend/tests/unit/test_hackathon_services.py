"""
Unit tests for Stage-1 hackathon services (PII utilities, M5–M7, M2 inspection schema).
"""
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest

from app.services.document_comparator import DocumentVersionComparator
from app.services.document_summariser import (
    MeetingTranscriptSummariser,
    SAECaseNarrationSummariser,
    SUGAMApplicationSummariser,
)
from app.services.evaluator import SUGAMChecklistEvaluator
from app.services.pii_detector import (
    PIIAuditLogger,
    StructuredDataAnonymiser,
    TwoStepAnonymiser,
)
from app.services.sae_classifier import (
    DuplicateDetectionEngine,
    ReviewerPrioritisationEngine,
    SAESeverityClassifier,
)
from app.services.schema_engine import INSPECTION_REPORT_SCHEMA, InspectionObservationConverter


class TestTwoStepAnonymiser:
    def test_pseudonymise_returns_bracketed_token(self):
        ts = TwoStepAnonymiser()
        token, tid = ts.pseudonymise("secret", "EMAIL")
        assert token == tid
        assert token.startswith("[EMAIL_")
        assert token.endswith("]")

    def test_irreversible_age(self):
        ts = TwoStepAnonymiser()
        assert ts.irreversible_anonymise("45 years", "AGE", "") == "[AGE_40s]"

    def test_irreversible_date_and_location(self):
        ts = TwoStepAnonymiser()
        assert ts.irreversible_anonymise("2020-01-01", "DATE", "") == "[DATE_GENERALISED]"
        assert ts.irreversible_anonymise("Mumbai", "GPE", "") == "[REGION_INDIA]"


class TestStructuredDataAnonymiser:
    def test_auto_detect_pii_columns(self):
        import pandas as pd

        df = pd.DataFrame({"patient_name": ["A"], "value": [1]})
        sa = StructuredDataAnonymiser()
        cols = sa.auto_detect_pii_columns(df)
        assert "patient_name" in cols

    def test_anonymise_dataframe_mutates_pii_columns(self):
        import pandas as pd

        df = pd.DataFrame({"patient_name": ["Alice"]})
        sa = StructuredDataAnonymiser()
        out = sa.anonymise_dataframe(df, ["patient_name"])
        val = out["patient_name"].iloc[0]
        assert "[PATIENT_NAME_" in val or "ANONYMISED" in val


class TestPIIAuditLogger:
    def test_log_and_filter_by_session(self):
        from app.services.runtime_state_store import runtime_state_store

        runtime_state_store.delete("anonymisation", "s1", "audit_log")
        runtime_state_store.delete("anonymisation", "s2", "audit_log")
        log = PIIAuditLogger()
        log.log_anonymisation("s1", "PHONE", "pseudonymise", "DPDP_Act_2023")
        log.log_anonymisation("s2", "EMAIL", "anonymise", "DPDP_Act_2023")
        assert len(log.get_session_entries("s1")) == 1
        assert log.get_session_entries("s1")[0]["entity_type"] == "PHONE"

    def test_expired_entries_are_trimmed(self):
        from app.services.runtime_state_store import runtime_state_store

        log = PIIAuditLogger()
        runtime_state_store.put(
            "anonymisation",
            "old-session",
            "audit_log",
            [
                {
                    "timestamp": "2000-01-01T00:00:00+00:00",
                    "session_id": "old-session",
                    "entity_type": "PHONE",
                    "action": "anonymise",
                    "legal_basis": "DPDP_Act_2023",
                    "retention_policy": "30_days",
                }
            ],
            encrypt=True,
        )
        assert log.get_session_entries("old-session") == []


class TestSUGAMChecklistEvaluator:
    def test_ct04_completeness_all_present(self):
        ev = SUGAMChecklistEvaluator()
        payload = {f: f"val-{f}" for sec in ev.FORM_CT04_CHECKLIST.values() for f in sec["mandatory_fields"]}
        r = ev.evaluate_ct04_completeness(payload)
        assert r["completeness_score"] == 1.0
        assert not r["missing_fields"]

    def test_ct04_completeness_missing(self):
        ev = SUGAMChecklistEvaluator()
        r = ev.evaluate_ct04_completeness({})
        assert r["completeness_score"] == 0.0
        assert r["missing_fields"]

    def test_sae_completeness(self):
        ev = SUGAMChecklistEvaluator()
        mandatory = ev.SAE_REPORT_CHECKLIST["mandatory_fields"]
        full = {k: "x" for k in mandatory}
        assert ev.evaluate_sae_completeness(full)["status"] == "COMPLETE"
        assert ev.evaluate_sae_completeness({})["status"] == "INCOMPLETE"


class TestReviewerPrioritisationEngine:
    def test_priority_death_and_deadline(self):
        eng = ReviewerPrioritisationEngine()
        s = eng.calculate_priority_score(
            {"severity": "DEATH", "days_to_deadline": 1, "completeness_score": 1.0}
        )
        # 40 (DEATH) + 30 (deadline <= 2 days)
        assert s == 70

    def test_duplicate_penalty(self):
        eng = ReviewerPrioritisationEngine()
        base = eng.calculate_priority_score(
            {"severity": "OTHER", "days_to_deadline": 30, "completeness_score": 1.0, "is_potential_duplicate": False}
        )
        dup = eng.calculate_priority_score(
            {"severity": "OTHER", "days_to_deadline": 30, "completeness_score": 1.0, "is_potential_duplicate": True}
        )
        assert dup < base


class TestSAESeverityClassifier:
    def test_rule_based_keywords(self):
        clf = SAESeverityClassifier()
        triggered = clf._rule_based_check("patient was hospitalised after fatal event")
        assert "HOSPITALISATION" in triggered
        assert "DEATH" in triggered

    @pytest.mark.asyncio
    async def test_classify_merges_llm_and_rules(self):
        clf = SAESeverityClassifier()
        with patch.object(clf, "_call_llm", new_callable=AsyncMock, return_value={"primary_category": "OTHER"}):
            out = await clf.classify("fatal outcome reported")
        assert "primary_category" in out
        assert "DEATH" in out["seriousness_criteria"]


class TestDuplicateDetectionEngine:
    def test_create_fingerprint(self):
        mock_client = MagicMock()
        eng = DuplicateDetectionEngine(mock_client)
        fp = eng._create_case_fingerprint({"product_name": "X", "event_description": "rash"})
        assert "Product:" in fp and "X" in fp

    @pytest.mark.asyncio
    async def test_check_duplicate_proceed_when_empty_query(self):
        mock_client = MagicMock()
        collection = MagicMock()
        collection.query.return_value = {"documents": [[]], "distances": [[]], "metadatas": [[]]}
        mock_client.get_or_create_collection.return_value = collection
        eng = DuplicateDetectionEngine(mock_client)
        result = await eng.check_duplicate({"case_id": "c1", "event_description": "headache"})
        assert result["recommendation"] == "PROCEED"
        assert result["duplicate_count"] == 0
        collection.add.assert_called_once()


class TestDocumentVersionComparator:
    def test_generate_html_diff_non_empty(self):
        comp = DocumentVersionComparator()
        html = comp._generate_html_diff("line1\n", "line2\n")
        assert "<html" in html.lower() or "table" in html.lower()

    @pytest.mark.asyncio
    async def test_compare_versions_structure(self):
        comp = DocumentVersionComparator()
        with patch.object(comp, "_detect_substantive_changes", new_callable=AsyncMock, return_value=[]):
            out = await comp.compare_versions("1. Section A\nbody", "1. Section B\nbody", "protocol")
        assert "summary" in out
        assert "diff_html" in out
        assert "structural_changes" in out


class TestSummarisers:
    @pytest.mark.asyncio
    async def test_sugam_summarise_parses_json(self):
        summariser = SUGAMApplicationSummariser()
        with patch("app.services.document_summariser.call_claude") as m_call:
            m_call.return_value = {"content": '{"sponsor_details": {}}', "model": "claude-haiku-4-20250414", "usage": {"input_tokens": 10, "output_tokens": 20}}
            out = await summariser.summarise("doc text", "ct04")
        assert "sponsor_details" in out or "raw" in out

    @pytest.mark.asyncio
    async def test_sae_summariser(self):
        summariser = SAECaseNarrationSummariser()
        with patch("app.services.document_summariser.call_claude") as m_call:
            m_call.return_value = {"content": '{"case_id": "C1"}', "model": "claude-haiku-4-20250414", "usage": {"input_tokens": 10, "output_tokens": 20}}
            out = await summariser.summarise("SAE narrative")
        assert out.get("case_id") == "C1" or "raw" in out

    @pytest.mark.asyncio
    async def test_meeting_transcript(self):
        summariser = MeetingTranscriptSummariser()
        with patch("app.services.document_summariser.call_claude") as m_call:
            m_call.return_value = {"content": '{"meeting_overview": "x"}', "model": "claude-haiku-4-20250414", "usage": {"input_tokens": 10, "output_tokens": 20}}
            out = await summariser.summarise_transcript("transcript")
        assert "meeting_overview" in out or "raw" in out


class TestInspectionSchema:
    def test_inspection_report_schema_shape(self):
        assert INSPECTION_REPORT_SCHEMA["type"] == "inspection_report"
        assert len(INSPECTION_REPORT_SCHEMA["sections"]) >= 7
        ids = [s["id"] for s in INSPECTION_REPORT_SCHEMA["sections"]]
        assert "observations" in ids

    @pytest.mark.asyncio
    async def test_inspection_converter_parses_json(self):
        conv = InspectionObservationConverter()
        with patch("app.services.claude_client.call_claude") as m_call:
            m_call.return_value = {"content": '{"observations": []}', "model": "claude-sonnet-4-20250514", "usage": {"input_tokens": 10, "output_tokens": 20}}
            out = await conv.convert("raw note", {"site": "S1"})
        assert "observations" in out or "raw" in out
