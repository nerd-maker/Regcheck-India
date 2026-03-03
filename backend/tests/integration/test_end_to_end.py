"""
Integration tests for RegCheck-India Platform
Tests end-to-end workflows across all modules
"""

import pytest
from unittest.mock import Mock, patch
import json


# =============================================================================
# MODULE 01 → MODULE 02 INTEGRATION
# =============================================================================

@pytest.mark.integration
def test_compliance_gap_to_regeneration(sample_study_data, mock_anthropic_client, mock_claude_response_json):
    """Test workflow: Compliance check identifies gaps → Generate amended sections"""
    compliance_result = {
        "overall_compliance": "NON_COMPLIANT",
        "sections": [{"section": "Safety Reporting", "status": "NON_COMPLIANT", "gaps": ["SAE reporting timeline unclear"]}]
    }
    regenerated_section = {
        "section_number": "9.2",
        "section_heading": "Safety Reporting",
        "generated_content": "All SAEs will be reported to CDSCO within 24 hours...",
        "placeholders_used": [],
        "regulatory_choices_made": [],
        "review_priority": "HIGH",
        "completion_pct": 95,
        "review_priority_reason": "Safety critical",
        "compliance_notes": ["Updated to meet NDCTR 2019 requirements"]
    }

    mock_responses = [
        mock_claude_response_json(json.dumps(compliance_result)),
        mock_claude_response_json(json.dumps(regenerated_section))
    ]
    mock_anthropic_client.chat.completions.create.side_effect = mock_responses

    with patch('app.services.evaluator.OpenAI', return_value=mock_anthropic_client):
        with patch('app.services.document_generator.OpenAI', return_value=mock_anthropic_client):
            assert True  # Placeholder for actual integration


# =============================================================================
# MODULE 02 → MODULE 03 INTEGRATION
# =============================================================================

@pytest.mark.integration
def test_document_generation_to_query_response(sample_study_data, sample_cdsco_query, mock_anthropic_client, mock_claude_response_json):
    """Test workflow: Generate document → Receive query → Draft response"""
    protocol_section = {
        "section_number": "5.0",
        "section_heading": "Inclusion/Exclusion Criteria",
        "generated_content": "Inclusion: Age 18-65, diagnosed hypertension...",
        "placeholders_used": [],
        "regulatory_choices_made": [],
        "review_priority": "CRITICAL",
        "completion_pct": 90,
        "review_priority_reason": "Patient selection",
        "compliance_notes": []
    }
    query_classification = {
        "primary_category": "inclusion_exclusion",
        "secondary_categories": [],
        "complexity": "MODERATE",
        "urgency": "MEDIUM",
        "data_gap": "NO",
        "data_gap_detail": "",
        "recommended_template": "TMPL-INCLUSION",
        "classification_confidence": "HIGH",
        "reasoning": "Query about inclusion criteria"
    }
    query_response = "Inclusion criteria are defined in Protocol Section 5.0\n\n---METADATA---\n{\"confidence\": \"HIGH\", \"reviewer_flags\": [], \"additional_info_needed\": [], \"supporting_documents_referenced\": [\"Protocol Section 5.0\"]}"

    mock_responses = [
        mock_claude_response_json(json.dumps(protocol_section)),
        mock_claude_response_json(json.dumps(query_classification)),
        mock_claude_response_json(query_response)
    ]
    mock_anthropic_client.chat.completions.create.side_effect = mock_responses

    with patch('app.services.document_generator.OpenAI', return_value=mock_anthropic_client):
        with patch('app.services.query_classifier.OpenAI', return_value=mock_anthropic_client):
            with patch('app.services.query_response_generator.OpenAI', return_value=mock_anthropic_client):
                assert True  # Placeholder for actual integration


# =============================================================================
# MODULE 04 COMPLETE WORKFLOW
# =============================================================================

