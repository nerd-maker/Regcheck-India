"""
Shared test fixtures and configuration for all tests.
"""

import pytest
from unittest.mock import Mock, MagicMock, patch
from datetime import datetime


# =============================================================================
# MOCK LLM CLIENT (Anthropic Claude)
# =============================================================================

@pytest.fixture
def mock_openai_client():
    """Mock Anthropic Claude client for all tests (legacy name kept for compatibility)"""
    client = Mock()
    client.messages = Mock()
    client.chat = Mock()
    client.chat.completions = Mock()

    def _proxy_messages_create(*args, **kwargs):
        return client.chat.completions.create(*args, **kwargs)

    client.messages.create.side_effect = _proxy_messages_create
    return client


# Backwards-compatible alias
@pytest.fixture
def mock_anthropic_client(mock_openai_client):
    """Alias for mock_openai_client (backwards compatibility)"""
    return mock_openai_client


@pytest.fixture
def mock_claude_response_json():
    """Mock Anthropic Claude API response with JSON content"""
    def _create_response(json_content: str):
        response = Mock()
        text_block = Mock()
        text_block.text = json_content
        response.content = [text_block]
        response.usage = Mock(input_tokens=50, output_tokens=100)
        return response
    return _create_response


# =============================================================================
# MODULE 02 FIXTURES
# =============================================================================

@pytest.fixture
def sample_study_data():
    """Sample study data for Module 02 testing"""
    return {
        "study_title": "A Phase III Study of Test Drug in Hypertension",
        "protocol_number": "PROTO-2026-001",
        "phase": "Phase III",
        "indication": "Hypertension",
        "sponsor_name": "Test Pharmaceutical Company",
        "imp_name": "Test Drug",
        "imp_dose": "10mg",
        "imp_route": "oral",
        "imp_formulation": "tablet",
        "comparator_name": "Placebo",
        "design_type": "Parallel group",
        "blinding": "Double-Blind",
        "randomization": "1:1 ratio, stratified by baseline BP",
        "sample_size": 300,
        "duration": "52 weeks",
        "treatment_duration": "24 weeks",
        "followup_duration": "28 weeks",
        "site_count": 15,
        "countries": ["India"],
        "primary_endpoint": "Change in systolic blood pressure from baseline",
        "secondary_endpoints": ["Diastolic blood pressure change", "Adverse events"],
        "inclusion_criteria": ["Age 18-65", "Diagnosed hypertension"],
        "exclusion_criteria": ["Pregnancy", "Severe renal impairment"],
        "age_range": "18-65 years"
    }


@pytest.fixture
def sample_icf_content():
    """Sample ICF content for translation testing"""
    return """
    INFORMED CONSENT FORM
    
    Study Title: A Phase III Study of Test Drug in Hypertension
    
    You are being invited to participate in a research study. This form provides information about the study. Please read it carefully and ask questions if anything is unclear.
    
    PURPOSE OF THE STUDY:
    This study will test whether Test Drug is safe and effective for treating high blood pressure.
    
    PROCEDURES:
    If you agree to participate, you will take the study medication once daily for 52 weeks. You will visit the clinic every 4 weeks for blood pressure measurements and safety assessments.
    
    RISKS:
    Possible side effects include dizziness, headache, and fatigue.
    
    BENEFITS:
    You may experience improved blood pressure control.
    """


# =============================================================================
# MODULE 03 FIXTURES
# =============================================================================

@pytest.fixture
def sample_cdsco_query():
    """Sample CDSCO query for Module 03 testing"""
    return {
        "query_text": "Please clarify the SAE reporting timeline for this study. The protocol states 24 hours but NDCTR requires immediate reporting. How will you ensure compliance?",
        "query_reference": "CDSCO/CT/2026/001/Q1",
        "submission_type": "CT-04",
        "response_deadline": "2026-03-15",
        "query_date": "2026-02-15"
    }


@pytest.fixture
def sample_query_classification():
    """Sample query classification result"""
    return {
        "primary_category": "safety_reporting",
        "secondary_categories": ["protocol_compliance"],
        "complexity": "MODERATE",
        "urgency": "HIGH",
        "data_gaps": "PARTIAL",
        "classification_rationale": "Query relates to SAE reporting timelines with potential protocol-regulation conflict"
    }


# =============================================================================
# MODULE 04 FIXTURES
# =============================================================================

@pytest.fixture
def sample_cdsco_circular():
    """Sample CDSCO circular for Module 04 testing"""
    return {
        "source_url": "https://cdsco.gov.in/opencms/opencms/en/Notifications/Circular-2026-001.pdf",
        "document_title": "CDSCO Circular No. 001/2026 - Updated SAE Reporting Requirements",
        "publication_date": "2026-02-01",
        "document_type": "Circular",
        "full_text": """
        CENTRAL DRUGS STANDARD CONTROL ORGANISATION
        Circular No. 001/2026
        Date: 01-02-2026
        
        Subject: Updated Requirements for Serious Adverse Event Reporting in Clinical Trials
        
        This circular updates the timeline for reporting Serious Adverse Events (SAEs) in ongoing clinical trials.
        
        NEW REQUIREMENT:
        All SAEs must be reported to CDSCO within 24 hours of the investigator becoming aware of the event. This supersedes the previous 7-day reporting requirement.
        
        EFFECTIVE DATE:
        This requirement is effective immediately from the date of this circular.
        
        TRANSITION PROVISIONS:
        Ongoing trials must update their protocols and ICFs within 30 days to reflect this change.
        
        AFFECTED TRIALS:
        All Phase II, Phase III, and Phase IV clinical trials involving new drugs, biologics, and medical devices.
        """
    }


@pytest.fixture
def sample_active_submission():
    """Sample active submission for Module 04 testing"""
    return {
        "submission_id": "SUB-2026-001",
        "submission_type": "CT-04",
        "drug_name": "Test Drug",
        "phase": "Phase III",
        "indication": "Hypertension",
        "status": "Under Review",
        "current_stage": "CDSCO review pending",
        "key_documents": ["Protocol v1.0", "ICF v1.0", "IB v2.0"],
        "sponsor_name": "Test Pharmaceutical Company",
        "customer_id": "CUST-001"
    }


# =============================================================================
# MOCK KNOWLEDGE BASE
# =============================================================================

@pytest.fixture
def mock_knowledge_base():
    """Mock knowledge base for testing"""
    kb = Mock()
    kb.query.return_value = [
        {
            "content": "Sample regulatory requirement text",
            "section": "1.0 Introduction",
            "metadata": {"source": "NDCTR 2019"}
        }
    ]
    kb.get_stats.return_value = {
        "total_chunks": 100,
        "total_documents": 10
    }
    return kb


# =============================================================================
# PYTEST CONFIGURATION
# =============================================================================

@pytest.fixture(autouse=True)
def reset_mocks():
    """Reset all mocks before each test"""
    yield
    # Cleanup after test


@pytest.fixture(autouse=True)
def patch_claude_client(mock_openai_client):
    """Route all Claude calls through the shared mock client in tests."""
    with patch("app.services.claude_client.get_claude_client", return_value=mock_openai_client):
        yield


def pytest_configure(config):
    """Configure pytest with custom markers"""
    config.addinivalue_line(
        "markers", "unit: mark test as a unit test"
    )
    config.addinivalue_line(
        "markers", "integration: mark test as an integration test"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow running"
    )
