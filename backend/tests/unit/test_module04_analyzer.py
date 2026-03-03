"""
Unit tests for Module 04 - Regulatory Change Analyzer
Tests document ingestion and change extraction
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import json
from app.services.regulatory_change_analyzer import RegulatoryChangeAnalyzer
from app.models.regulatory_change_schemas import (
    RegulatoryChange, ChangeClassification, NewDocumentRequest
)


# =============================================================================
# HELPERS
# =============================================================================

def _make_doc_request(sample_cdsco_circular):
    """Create NewDocumentRequest from fixture dict"""
    return NewDocumentRequest(
        source_url=sample_cdsco_circular["source_url"],
        document_title=sample_cdsco_circular["document_title"],
        publication_date=sample_cdsco_circular["publication_date"],
        document_type=sample_cdsco_circular["document_type"],
        full_text=sample_cdsco_circular["full_text"]
    )


def _change_json(change_id="CHG-20260201-001", domain="Safety Reporting",
                  change_type="NEW_REQUIREMENT", urgency="CRITICAL",
                  effective_date="2026-02-01", summary="New SAE reporting requirement"):
    """Build a valid RegulatoryChange JSON"""
    return {
        "change_id": change_id,
        "domain": domain,
        "change_type": change_type,
        "previous_requirement": "Old requirement",
        "new_requirement": "New requirement",
        "effective_date": effective_date,
        "transition_provisions": "30 days",
        "affected_submission_types": ["CT-04"],
        "affected_product_categories": ["New Drugs"],
        "source_section": "Section 1",
        "verbatim_text": "Sample verbatim text",
        "source_citation": "CDSCO Circular No. 001/2026",
        "urgency": urgency,
        "urgency_rationale": "Compliance required",
        "action_window": "30 days",
        "recommended_action": "Update protocols",
        "plain_language_summary": summary
    }


# =============================================================================
# CHANGE ANALYZER TESTS
# =============================================================================

@pytest.mark.unit
@patch('app.services.regulatory_change_analyzer.OpenAI')
def test_ingest_cdsco_circular(mock_openai_cls, sample_cdsco_circular,
                                mock_anthropic_client, mock_claude_response_json):
    """Test CDSCO circular ingestion"""
    mock_openai_cls.return_value = mock_anthropic_client

    # Service expects a JSON array or single change object
    change_data = [_change_json()]
    mock_anthropic_client.chat.completions.create.return_value = \
        mock_claude_response_json(json.dumps(change_data))

    analyzer = RegulatoryChangeAnalyzer()
    doc_request = _make_doc_request(sample_cdsco_circular)
    classification, changes = analyzer.ingest_new_document(doc_request)

    assert len(changes) == 1
    assert changes[0].urgency == "CRITICAL"


@pytest.mark.unit
@patch('app.services.regulatory_change_analyzer.OpenAI')
def test_domain_classification(mock_openai_cls, sample_cdsco_circular,
                                mock_anthropic_client, mock_claude_response_json):
    """Test regulatory domain classification"""
    mock_openai_cls.return_value = mock_anthropic_client

    # Return a classification-style JSON
    classification_data = {
        "primary_domain": "Clinical Trial Conduct",
        "secondary_domains": ["Safety Reporting", "Ethics Committee"],
        "clinical_trial_conduct": True,
        "patient_safety_reporting": True,
        "ethics_committee_process": True,
        "classification_confidence": "HIGH",
        "classification_rationale": "Affects CT conduct and safety reporting"
    }
    mock_anthropic_client.chat.completions.create.return_value = \
        mock_claude_response_json(json.dumps(classification_data))

    analyzer = RegulatoryChangeAnalyzer()
    doc_request = _make_doc_request(sample_cdsco_circular)
    classification, changes = analyzer.ingest_new_document(doc_request)

    assert classification.primary_domain == "Clinical Trial Conduct"
    assert len(classification.secondary_domains) >= 2


@pytest.mark.unit
@patch('app.services.regulatory_change_analyzer.OpenAI')
def test_urgency_assessment_critical(mock_openai_cls, sample_cdsco_circular,
                                      mock_anthropic_client, mock_claude_response_json):
    """Test CRITICAL urgency assessment"""
    mock_openai_cls.return_value = mock_anthropic_client

    change = _change_json(urgency="CRITICAL", effective_date="IMMEDIATE",
                           summary="Immediate safety concern")
    mock_anthropic_client.chat.completions.create.return_value = \
        mock_claude_response_json(json.dumps([change]))

    analyzer = RegulatoryChangeAnalyzer()
    doc_request = _make_doc_request(sample_cdsco_circular)
    classification, changes = analyzer.ingest_new_document(doc_request)

    assert changes[0].urgency == "CRITICAL"
    assert changes[0].effective_date == "IMMEDIATE"


@pytest.mark.unit
@patch('app.services.regulatory_change_analyzer.OpenAI')
def test_plain_language_summary(mock_openai_cls, sample_cdsco_circular,
                                 mock_anthropic_client, mock_claude_response_json):
    """Test plain language summary generation"""
    mock_openai_cls.return_value = mock_anthropic_client

    long_summary = (
        "CDSCO has updated SAE reporting requirements. All trials must now report "
        "SAEs within 24 hours instead of 7 days. This change is effective immediately "
        "and requires protocol amendments within 30 days."
    )
    change = _change_json(change_type="AMENDMENT", urgency="HIGH", summary=long_summary)
    mock_anthropic_client.chat.completions.create.return_value = \
        mock_claude_response_json(json.dumps([change]))

    analyzer = RegulatoryChangeAnalyzer()
    doc_request = _make_doc_request(sample_cdsco_circular)
    classification, changes = analyzer.ingest_new_document(doc_request)

    summary = changes[0].plain_language_summary
    assert len(summary) > 50
    assert "SAE" in summary or "reporting" in summary


# =============================================================================
# EDGE CASES
# =============================================================================

@pytest.mark.unit
@patch('app.services.regulatory_change_analyzer.OpenAI')
def test_ingest_document_no_changes(mock_openai_cls, sample_cdsco_circular,
                                     mock_anthropic_client, mock_claude_response_json):
    """Test ingestion of document with no material changes"""
    mock_openai_cls.return_value = mock_anthropic_client

    # Return empty array
    mock_anthropic_client.chat.completions.create.return_value = \
        mock_claude_response_json(json.dumps([]))

    analyzer = RegulatoryChangeAnalyzer()
    doc_request = NewDocumentRequest(
        source_url="https://cdsco.gov.in/test",
        document_title="CDSCO Notice - No Changes",
        publication_date="2026-02-01",
        document_type="Notification",
        full_text="This is an informational notice with no regulatory changes."
    )
    classification, changes = analyzer.ingest_new_document(doc_request)

    assert len(changes) == 0
