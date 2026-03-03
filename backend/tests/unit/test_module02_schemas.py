"""
Unit tests for Module 02 - Document Generation Schemas
Tests Pydantic models and schema validation
"""

import pytest
from pydantic import ValidationError
from app.models.study_data_schemas import (
    StudyDataInput as StudyData,
    GeneratedSection as DocumentSection,
    DocumentGenerationRequest as GenerationRequest,
    ICFTranslationRequest,
)


# =============================================================================
# STUDY DATA TESTS
# =============================================================================

@pytest.mark.unit
def test_study_data_valid_creation(sample_study_data):
    """Test creating valid StudyData instance"""
    study = StudyData(**sample_study_data)
    
    assert study.study_title == sample_study_data["study_title"]
    assert study.protocol_number == sample_study_data["protocol_number"]
    assert study.phase == sample_study_data["phase"]
    assert study.sponsor_name == sample_study_data["sponsor_name"]


@pytest.mark.unit
def test_study_data_missing_required_fields():
    """Test StudyData validation with missing required fields"""
    incomplete_data = {
        "study_title": "Test Study"
        # Missing other required fields
    }
    
    with pytest.raises(ValidationError) as exc_info:
        StudyData(**incomplete_data)
    
    errors = exc_info.value.errors()
    assert len(errors) > 0
    assert any(e["type"] == "missing" for e in errors)


@pytest.mark.unit
def test_study_data_invalid_phase():
    """Test StudyData with unusual phase value (model accepts any str)"""
    data = {
        "study_title": "Test Study",
        "protocol_number": "PROTO-001",
        "phase": "Phase V",
        "indication": "Test",
        "sponsor_name": "Test Sponsor",
        "imp_name": "Test Drug",
        "imp_dose": "5mg",
        "imp_route": "oral",
        "design_type": "Parallel",
        "blinding": "Open-label",
        "randomization": "1:1",
        "sample_size": 50,
        "duration": "12 weeks",
        "site_count": 1,
        "countries": ["India"],
        "primary_endpoint": "Primary EP",
        "secondary_endpoints": ["Secondary EP"],
        "inclusion_criteria": ["Age 18+"],
        "exclusion_criteria": ["Pregnant"],
        "age_range": "18-65 years"
    }
    
    study = StudyData(**data)
    assert study.phase == "Phase V"


# =============================================================================
# DOCUMENT SECTION TESTS
# =============================================================================

@pytest.mark.unit
def test_document_section_creation():
    """Test creating DocumentSection instance"""
    section = DocumentSection(
        section_number="1.0",
        section_heading="Introduction",
        generated_content="This is the introduction section.",
        placeholders_used=[],
        regulatory_choices_made=[],
        completion_pct=100,
        review_priority="LOW",
        review_priority_reason="Standard section"
    )
    
    assert section.section_number == "1.0"
    assert section.section_heading == "Introduction"
    assert section.review_priority == "LOW"
    assert len(section.placeholders_used) == 0


@pytest.mark.unit
def test_document_section_with_placeholders():
    """Test DocumentSection with placeholders"""
    section = DocumentSection(
        section_number="2.0",
        section_heading="Study Objectives",
        generated_content="The primary objective is [PRIMARY_OBJECTIVE].",
        placeholders_used=["[PRIMARY_OBJECTIVE]"],
        regulatory_choices_made=[],
        completion_pct=80,
        review_priority="MEDIUM",
        review_priority_reason="Contains placeholders"
    )
    
    assert len(section.placeholders_used) == 1
    assert "[PRIMARY_OBJECTIVE]" in section.placeholders_used


@pytest.mark.unit
def test_document_section_review_priority_validation():
    """Test review priority validation"""
    valid_priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    
    for priority in valid_priorities:
        section = DocumentSection(
            section_number="1.0",
            section_heading="Test",
            generated_content="Test content",
            placeholders_used=[],
            regulatory_choices_made=[],
            completion_pct=100,
            review_priority=priority,
            review_priority_reason="Test reason"
        )
        assert section.review_priority == priority


