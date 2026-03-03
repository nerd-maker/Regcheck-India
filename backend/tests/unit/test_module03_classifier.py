"""
Unit tests for Module 03 - Query Classifier Service
Tests query classification and complexity assessment
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import json
from app.services.query_classifier import QueryClassifier as QueryClassifierService
from app.models.query_schemas import QueryClassification


# =============================================================================
# HELPER
# =============================================================================

def _classification_json(primary_category, complexity="MODERATE", urgency="MEDIUM",
                         data_gap="NO", data_gap_detail="",
                         secondary_categories=None,
                         recommended_template="TMPL-DEFAULT",
                         classification_confidence="HIGH", reasoning="Test"):
    """Build mock JSON matching actual QueryClassification Pydantic schema"""
    return {
        "primary_category": primary_category,
        "secondary_categories": secondary_categories or [],
        "complexity": complexity,
        "urgency": urgency,
        "data_gap": data_gap,
        "data_gap_detail": data_gap_detail,
        "recommended_template": recommended_template,
        "classification_confidence": classification_confidence,
        "reasoning": reasoning
    }


# Patch the confidence manager module-wide so it's active during classify_query
_CCM_PATCH = 'app.services.query_classifier.classification_confidence_manager'
_CCM_RETURN = {"action": "AUTO_PROCEED", "requires_confirmation": False, "is_high_stakes": False}


# =============================================================================
# QUERY CLASSIFICATION TESTS
# =============================================================================

@pytest.mark.unit
@patch(_CCM_PATCH)
@patch.object(QueryClassifierService, '_load_categories', return_value=[])
@patch('app.services.query_classifier.OpenAI')
def test_classify_protocol_deviation(mock_openai_cls, mock_load, mock_ccm,
                                     sample_cdsco_query, mock_anthropic_client, mock_claude_response_json):
    """Test classification of protocol deviation query"""
    mock_openai_cls.return_value = mock_anthropic_client
    mock_ccm.assess_classification.return_value = _CCM_RETURN
    
    data = _classification_json("protocol_deviation", recommended_template="TMPL-PROTOCOL-DEVIATION")
    mock_anthropic_client.chat.completions.create.return_value = mock_claude_response_json(json.dumps(data))
    
    service = QueryClassifierService()
    result = service.classify_query("How will you handle protocol deviations in this study?")
    
    assert result.primary_category == "protocol_deviation"
    assert result.complexity == "MODERATE"


@pytest.mark.unit
@patch(_CCM_PATCH)
@patch.object(QueryClassifierService, '_load_categories', return_value=[])
@patch('app.services.query_classifier.OpenAI')
def test_classify_safety_reporting(mock_openai_cls, mock_load, mock_ccm,
                                   sample_cdsco_query, mock_anthropic_client, mock_claude_response_json):
    """Test classification of safety reporting query"""
    mock_openai_cls.return_value = mock_anthropic_client
    mock_ccm.assess_classification.return_value = _CCM_RETURN
    
    data = _classification_json("safety_reporting", complexity="HIGH", urgency="HIGH",
                                secondary_categories=["regulatory_compliance"],
                                data_gap="PARTIAL", recommended_template="TMPL-SAFETY-REPORTING")
    mock_anthropic_client.chat.completions.create.return_value = mock_claude_response_json(json.dumps(data))
    
    service = QueryClassifierService()
    result = service.classify_query(sample_cdsco_query["query_text"])
    
    assert result.primary_category == "safety_reporting"
    assert result.urgency == "HIGH"
    assert result.data_gap == "PARTIAL"


@pytest.mark.unit
@patch(_CCM_PATCH)
@patch.object(QueryClassifierService, '_load_categories', return_value=[])
@patch('app.services.query_classifier.OpenAI')
def test_complexity_assessment_simple(mock_openai_cls, mock_load, mock_ccm,
                                      mock_anthropic_client, mock_claude_response_json):
    """Test complexity assessment for simple query"""
    mock_openai_cls.return_value = mock_anthropic_client
    mock_ccm.assess_classification.return_value = _CCM_RETURN
    
    data = _classification_json("administrative", complexity="LOW", urgency="LOW",
                                recommended_template="TMPL-ADMIN")
    mock_anthropic_client.chat.completions.create.return_value = mock_claude_response_json(json.dumps(data))
    
    service = QueryClassifierService()
    result = service.classify_query("Please confirm the submission date.")
    
    assert result.complexity == "LOW"
    assert result.urgency == "LOW"


@pytest.mark.unit
@patch(_CCM_PATCH)
@patch.object(QueryClassifierService, '_load_categories', return_value=[])
@patch('app.services.query_classifier.OpenAI')
def test_complexity_assessment_complex(mock_openai_cls, mock_load, mock_ccm,
                                       mock_anthropic_client, mock_claude_response_json):
    """Test complexity assessment for complex query"""
    mock_openai_cls.return_value = mock_anthropic_client
    mock_ccm.assess_classification.return_value = _CCM_RETURN
    
    data = _classification_json("statistical_analysis", complexity="VERY_HIGH", urgency="HIGH",
                                secondary_categories=["study_design", "endpoints"],
                                data_gap="YES", recommended_template="TMPL-STATISTICAL")
    mock_anthropic_client.chat.completions.create.return_value = mock_claude_response_json(json.dumps(data))
    
    service = QueryClassifierService()
    result = service.classify_query("Please justify the statistical methodology for the interim analysis.")
    
    assert result.complexity == "VERY_HIGH"
    assert len(result.secondary_categories) > 0


@pytest.mark.unit
@patch(_CCM_PATCH)
@patch.object(QueryClassifierService, '_load_categories', return_value=[])
@patch('app.services.query_classifier.OpenAI')
def test_urgency_assessment_critical(mock_openai_cls, mock_load, mock_ccm,
                                     mock_anthropic_client, mock_claude_response_json):
    """Test urgency assessment for critical query"""
    mock_openai_cls.return_value = mock_anthropic_client
    mock_ccm.assess_classification.return_value = _CCM_RETURN
    
    data = _classification_json("safety_reporting", complexity="HIGH", urgency="CRITICAL",
                                recommended_template="TMPL-SAFETY-URGENT")
    mock_anthropic_client.chat.completions.create.return_value = mock_claude_response_json(json.dumps(data))
    
    service = QueryClassifierService()
    result = service.classify_query("Immediate clarification needed on SAE reporting.")
    
    assert result.urgency == "CRITICAL"


@pytest.mark.unit
@patch(_CCM_PATCH)
@patch.object(QueryClassifierService, '_load_categories', return_value=[])
@patch('app.services.query_classifier.OpenAI')
def test_data_gap_detection_none(mock_openai_cls, mock_load, mock_ccm,
                                 mock_anthropic_client, mock_claude_response_json):
    """Test data gap detection when no gaps exist"""
    mock_openai_cls.return_value = mock_anthropic_client
    mock_ccm.assess_classification.return_value = _CCM_RETURN
    
    data = _classification_json("protocol_compliance", data_gap="NO",
                                recommended_template="TMPL-COMPLIANCE")
    mock_anthropic_client.chat.completions.create.return_value = mock_claude_response_json(json.dumps(data))
    
    service = QueryClassifierService()
    result = service.classify_query("Please clarify the ICF withdrawal process.")
    
    assert result.data_gap == "NO"


@pytest.mark.unit
@patch(_CCM_PATCH)
@patch.object(QueryClassifierService, '_load_categories', return_value=[])
@patch('app.services.query_classifier.OpenAI')
def test_data_gap_detection_significant(mock_openai_cls, mock_load, mock_ccm,
                                        mock_anthropic_client, mock_claude_response_json):
    """Test data gap detection when significant gaps exist"""
    mock_openai_cls.return_value = mock_anthropic_client
    mock_ccm.assess_classification.return_value = _CCM_RETURN
    
    data = _classification_json("biostatistics", complexity="VERY_HIGH", urgency="HIGH",
                                data_gap="YES", data_gap_detail="Missing sample size parameters",
                                recommended_template="TMPL-BIOSTAT")
    mock_anthropic_client.chat.completions.create.return_value = mock_claude_response_json(json.dumps(data))
    
    service = QueryClassifierService()
    result = service.classify_query("Justify the sample size calculation.")
    
    assert result.data_gap == "YES"


@pytest.mark.unit
@patch(_CCM_PATCH)
@patch.object(QueryClassifierService, '_load_categories', return_value=[])
@patch('app.services.query_classifier.OpenAI')
def test_secondary_categories_detection(mock_openai_cls, mock_load, mock_ccm,
                                        mock_anthropic_client, mock_claude_response_json):
    """Test multiple category detection"""
    mock_openai_cls.return_value = mock_anthropic_client
    mock_ccm.assess_classification.return_value = _CCM_RETURN
    
    data = _classification_json("protocol_amendment", complexity="HIGH", urgency="HIGH",
                                secondary_categories=["informed_consent", "ethics_committee"],
                                recommended_template="TMPL-AMENDMENT")
    mock_anthropic_client.chat.completions.create.return_value = mock_claude_response_json(json.dumps(data))
    
    service = QueryClassifierService()
    result = service.classify_query("How will the protocol amendment affect ICF and EC approval?")
    
    assert result.primary_category == "protocol_amendment"
    assert len(result.secondary_categories) >= 2


@pytest.mark.unit
@patch(_CCM_PATCH)
@patch.object(QueryClassifierService, '_load_categories', return_value=[])
@patch('app.services.query_classifier.OpenAI')
def test_all_query_categories(mock_openai_cls, mock_load, mock_ccm,
                              mock_anthropic_client, mock_claude_response_json):
    """Test classification returns for multiple categories"""
    mock_openai_cls.return_value = mock_anthropic_client
    mock_ccm.assess_classification.return_value = _CCM_RETURN
    
    categories = ["sample_size", "adverse_events", "data_management",
                   "regulatory_compliance", "study_design"]
    
    for category in categories:
        data = _classification_json(category, recommended_template=f"TMPL-{category.upper()}")
        mock_anthropic_client.chat.completions.create.return_value = mock_claude_response_json(json.dumps(data))
        
        service = QueryClassifierService()
        result = service.classify_query(f"Test query for {category}")
        assert result.primary_category == category


@pytest.mark.unit
@patch(_CCM_PATCH)
@patch.object(QueryClassifierService, '_load_categories', return_value=[])
@patch('app.services.query_classifier.OpenAI')
def test_classify_empty_query(mock_openai_cls, mock_load, mock_ccm,
                              mock_anthropic_client, mock_claude_response_json):
    """Test classification of empty query"""
    mock_openai_cls.return_value = mock_anthropic_client
    mock_ccm.assess_classification.return_value = _CCM_RETURN
    
    data = _classification_json("general", complexity="LOW", urgency="LOW",
                                classification_confidence="LOW",
                                recommended_template="TMPL-GENERAL")
    mock_anthropic_client.chat.completions.create.return_value = mock_claude_response_json(json.dumps(data))
    
    service = QueryClassifierService()
    result = service.classify_query("")
    assert result.primary_category is not None


@pytest.mark.unit
@patch(_CCM_PATCH)
@patch.object(QueryClassifierService, '_load_categories', return_value=[])
@patch('app.services.query_classifier.OpenAI')
def test_classification_api_error(mock_openai_cls, mock_load, mock_ccm,
                                  mock_anthropic_client):
    """Test handling of API errors during classification"""
    mock_openai_cls.return_value = mock_anthropic_client
    mock_anthropic_client.chat.completions.create.side_effect = Exception("Classification API Error")
    
    service = QueryClassifierService()
    with pytest.raises(Exception) as exc_info:
        service.classify_query("Test query")
    assert "Classification API Error" in str(exc_info.value)
