"""
Unit tests for Module 02 - Document Generator Service
Tests document generation logic and LLM API integration
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import json
from app.services.document_generator import DocumentGenerator as DocumentGeneratorService
from app.models.study_data_schemas import StudyDataInput as StudyData, GeneratedSection as DocumentSection


# =============================================================================
# HELPERS
# =============================================================================

def _create_service_with_mocks(mock_client):
    """Create a DocumentGeneratorService with all dependencies mocked"""
    with patch('app.services.document_generator.OpenAI', return_value=mock_client), \
         patch('app.services.document_generator.SchemaEngine') as MockSchema, \
         patch('app.services.document_generator.ComplianceEvaluator'):
        
        mock_engine = MockSchema.return_value
        
        def _get_section_schema(doc_type, section_number):
            schema = MagicMock()
            schema.section_number = section_number
            schema.section_heading = f"Section {section_number}"
            schema.required = True
            schema.subsections = []
            schema.regulatory_requirements = "NDCTR 2019"
            schema.word_count_guidance = "200-500 words"
            schema.special_instructions = None
            return schema
        
        mock_engine.get_section_schema.side_effect = _get_section_schema
        
        def _get_all_sections(doc_type):
            sections = []
            for num in ["1.0", "2.0", "3.0"]:
                s = MagicMock()
                s.section_number = num
                s.section_heading = f"Section {num}"
                s.required = True
                s.subsections = []
                s.regulatory_requirements = ""
                s.word_count_guidance = ""
                sections.append(s)
            return sections
        
        mock_engine.get_all_sections.side_effect = _get_all_sections
        mock_engine.get_section_list_formatted.return_value = "1.0. Title\n2.0. Objectives\n3.0. Design"
        
        service = DocumentGeneratorService()
        return service


def _to_study_data(d: dict):
    """Convert test dict to a mock object with attribute access"""
    mock_data = MagicMock()
    for key, value in d.items():
        setattr(mock_data, key, value)
    mock_data.model_dump.return_value = d
    return mock_data


def _section_json(section_number, heading, content, placeholders=None, review_priority="LOW"):
    """Create a valid GeneratedSection JSON matching the actual Pydantic schema"""
    return {
        "section_number": section_number,
        "section_heading": heading,
        "generated_content": content,
        "placeholders_used": placeholders or [],
        "regulatory_choices_made": [],
        "completion_pct": 100,
        "review_priority": review_priority,
        "review_priority_reason": "Auto-assessed"
    }


# =============================================================================
# DOCUMENT GENERATOR TESTS
# =============================================================================

@pytest.mark.unit
def test_generate_single_section_success(sample_study_data, mock_anthropic_client, mock_claude_response_json):
    """Test successful single section generation"""
    section_data = _section_json(
        "1.0", "Study Title and Protocol Number",
        "Study Title: A Phase III Study of Test Drug in Hypertension\nProtocol Number: PROTO-2026-001"
    )
    
    mock_response = mock_claude_response_json(json.dumps(section_data))
    mock_anthropic_client.chat.completions.create.return_value = mock_response
    
    service = _create_service_with_mocks(mock_anthropic_client)
    result = service.generate_single_section(
        document_type="protocol",
        section_number="1.0",
        study_data=_to_study_data(sample_study_data)
    )
    
    assert result.section_number == "1.0"
    assert result.section_heading == "Study Title and Protocol Number"
    assert len(result.placeholders_used) == 0


@pytest.mark.unit
def test_generate_section_with_placeholders(sample_study_data, mock_anthropic_client, mock_claude_response_json):
    """Test section generation with placeholders"""
    section_data = _section_json(
        "2.0", "Study Objectives",
        "Primary Objective: [PRIMARY_OBJECTIVE]\nSecondary Objectives: [SECONDARY_OBJECTIVES]",
        placeholders=["[PRIMARY_OBJECTIVE]", "[SECONDARY_OBJECTIVES]"],
        review_priority="HIGH"
    )
    
    mock_response = mock_claude_response_json(json.dumps(section_data))
    mock_anthropic_client.chat.completions.create.return_value = mock_response
    
    service = _create_service_with_mocks(mock_anthropic_client)
    result = service.generate_single_section(
        document_type="protocol",
        section_number="2.0",
        study_data=_to_study_data(sample_study_data)
    )
    
    assert len(result.placeholders_used) == 2
    assert "[PRIMARY_OBJECTIVE]" in result.placeholders_used
    assert result.review_priority == "HIGH"


@pytest.mark.unit
def test_generate_full_protocol(sample_study_data, mock_anthropic_client, mock_claude_response_json):
    """Test full protocol generation returns structured result"""
    sections = [
        _section_json("1.0", "Title", "Content 1"),
        _section_json("2.0", "Objectives", "Content 2", review_priority="MEDIUM"),
        _section_json("3.0", "Design", "Content 3", review_priority="HIGH"),
    ]
    
    mock_responses = [mock_claude_response_json(json.dumps(s)) for s in sections]
    mock_anthropic_client.chat.completions.create.side_effect = mock_responses
    
    with patch('app.services.document_generator.SectionContextStore'):
        service = _create_service_with_mocks(mock_anthropic_client)
        result = service.generate_document(
            document_type="protocol",
            study_data=_to_study_data(sample_study_data)
        )
    
    # generate_document should return a dict with expected keys
    assert isinstance(result, dict)
    assert "sections" in result


@pytest.mark.unit
def test_inline_validation_high_priority(sample_study_data, mock_anthropic_client, mock_claude_response_json):
    """Test inline validation assigns high priority correctly"""
    section_data = _section_json(
        "5.0", "Inclusion/Exclusion Criteria",
        "Inclusion: Age 18-65...",
        review_priority="CRITICAL"
    )
    
    mock_response = mock_claude_response_json(json.dumps(section_data))
    mock_anthropic_client.chat.completions.create.return_value = mock_response
    
    service = _create_service_with_mocks(mock_anthropic_client)
    result = service.generate_single_section(
        document_type="protocol",
        section_number="5.0",
        study_data=_to_study_data(sample_study_data)
    )
    
    assert result.review_priority == "CRITICAL"


@pytest.mark.unit
def test_error_handling_api_failure(sample_study_data, mock_anthropic_client):
    """Test error handling when LLM API fails"""
    mock_anthropic_client.chat.completions.create.side_effect = Exception("API Error")
    
    service = _create_service_with_mocks(mock_anthropic_client)
    
    with pytest.raises(Exception) as exc_info:
        service.generate_single_section(
            document_type="protocol",
            section_number="1.0",
            study_data=_to_study_data(sample_study_data)
        )
    
    assert "API Error" in str(exc_info.value)


@pytest.mark.unit
def test_placeholder_tracking(sample_study_data, mock_anthropic_client, mock_claude_response_json):
    """Test placeholder tracking across sections"""
    section_data = _section_json(
        "6.0", "Study Procedures",
        "Visit 1: [VISIT_1_PROCEDURES]\nVisit 2: [VISIT_2_PROCEDURES]",
        placeholders=["[VISIT_1_PROCEDURES]", "[VISIT_2_PROCEDURES]"],
        review_priority="MEDIUM"
    )
    
    mock_response = mock_claude_response_json(json.dumps(section_data))
    mock_anthropic_client.chat.completions.create.return_value = mock_response
    
    service = _create_service_with_mocks(mock_anthropic_client)
    result = service.generate_single_section(
        document_type="protocol",
        section_number="6.0",
        study_data=_to_study_data(sample_study_data)
    )
    
    assert len(result.placeholders_used) == 2
    assert all(p.startswith("[") and p.endswith("]") for p in result.placeholders_used)


@pytest.mark.unit
def test_review_priority_assignment(sample_study_data, mock_anthropic_client, mock_claude_response_json):
    """Test review priority assignment logic"""
    priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    
    for priority in priorities:
        section_data = _section_json("1.0", "Test", "Test content", review_priority=priority)
        
        mock_response = mock_claude_response_json(json.dumps(section_data))
        mock_anthropic_client.chat.completions.create.return_value = mock_response
        
        service = _create_service_with_mocks(mock_anthropic_client)
        result = service.generate_single_section(
            document_type="protocol",
            section_number="1.0",
            study_data=_to_study_data(sample_study_data)
        )
        
        assert result.review_priority == priority


# =============================================================================
# EDGE CASES
# =============================================================================

@pytest.mark.unit
def test_generate_section_with_invalid_json(sample_study_data, mock_anthropic_client):
    """Test handling of invalid JSON response from LLM — service handles gracefully"""
    mock_response = Mock()
    message = Mock()
    message.content = "This is not valid JSON"
    choice = Mock()
    choice.message = message
    mock_response.choices = [choice]
    mock_anthropic_client.chat.completions.create.return_value = mock_response
    
    service = _create_service_with_mocks(mock_anthropic_client)
    
    # Service handles invalid JSON gracefully with fallback section
    result = service.generate_single_section(
        document_type="protocol",
        section_number="1.0",
        study_data=_to_study_data(sample_study_data)
    )
    # Fallback section should have the section number at minimum
    assert result.section_number == "1.0"


@pytest.mark.unit
def test_generate_section_empty_study_data(mock_anthropic_client, mock_claude_response_json):
    """Test generation with minimal study data"""
    minimal_data = {
        "study_title": "Minimal Study",
        "protocol_number": "MIN-001",
        "phase": "Phase I",
        "indication": "Test",
        "sponsor_name": "Test Sponsor",
        "imp_name": "Test Drug"
    }
    
    section_data = _section_json(
        "1.0", "Title", "Minimal content with many placeholders",
        placeholders=["[DETAIL_1]", "[DETAIL_2]", "[DETAIL_3]"],
        review_priority="HIGH"
    )
    
    mock_response = mock_claude_response_json(json.dumps(section_data))
    mock_anthropic_client.chat.completions.create.return_value = mock_response
    
    service = _create_service_with_mocks(mock_anthropic_client)
    result = service.generate_single_section(
        document_type="protocol",
        section_number="1.0",
        study_data=_to_study_data(minimal_data)
    )
    
    assert len(result.placeholders_used) >= 3
    assert result.review_priority == "HIGH"