# =============================================================================
# GENERATION REQUEST TESTS
# =============================================================================

@pytest.mark.unit
def test_generation_request_protocol(sample_study_data):
    """Test GenerationRequest for protocol"""
    request = GenerationRequest(
        document_type="protocol",
        study_data=sample_study_data,
        generate_all_sections=True
    )
    
    assert request.document_type == "protocol"
    assert request.generate_all_sections is True


@pytest.mark.unit
def test_generation_request_all_sections(sample_study_data):
    """Test GenerationRequest with generate_all_sections flag"""
    request = GenerationRequest(
        document_type="protocol",
        study_data=sample_study_data,
        generate_all_sections=True
    )
    
    assert request.generate_all_sections is True


# =============================================================================
# ICF TRANSLATION TESTS
# =============================================================================

@pytest.mark.unit
def test_icf_translation_request(sample_icf_content):
    """Test ICFTranslationRequest creation"""
    request = ICFTranslationRequest(
        icf_content=sample_icf_content,
        target_language="hindi",
        icf_version="1.0"
    )
    
    assert request.target_language == "hindi"
    assert request.icf_version == "1.0"


@pytest.mark.unit
def test_icf_translation_request_invalid_language(sample_icf_content):
    """Test ICFTranslationRequest with unusual language (model accepts any str)"""
    request = ICFTranslationRequest(
        icf_content=sample_icf_content,
        target_language="french",
        icf_version="1.0"
    )
    
    assert request.target_language == "french"


# =============================================================================
# PLACEHOLDER DETECTION TESTS
# =============================================================================

@pytest.mark.unit
def test_placeholder_pattern_detection():
    """Test placeholder pattern detection in content"""
    content_with_placeholders = """
    The study will enroll [SAMPLE_SIZE] participants.
    The primary endpoint is [PRIMARY_ENDPOINT].
    The study duration is [STUDY_DURATION].
    """
    
    import re
    placeholder_pattern = r'\[([A-Z_]+)\]'
    placeholders = re.findall(placeholder_pattern, content_with_placeholders)
    
    assert len(placeholders) == 3
    assert "SAMPLE_SIZE" in placeholders
    assert "PRIMARY_ENDPOINT" in placeholders
    assert "STUDY_DURATION" in placeholders


@pytest.mark.unit
def test_no_placeholders_in_content():
    """Test content without placeholders"""
    content_no_placeholders = """
    This is a complete section with no placeholders.
    All information has been filled in.
    """
    
    import re
    placeholder_pattern = r'\[([A-Z_]+)\]'
    placeholders = re.findall(placeholder_pattern, content_no_placeholders)
    
    assert len(placeholders) == 0


# =============================================================================
# EDGE CASES
# =============================================================================

@pytest.mark.unit
def test_study_data_with_optional_fields(sample_study_data):
    """Test StudyData with optional fields populated"""
    extended_data = {
        **sample_study_data,
        "secondary_endpoints": ["Endpoint 1", "Endpoint 2"],
        "inclusion_criteria": ["Criteria 1", "Criteria 2"],
        "exclusion_criteria": ["Criteria 1"],
        "additional_notes": "Extra notes"
    }
    
    study = StudyData(**extended_data)
    assert len(study.secondary_endpoints) == 2
    assert len(study.inclusion_criteria) == 2


@pytest.mark.unit
def test_document_section_empty_content():
    """Test DocumentSection with empty content"""
    section = DocumentSection(
        section_number="1.0",
        section_heading="Empty Section",
        generated_content="",
        placeholders_used=[],
        regulatory_choices_made=[],
        completion_pct=0,
        review_priority="LOW",
        review_priority_reason="Empty"
    )
    
    assert section.generated_content == ""
    assert len(section.placeholders_used) == 0
