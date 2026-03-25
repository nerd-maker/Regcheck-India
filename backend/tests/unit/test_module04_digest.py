"""
Unit tests for Module 04 - Weekly Digest Generator
Tests digest generation and export formats
"""

import pytest
from unittest.mock import Mock, patch
import json
from app.services.weekly_digest_generator import WeeklyDigestGenerator
from app.models.regulatory_change_schemas import WeeklyDigest, SubmissionImpactAssessment


# =============================================================================
# HELPERS
# =============================================================================

def _mock_change(change_id="CHG-001", urgency="CRITICAL", source_citation="CDSCO Circular 001/2026"):
    """Create mock RegulatoryChange for digest tests"""
    c = Mock()
    c.change_id = change_id
    c.urgency = urgency
    c.source_citation = source_citation
    c.domain = "Safety Reporting"
    c.change_type = "NEW_REQUIREMENT"
    c.model_dump.return_value = {
        "change_id": change_id,
        "urgency": urgency,
        "source_citation": source_citation,
        "domain": "Safety Reporting"
    }
    return c


def _digest_json(executive_summary="Summary", critical_actions=None,
                  detailed_changes=None, monitoring_items=None,
                  no_material_changes=False):
    """Build valid WeeklyDigest JSON response (without computed fields)"""
    return {
        "executive_summary": executive_summary,
        "critical_actions": critical_actions or [],
        "detailed_changes": detailed_changes or [],
        "monitoring_items": monitoring_items or [],
        "no_material_changes": no_material_changes
    }


# =============================================================================
# DIGEST GENERATION TESTS
# =============================================================================

@pytest.mark.unit
@patch('app.services.weekly_digest_generator.OpenAI')
def test_generate_weekly_digest(mock_openai_cls, mock_anthropic_client, mock_claude_response_json):
    """Test weekly digest generation"""
    mock_openai_cls.return_value = mock_anthropic_client

    data = _digest_json(
        executive_summary="This week, CDSCO published 3 new circulars affecting clinical trial conduct.",
        critical_actions=[{
            "deadline": "2026-03-01",
            "action": "Update all protocols for new SAE reporting timeline",
            "affected_parties": "All Phase II-IV trials",
            "change_id": "CHG-001"
        }],
        detailed_changes=[{
            "change_title": "New SAE Reporting Timeline",
            "effective_date": "2026-02-01",
            "affects": "All clinical trials",
            "what_to_do": "Update protocols within 30 days",
            "source_citation": "CDSCO Circular 001/2026",
            "urgency": "CRITICAL"
        }],
        monitoring_items=["Monitor for further guidance on implementation"]
    )
    mock_anthropic_client.chat.completions.create.return_value = \
        mock_claude_response_json(json.dumps(data))

    # Create mock changes for generate_digest
    changes = [_mock_change("CHG-001"), _mock_change("CHG-002", "HIGH"), _mock_change("CHG-003", "MEDIUM")]
    
    generator = WeeklyDigestGenerator()
    result = generator.generate_digest(
        changes=changes,
        impact_assessments=[],
        start_date="2026-02-10",
        end_date="2026-02-16"
    )

    assert isinstance(result, WeeklyDigest)
    assert result.changes_extracted == 3
    assert len(result.critical_actions) >= 1


@pytest.mark.unit
@patch('app.services.weekly_digest_generator.OpenAI')
def test_executive_summary_quality(mock_openai_cls, mock_anthropic_client, mock_claude_response_json):
    """Test executive summary quality"""
    mock_openai_cls.return_value = mock_anthropic_client

    data = _digest_json(
        executive_summary=(
            "This week saw significant regulatory activity from CDSCO. "
            "Two new circulars were published affecting safety reporting and informed consent procedures. "
            "One critical change requires immediate action for all ongoing Phase III trials."
        )
    )
    mock_anthropic_client.chat.completions.create.return_value = \
        mock_claude_response_json(json.dumps(data))

    changes = [_mock_change("CHG-001"), _mock_change("CHG-002", "HIGH")]
    
    generator = WeeklyDigestGenerator()
    result = generator.generate_digest(
        changes=changes,
        impact_assessments=[],
        start_date="2026-02-10",
        end_date="2026-02-16"
    )

    assert len(result.executive_summary) > 100
    assert "CDSCO" in result.executive_summary