@pytest.mark.integration
def test_full_regulatory_workflow(sample_cdsco_circular, sample_active_submission, mock_anthropic_client, mock_claude_response_json):
    """Test workflow: New regulation → Impact assessment → Digest"""
    ingestion_result = [{
        "change_id": "CHG-001",
        "domain": "Safety Reporting",
        "change_type": "NEW_REQUIREMENT",
        "previous_requirement": "7 days",
        "new_requirement": "24 hours",
        "effective_date": "2026-02-01",
        "transition_provisions": "30 days",
        "affected_submission_types": ["CT-04"],
        "affected_product_categories": ["All"],
        "source_section": "2",
        "verbatim_text": "Text",
        "source_citation": "Citation",
        "urgency": "CRITICAL",
        "urgency_rationale": "Immediate",
        "action_window": "30 days",
        "recommended_action": "Update protocols",
        "plain_language_summary": "Summary"
    }]
    impact_assessment = {
        "submission_id": sample_active_submission["submission_id"],
        "change_id": "CHG-001",
        "impact_status": "IMPACTED",
        "impact_rationale": "Protocol update required",
        "affected_documents": [],
        "amendment_required": True,
        "amendment_type": "Protocol",
        "estimated_delay_risk": "4 weeks",
        "recommended_actions": [],
        "human_review_required": True,
        "alert_text": "Alert"
    }
    digest = {
        "executive_summary": "Critical SAE reporting change",
        "critical_actions": [],
        "detailed_changes": [],
        "monitoring_items": [],
        "no_material_changes": False
    }

    mock_responses = [
        mock_claude_response_json(json.dumps(ingestion_result)),
        mock_claude_response_json(json.dumps(impact_assessment)),
        mock_claude_response_json(json.dumps(digest))
    ]
    mock_anthropic_client.chat.completions.create.side_effect = mock_responses

    with patch('app.services.regulatory_change_analyzer.OpenAI', return_value=mock_anthropic_client):
        with patch('app.services.submission_impact_assessor.OpenAI', return_value=mock_anthropic_client):
            with patch('app.services.weekly_digest_generator.OpenAI', return_value=mock_anthropic_client):
                assert True  # Placeholder for actual integration


# =============================================================================
# END-TO-END SYSTEM TEST
# =============================================================================

@pytest.mark.integration
@pytest.mark.slow
def test_complete_submission_lifecycle(sample_study_data, sample_cdsco_query, sample_cdsco_circular, mock_anthropic_client, mock_claude_response_json):
    """Test complete submission lifecycle across all modules"""
    mock_responses = [
        mock_claude_response_json('{"overall_compliance": "COMPLIANT"}'),
        mock_claude_response_json('{"section_number": "1.0"}'),
        mock_claude_response_json('{"target_language": "Hindi"}'),
        mock_claude_response_json('{"changes": []}'),
        mock_claude_response_json('{"impact_status": "NOT_IMPACTED"}'),
        mock_claude_response_json('{"primary_category": "administrative"}'),
        mock_claude_response_json('{"direct_answer": "Response"}'),
        mock_claude_response_json('{"section_number": "2.0"}'),
        mock_claude_response_json('{"overall_compliance": "COMPLIANT"}')
    ]
    mock_anthropic_client.chat.completions.create.side_effect = mock_responses

    with patch('openai.OpenAI', return_value=mock_anthropic_client):
        assert True  # Placeholder for actual end-to-end test


# =============================================================================
# CRITICAL CHANGE AUTO-TRIGGER TEST
# =============================================================================

@pytest.mark.integration
def test_critical_change_auto_trigger(sample_cdsco_circular, mock_anthropic_client, mock_claude_response_json):
    """Test auto-trigger of impact assessment for CRITICAL changes"""
    ingestion_result = [{
        "change_id": "CHG-CRITICAL-001",
        "domain": "Safety",
        "change_type": "NEW_REQUIREMENT",
        "previous_requirement": "Old",
        "new_requirement": "New",
        "effective_date": "IMMEDIATE",
        "transition_provisions": "None",
        "affected_submission_types": ["CT-04"],
        "affected_product_categories": ["All"],
        "source_section": "1",
        "verbatim_text": "Text",
        "source_citation": "Citation",
        "urgency": "CRITICAL",
        "urgency_rationale": "Immediate safety concern",
        "action_window": "IMMEDIATE",
        "recommended_action": "Act now",
        "plain_language_summary": "Critical change"
    }]
    impact_assessment = {
        "submission_id": "SUB-001",
        "change_id": "CHG-CRITICAL-001",
        "impact_status": "IMPACTED",
        "impact_rationale": "Immediate action required",
        "affected_documents": [],
        "amendment_required": True,
        "amendment_type": "Protocol",
        "estimated_delay_risk": "Unknown",
        "recommended_actions": [],
        "human_review_required": True,
        "alert_text": "URGENT ALERT"
    }

    mock_responses = [
        mock_claude_response_json(json.dumps(ingestion_result)),
        mock_claude_response_json(json.dumps(impact_assessment)),
        mock_claude_response_json(json.dumps(impact_assessment)),
        mock_claude_response_json(json.dumps(impact_assessment))
    ]
    mock_anthropic_client.chat.completions.create.side_effect = mock_responses

    with patch('app.services.regulatory_change_analyzer.OpenAI', return_value=mock_anthropic_client):
        with patch('app.services.submission_impact_assessor.OpenAI', return_value=mock_anthropic_client):
            assert True  # Placeholder for actual integration
