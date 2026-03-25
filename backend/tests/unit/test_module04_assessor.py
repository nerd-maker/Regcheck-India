"""
Unit tests for Module 04 - Submission Impact Assessor
Tests impact assessment and action item generation
"""

import pytest
from unittest.mock import Mock, patch
import json
from app.services.submission_impact_assessor import SubmissionImpactAssessor
from app.models.regulatory_change_schemas import SubmissionImpactAssessment


# =============================================================================
# HELPERS
# =============================================================================

def _mock_change(change_id="CHG-001", urgency="CRITICAL"):
    """Create a mock RegulatoryChange object"""
    change = Mock()
    change.change_id = change_id
    change.domain = "Safety Reporting"
    change.change_type = "NEW_REQUIREMENT"
    change.new_requirement = "24-hour SAE reporting"
    change.effective_date = "2026-02-01"
    change.affected_submission_types = ["CT-04"]
    change.urgency = urgency
    change.model_dump_json.return_value = json.dumps({"change_id": change_id, "urgency": urgency})
    return change


def _mock_submission(submission_id="SUB-001"):
    """Create a mock ActiveSubmission object"""
    sub = Mock()
    sub.submission_id = submission_id
    sub.submission_type = "CT-04"
    sub.drug_name = "TestDrug"
    sub.phase = "Phase III"
    sub.status = "Under Review"
    sub.current_stage = "CDSCO Review"
    sub.key_documents = ["Protocol v1.0", "IB v2.0"]
    return sub


def _assessment_json(submission_id="SUB-001", change_id="CHG-001",
                      impact_status="IMPACTED", amendment_required=True,
                      amendment_type="Protocol", alert_text="REGULATORY ALERT"):
    """Build valid SubmissionImpactAssessment JSON"""
    return {
        "submission_id": submission_id,
        "change_id": change_id,
        "impact_status": impact_status,
        "impact_rationale": "Test rationale",
        "affected_documents": [],
        "amendment_required": amendment_required,
        "amendment_type": amendment_type if amendment_required else None,
        "estimated_delay_risk": "2-4 weeks",
        "recommended_actions": [],
        "human_review_required": True,
        "alert_text": alert_text
    }


# =============================================================================
# IMPACT ASSESSMENT TESTS
# =============================================================================

@pytest.mark.unit
@patch('app.services.submission_impact_assessor.OpenAI')
def test_assess_impacted_submission(mock_openai_cls, sample_active_submission,
                                     mock_anthropic_client, mock_claude_response_json):
    """Test assessment of IMPACTED submission"""
    mock_openai_cls.return_value = mock_anthropic_client

    data = _assessment_json(
        submission_id=sample_active_submission["submission_id"],
        impact_status="IMPACTED",
        amendment_required=True,
        amendment_type="Protocol",
        alert_text="REGULATORY ALERT: Immediate protocol amendment required"
    )
    data["affected_documents"] = [{
        "document": "Protocol v1.0",
        "affected_section": "Section 9.2",
        "current_content_summary": "SAEs reported within 7 days",
        "required_change": "Update to 24-hour reporting",
        "change_urgency": "BEFORE_NEXT_SUBMISSION"
    }]
    data["recommended_actions"] = [{
        "action": "Submit protocol amendment",
        "owner": "Sponsor",
        "deadline": "2026-03-01",
        "priority": "CRITICAL"
    }]

    mock_anthropic_client.chat.completions.create.return_value = \
        mock_claude_response_json(json.dumps(data))

    assessor = SubmissionImpactAssessor()
    change = _mock_change()
    submission = _mock_submission(sample_active_submission["submission_id"])
    result = assessor.assess_impact(change=change, submission=submission)

    assert result.impact_status == "IMPACTED"
    assert result.amendment_required is True
    assert len(result.affected_documents) >= 1