@pytest.mark.unit
@patch('app.services.weekly_digest_generator.OpenAI')
def test_critical_actions_formatting(mock_openai_cls, mock_anthropic_client, mock_claude_response_json):
    """Test critical actions formatting"""
    mock_openai_cls.return_value = mock_anthropic_client

    data = _digest_json(
        executive_summary="Summary",
        critical_actions=[
            {"deadline": "2026-03-01", "action": "Submit protocol amendments",
             "affected_parties": "All Phase III trials", "change_id": "CHG-001"},
            {"deadline": "2026-02-25", "action": "Update ICFs",
             "affected_parties": "All trials with ongoing enrollment", "change_id": "CHG-002"}
        ]
    )
    mock_anthropic_client.chat.completions.create.return_value = \
        mock_claude_response_json(json.dumps(data))

    changes = [_mock_change("CHG-001"), _mock_change("CHG-002", "HIGH")]
    
    generator = WeeklyDigestGenerator()
    result = generator.generate_digest(
        changes=changes,
        impact_assessments=[],
        start_date="2026-02-10",
        end_date="2026-02-16"
    )

    assert len(result.critical_actions) == 2
    assert all(hasattr(a, 'deadline') for a in result.critical_actions)


@pytest.mark.unit
@patch('app.services.weekly_digest_generator.OpenAI')
def test_export_text_format(mock_openai_cls, mock_anthropic_client, mock_claude_response_json):
    """Test text export format"""
    mock_openai_cls.return_value = mock_anthropic_client

    data = _digest_json(
        executive_summary="No critical changes this week.",
        no_material_changes=True
    )
    mock_anthropic_client.chat.completions.create.return_value = \
        mock_claude_response_json(json.dumps(data))

    generator = WeeklyDigestGenerator()
    digest = generator.generate_digest(
        changes=[],
        impact_assessments=[],
        start_date="2026-02-10",
        end_date="2026-02-16"
    )
    
    text_export = generator.export_digest(digest, format="text")
    assert isinstance(text_export, str)
    assert len(text_export) > 0


@pytest.mark.unit
@patch('app.services.weekly_digest_generator.OpenAI')
def test_export_markdown_format(mock_openai_cls, mock_anthropic_client, mock_claude_response_json):
    """Test markdown export format"""
    mock_openai_cls.return_value = mock_anthropic_client

    data = _digest_json(executive_summary="Summary")
    mock_anthropic_client.chat.completions.create.return_value = \
        mock_claude_response_json(json.dumps(data))

    generator = WeeklyDigestGenerator()
    digest = generator.generate_digest(
        changes=[],
        impact_assessments=[],
        start_date="2026-02-10",
        end_date="2026-02-16"
    )
    
    markdown_export = generator.export_digest(digest, format="markdown")
    assert isinstance(markdown_export, str)
    assert "#" in markdown_export


@pytest.mark.unit
@patch('app.services.weekly_digest_generator.OpenAI')
def test_no_material_changes_digest(mock_openai_cls, mock_anthropic_client, mock_claude_response_json):
    """Test digest when no material changes occurred"""
    mock_openai_cls.return_value = mock_anthropic_client

    data = _digest_json(
        executive_summary="No material regulatory changes were published during this period.",
        no_material_changes=True
    )
    mock_anthropic_client.chat.completions.create.return_value = \
        mock_claude_response_json(json.dumps(data))

    generator = WeeklyDigestGenerator()
    result = generator.generate_digest(
        changes=[],
        impact_assessments=[],
        start_date="2026-02-10",
        end_date="2026-02-16"
    )

    assert result.no_material_changes is True
    assert result.new_documents_detected == 0
    assert len(result.critical_actions) == 0