@pytest.mark.unit
@patch('app.services.submission_impact_assessor.OpenAI')
def test_assess_not_impacted_submission(mock_openai_cls, sample_active_submission,
                                         mock_anthropic_client, mock_claude_response_json):
    """Test assessment of NOT_IMPACTED submission"""
    mock_openai_cls.return_value = mock_anthropic_client

    data = _assessment_json(
        submission_id=sample_active_submission["submission_id"],
        change_id="CHG-002",
        impact_status="NOT_IMPACTED",
        amendment_required=False,
        alert_text="No action required for this submission"
    )

    mock_anthropic_client.chat.completions.create.return_value = \
        mock_claude_response_json(json.dumps(data))

    assessor = SubmissionImpactAssessor()
    change = _mock_change("CHG-002")
    submission = _mock_submission(sample_active_submission["submission_id"])
    result = assessor.assess_impact(change=change, submission=submission)

    assert result.impact_status == "NOT_IMPACTED"
    assert result.amendment_required is False


@pytest.mark.unit
@patch('app.services.submission_impact_assessor.OpenAI')
def test_action_item_generation(mock_openai_cls, sample_active_submission,
                                 mock_anthropic_client, mock_claude_response_json):
    """Test action item generation"""
    mock_openai_cls.return_value = mock_anthropic_client

    data = _assessment_json(
        submission_id=sample_active_submission["submission_id"],
        change_id="CHG-003",
        impact_status="IMPACTED"
    )
    data["recommended_actions"] = [
        {"action": "Update protocol", "owner": "Sponsor", "deadline": "2026-03-01", "priority": "CRITICAL"},
        {"action": "Update ICF", "owner": "Sponsor", "deadline": "2026-03-01", "priority": "HIGH"},
        {"action": "Retrain sites", "owner": "CRO", "deadline": "2026-03-15", "priority": "MEDIUM"}
    ]

    mock_anthropic_client.chat.completions.create.return_value = \
        mock_claude_response_json(json.dumps(data))

    assessor = SubmissionImpactAssessor()
    change = _mock_change("CHG-003")
    submission = _mock_submission(sample_active_submission["submission_id"])
    result = assessor.assess_impact(change=change, submission=submission)

    assert len(result.recommended_actions) == 3
    assert result.recommended_actions[0].priority == "CRITICAL"


@pytest.mark.unit
@patch('app.services.submission_impact_assessor.OpenAI')
def test_amendment_requirement_detection(mock_openai_cls, sample_active_submission,
                                          mock_anthropic_client, mock_claude_response_json):
    """Test amendment requirement detection"""
    mock_openai_cls.return_value = mock_anthropic_client

    data = _assessment_json(
        submission_id=sample_active_submission["submission_id"],
        change_id="CHG-004",
        impact_status="IMPACTED",
        amendment_required=True,
        amendment_type="Protocol"
    )
    data["estimated_delay_risk"] = "6-8 weeks for EC and CDSCO approval"

    mock_anthropic_client.chat.completions.create.return_value = \
        mock_claude_response_json(json.dumps(data))

    assessor = SubmissionImpactAssessor()
    change = _mock_change("CHG-004")
    submission = _mock_submission(sample_active_submission["submission_id"])
    result = assessor.assess_impact(change=change, submission=submission)

    assert result.amendment_required is True
    assert result.amendment_type == "Protocol"


@pytest.mark.unit
@patch('app.services.submission_impact_assessor.OpenAI')
def test_alert_generation(mock_openai_cls, sample_active_submission,
                           mock_anthropic_client, mock_claude_response_json):
    """Test alert text generation"""
    mock_openai_cls.return_value = mock_anthropic_client

    alert = ("REGULATORY ALERT: New CDSCO requirement may impact your Phase III "
             "hypertension trial. Immediate review recommended to determine if "
             "protocol amendment is needed. Contact RA team for guidance.")
    data = _assessment_json(
        submission_id=sample_active_submission["submission_id"],
        change_id="CHG-005",
        impact_status="LIKELY_IMPACTED",
        amendment_required=False,
        alert_text=alert
    )

    mock_anthropic_client.chat.completions.create.return_value = \
        mock_claude_response_json(json.dumps(data))

    assessor = SubmissionImpactAssessor()
    change = _mock_change("CHG-005")
    submission = _mock_submission(sample_active_submission["submission_id"])
    result = assessor.assess_impact(change=change, submission=submission)

    assert len(result.alert_text) > 50
    assert "REGULATORY ALERT" in result.alert_text
