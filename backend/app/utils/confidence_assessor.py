"""
Multi-Signal Confidence Assessor

Replaces unreliable LLM self-assessment with structural signals that don't
depend on LLM calibration. Ensures review queue actually triggers on problematic outputs.

Signals:
1. Retrieval Confidence - ChromaDB similarity scores
2. Citation Completeness - Presence of [SOURCE: NOT FOUND] tags
3. Schema Validation - Pydantic validation success
4. LLM Self-Assessment - Kept as ONE signal, not the only signal
5. Cross-Check Divergence - Optional, for critical sections
"""

import re
import json
import logging
from typing import Dict, List, Optional
from pydantic import ValidationError
from enum import Enum

logger = logging.getLogger(__name__)


class ConfidenceLevel(str, Enum):
    """Confidence levels"""
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


# ============================================================================
# SIGNAL 1: Retrieval Confidence
# ============================================================================

def assess_retrieval_confidence(retrieval_result: Dict) -> Dict:
    """
    Assess confidence based on retrieval quality
    
    Rules:
    - top-1 similarity < 0.70 → LOW confidence, auto-review
    - top-1 similarity 0.70-0.80 → MEDIUM confidence
    - top-1 similarity > 0.80 → HIGH confidence
    
    Args:
        retrieval_result: Result from retrieve_with_quality_check()
        
    Returns:
        Signal assessment with confidence level and review flag
    """
    
    max_similarity = retrieval_result.get('max_similarity', 0.0)
    
    if max_similarity < 0.70:
        return {
            "signal": "retrieval_confidence",
            "confidence_level": ConfidenceLevel.LOW,
            "should_review": True,
            "reason": f"Low retrieval similarity ({max_similarity:.3f} < 0.70)",
            "score": max_similarity,
            "weight": 1.0  # High weight - objective signal
        }
    elif max_similarity < 0.80:
        return {
            "signal": "retrieval_confidence",
            "confidence_level": ConfidenceLevel.MEDIUM,
            "should_review": False,
            "reason": f"Medium retrieval similarity ({max_similarity:.3f})",
            "score": max_similarity,
            "weight": 1.0
        }
    else:
        return {
            "signal": "retrieval_confidence",
            "confidence_level": ConfidenceLevel.HIGH,
            "should_review": False,
            "reason": f"High retrieval similarity ({max_similarity:.3f})",
            "score": max_similarity,
            "weight": 1.0
        }


# ============================================================================
# SIGNAL 2: Citation Completeness
# ============================================================================

def assess_citation_completeness(output_text: str) -> Dict:
    """
    Check for missing or invalid citations
    
    Rules:
    - Any [SOURCE: NOT FOUND] → LOW confidence, auto-review
    - Any [SOURCE: CONTEXT NOT FOUND] → LOW confidence, auto-review
    - Missing citations for regulatory claims → MEDIUM confidence
    - All citations present and valid → HIGH confidence
    
    Args:
        output_text: LLM output text to check
        
    Returns:
        Signal assessment with confidence level and review flag
    """
    
    # Check for explicit "NOT FOUND" citations
    not_found_patterns = [
        r'\[SOURCE:\s*NOT FOUND[^\]]*\]',
        r'\[SOURCE:\s*CONTEXT NOT FOUND[^\]]*\]',
        r'\[SOURCE:\s*UNKNOWN[^\]]*\]'
    ]
    
    not_found_matches = []
    for pattern in not_found_patterns:
        matches = re.findall(pattern, output_text, re.IGNORECASE)
        not_found_matches.extend(matches)
    
    if not_found_matches:
        return {
            "signal": "citation_completeness",
            "confidence_level": ConfidenceLevel.LOW,
            "should_review": True,
            "reason": f"Found {len(not_found_matches)} missing citations",
            "missing_citations": not_found_matches,
            "weight": 1.0  # High weight - objective signal
        }
    
    # Check for citation presence
    citation_pattern = r'\[SOURCE:\s*([^\]]+)\]'
    all_citations = re.findall(citation_pattern, output_text)
    
    # Count regulatory claims (sentences with "must", "shall", "required", etc.)
    claim_keywords = ['must', 'shall', 'required', 'mandatory', 'prohibited', 'should not', 'must not']
    claim_pattern = r'\b(?:' + '|'.join(claim_keywords) + r')\b'
    claims = re.findall(claim_pattern, output_text, re.IGNORECASE)
    
    # If there are regulatory claims but no citations, flag for review
    if len(claims) > 3 and len(all_citations) == 0:
        return {
            "signal": "citation_completeness",
            "confidence_level": ConfidenceLevel.MEDIUM,
            "should_review": True,
            "reason": f"Found {len(claims)} regulatory claims but no citations",
            "missing_citations": [],
            "weight": 0.8
        }
    
    return {
        "signal": "citation_completeness",
        "confidence_level": ConfidenceLevel.HIGH,
        "should_review": False,
        "reason": f"All citations present ({len(all_citations)} citations for {len(claims)} claims)",
        "missing_citations": [],
        "weight": 1.0
    }


# ============================================================================
# SIGNAL 3: Schema Validation
# ============================================================================

def assess_schema_validation(
    output_dict: Dict,
    expected_schema: type  # Pydantic model class
) -> Dict:
    """
    Validate output against Pydantic schema
    
    Rules:
    - ValidationError → LOW confidence, auto-review
    - Missing required fields → LOW confidence, auto-review
    - Placeholder values (TBD, pending, etc.) → MEDIUM confidence
    - All fields valid → HIGH confidence
    
    Args:
        output_dict: Dictionary to validate
        expected_schema: Pydantic model class
        
    Returns:
        Signal assessment with confidence level and review flag
    """
    
    try:
        # Attempt to validate
        validated = expected_schema(**output_dict)
        
        # Check for placeholder values
        placeholders = []
        placeholder_keywords = ['tbd', 'pending', 'not provided', 'unknown', 'n/a', 'to be determined']
        
        def check_placeholders(obj, path=""):
            """Recursively check for placeholder values"""
            if isinstance(obj, dict):
                for key, value in obj.items():
                    check_placeholders(value, f"{path}.{key}" if path else key)
            elif isinstance(obj, list):
                for i, item in enumerate(obj):
                    check_placeholders(item, f"{path}[{i}]")
            elif isinstance(obj, str):
                if any(p in obj.lower() for p in placeholder_keywords):
                    placeholders.append(path)
        
        check_placeholders(output_dict)
        
        if placeholders:
            return {
                "signal": "schema_validation",
                "confidence_level": ConfidenceLevel.MEDIUM,
                "should_review": True,
                "reason": f"Schema valid but contains {len(placeholders)} placeholder(s)",
                "validation_errors": [],
                "placeholders": placeholders,
                "weight": 0.9
            }
        
        return {
            "signal": "schema_validation",
            "confidence_level": ConfidenceLevel.HIGH,
            "should_review": False,
            "reason": "Schema validation passed with no placeholders",
            "validation_errors": [],
            "weight": 1.0
        }
        
    except ValidationError as e:
        errors = [f"{'.'.join(str(loc) for loc in err['loc'])}: {err['msg']}" for err in e.errors()]
        
        return {
            "signal": "schema_validation",
            "confidence_level": ConfidenceLevel.LOW,
            "should_review": True,
            "reason": f"Schema validation failed: {len(errors)} error(s)",
            "validation_errors": errors,
            "weight": 1.0  # High weight - objective signal
        }
    except Exception as e:
        logger.error(f"Error in schema validation: {e}")
        return {
            "signal": "schema_validation",
            "confidence_level": ConfidenceLevel.LOW,
            "should_review": True,
            "reason": f"Schema validation error: {str(e)}",
            "validation_errors": [str(e)],
            "weight": 1.0
        }


# ============================================================================
# SIGNAL 4: Cross-Check Divergence (Optional - Expensive)
# ============================================================================

async def assess_cross_check_divergence(
    section_text: str,
    evaluator_service,
    session_id: str
) -> Dict:
    """
    Run two M1 evaluations with different temperatures and compare
    
    Rules:
    - Divergence > 20% in findings → LOW confidence, auto-review
    - Divergence 10-20% → MEDIUM confidence
    - Divergence < 10% → HIGH confidence
    
    Args:
        section_text: Text to evaluate
        evaluator_service: M1 evaluator service instance
        session_id: Session ID for tracking
        
    Returns:
        Signal assessment with confidence level and review flag
    """
    
    try:
        # Run evaluation 1 with temp=0.0 (deterministic)
        eval1 = await evaluator_service.evaluate_section(
            section_text=section_text,
            session_id=session_id,
            temperature_override=0.0
        )
        
        # Run evaluation 2 with temp=0.2 (slightly varied)
        eval2 = await evaluator_service.evaluate_section(
            section_text=section_text,
            session_id=session_id,
            temperature_override=0.2
        )
        
        # Compare findings
        findings1 = set(f.get('finding_text', '') for f in eval1.get('findings', []))
        findings2 = set(f.get('finding_text', '') for f in eval2.get('findings', []))
        
        # Calculate divergence (Jaccard distance)
        intersection = len(findings1 & findings2)
        union = len(findings1 | findings2)
        
        if union == 0:
            divergence_score = 0.0
        else:
            similarity = intersection / union
            divergence_score = 1 - similarity
        
        divergence_pct = divergence_score * 100
        
        if divergence_pct > 20:
            return {
                "signal": "cross_check_divergence",
                "confidence_level": ConfidenceLevel.LOW,
                "should_review": True,
                "reason": f"High divergence between evaluations ({divergence_pct:.1f}%)",
                "divergence_score": divergence_score,
                "eval1_findings": len(findings1),
                "eval2_findings": len(findings2),
                "common_findings": intersection,
                "weight": 1.0
            }
        elif divergence_pct > 10:
            return {
                "signal": "cross_check_divergence",
                "confidence_level": ConfidenceLevel.MEDIUM,
                "should_review": True,
                "reason": f"Medium divergence between evaluations ({divergence_pct:.1f}%)",
                "divergence_score": divergence_score,
                "eval1_findings": len(findings1),
                "eval2_findings": len(findings2),
                "common_findings": intersection,
                "weight": 0.9
            }
        else:
            return {
                "signal": "cross_check_divergence",
                "confidence_level": ConfidenceLevel.HIGH,
                "should_review": False,
                "reason": f"Low divergence between evaluations ({divergence_pct:.1f}%)",
                "divergence_score": divergence_score,
                "eval1_findings": len(findings1),
                "eval2_findings": len(findings2),
                "common_findings": intersection,
                "weight": 1.0
            }
    
    except Exception as e:
        logger.error(f"Error in cross-check divergence: {e}")
        return {
            "signal": "cross_check_divergence",
            "confidence_level": ConfidenceLevel.MEDIUM,
            "should_review": True,
            "reason": f"Cross-check failed: {str(e)}",
            "weight": 0.5
        }


# ============================================================================
# AGGREGATION LOGIC
# ============================================================================

def calculate_aggregated_confidence(signals: List[Dict]) -> Dict:
    """
    Aggregate multiple confidence signals into final decision
    
    Rules:
    - ANY signal = LOW → Overall = LOW, auto-review
    - 2+ signals = MEDIUM → Overall = MEDIUM, review recommended
    - All signals = HIGH → Overall = HIGH, no review
    
    Args:
        signals: List of signal assessment dicts
        
    Returns:
        Aggregated confidence assessment
    """
    
    # Count confidence levels
    low_count = sum(1 for s in signals if s['confidence_level'] == ConfidenceLevel.LOW)
    medium_count = sum(1 for s in signals if s['confidence_level'] == ConfidenceLevel.MEDIUM)
    high_count = sum(1 for s in signals if s['confidence_level'] == ConfidenceLevel.HIGH)
    
    # Identify signals that triggered review
    triggered_signals = [s for s in signals if s.get('should_review', False)]
    
    # Decision logic: ANY low signal → overall LOW
    if low_count > 0:
        return {
            "overall_confidence": ConfidenceLevel.LOW,
            "should_review": True,
            "reason": f"{low_count} signal(s) flagged LOW confidence",
            "triggered_signals": triggered_signals,
            "signal_breakdown": {
                "LOW": low_count,
                "MEDIUM": medium_count,
                "HIGH": high_count,
                "total": len(signals)
            },
            "all_signals": signals
        }
    
    # 2+ medium signals → overall MEDIUM
    elif medium_count >= 2:
        return {
            "overall_confidence": ConfidenceLevel.MEDIUM,
            "should_review": True,
            "reason": f"{medium_count} signal(s) flagged MEDIUM confidence",
            "triggered_signals": triggered_signals,
            "signal_breakdown": {
                "LOW": low_count,
                "MEDIUM": medium_count,
                "HIGH": high_count,
                "total": len(signals)
            },
            "all_signals": signals
        }
    
    # 1 medium signal → overall MEDIUM, review recommended
    elif medium_count == 1:
        return {
            "overall_confidence": ConfidenceLevel.MEDIUM,
            "should_review": True,
            "reason": "1 signal flagged MEDIUM confidence",
            "triggered_signals": triggered_signals,
            "signal_breakdown": {
                "LOW": low_count,
                "MEDIUM": medium_count,
                "HIGH": high_count,
                "total": len(signals)
            },
            "all_signals": signals
        }
    
    # All HIGH → overall HIGH
    else:
        return {
            "overall_confidence": ConfidenceLevel.HIGH,
            "should_review": False,
            "reason": "All signals indicate HIGH confidence",
            "triggered_signals": [],
            "signal_breakdown": {
                "LOW": low_count,
                "MEDIUM": medium_count,
                "HIGH": high_count,
                "total": len(signals)
            },
            "all_signals": signals
        }


# ============================================================================
# MAIN CONFIDENCE ASSESSOR CLASS
# ============================================================================

class ConfidenceAssessor:
    """
    Multi-signal confidence assessment system
    
    Replaces unreliable LLM self-assessment with structural signals
    """
    
    def __init__(self, enable_cross_check: bool = False):
        """
        Initialize confidence assessor
        
        Args:
            enable_cross_check: Enable expensive cross-check signal (default False)
        """
        self.enable_cross_check = enable_cross_check
    
    def assess_m1_output(
        self,
        evaluation_result: Dict,
        retrieval_result: Dict,
        session_id: str
    ) -> Dict:
        """
        Assess M1 compliance evaluation output
        
        Args:
            evaluation_result: M1 evaluation result
            retrieval_result: RAG retrieval result
            session_id: Session ID
            
        Returns:
            Aggregated confidence assessment
        """
        
        signals = []
        
        # Signal 1: Retrieval confidence
        signals.append(assess_retrieval_confidence(retrieval_result))
        
        # Signal 2: Citation completeness
        output_text = json.dumps(evaluation_result)
        signals.append(assess_citation_completeness(output_text))
        
        # Signal 3: Schema validation
        try:
            from app.models.compliance_schemas import ComplianceEvaluation
            signals.append(assess_schema_validation(
                evaluation_result,
                ComplianceEvaluation
            ))
        except Exception as e:
            logger.warning(f"Could not validate M1 schema: {e}")
            # Add a medium confidence signal if schema validation fails
            signals.append({
                "signal": "schema_validation",
                "confidence_level": ConfidenceLevel.MEDIUM,
                "should_review": True,
                "reason": f"Schema validation unavailable: {str(e)}",
                "weight": 0.5
            })
        
        # Signal 4: LLM self-assessment (kept as ONE signal)
        llm_confidence = evaluation_result.get('confidence', 'MEDIUM')
        signals.append({
            "signal": "llm_self_assessment",
            "confidence_level": llm_confidence,
            "should_review": llm_confidence == "LOW",
            "reason": f"LLM reported {llm_confidence} confidence",
            "weight": 0.5  # Lower weight - subjective signal
        })
        
        # Aggregate
        return calculate_aggregated_confidence(signals)
    
    def assess_m2_output(
        self,
        generated_section: Dict,
        retrieval_result: Dict,
        session_id: str
    ) -> Dict:
        """
        Assess M2 document generation output
        
        Args:
            generated_section: M2 generated section
            retrieval_result: RAG retrieval result
            session_id: Session ID
            
        Returns:
            Aggregated confidence assessment
        """
        
        signals = []
        
        # Signal 1: Retrieval confidence
        signals.append(assess_retrieval_confidence(retrieval_result))
        
        # Signal 2: Citation completeness
        section_text = generated_section.get('content', '')
        signals.append(assess_citation_completeness(section_text))
        
        # Signal 3: Schema validation
        try:
            from app.models.document_schemas import DocumentSection
            signals.append(assess_schema_validation(
                generated_section,
                DocumentSection
            ))
        except Exception as e:
            logger.warning(f"Could not validate M2 schema: {e}")
            signals.append({
                "signal": "schema_validation",
                "confidence_level": ConfidenceLevel.MEDIUM,
                "should_review": True,
                "reason": f"Schema validation unavailable: {str(e)}",
                "weight": 0.5
            })
        
        # Signal 4: LLM self-assessment
        llm_confidence = generated_section.get('confidence', 'MEDIUM')
        signals.append({
            "signal": "llm_self_assessment",
            "confidence_level": llm_confidence,
            "should_review": llm_confidence == "LOW",
            "reason": f"LLM reported {llm_confidence} confidence",
            "weight": 0.5
        })
        
        # Aggregate
        return calculate_aggregated_confidence(signals)
    
    def assess_m3_output(
        self,
        query_response: Dict,
        retrieval_result: Dict,
        session_id: str
    ) -> Dict:
        """
        Assess M3 query response output
        
        Args:
            query_response: M3 query response
            retrieval_result: RAG retrieval result
            session_id: Session ID
            
        Returns:
            Aggregated confidence assessment
        """
        
        signals = []
        
        # Signal 1: Retrieval confidence
        signals.append(assess_retrieval_confidence(retrieval_result))
        
        # Signal 2: Citation completeness
        response_text = query_response.get('response_text', '')
        signals.append(assess_citation_completeness(response_text))
        
        # Signal 3: Schema validation
        try:
            from app.models.query_response_schemas import QueryResponse
            signals.append(assess_schema_validation(
                query_response,
                QueryResponse
            ))
        except Exception as e:
            logger.warning(f"Could not validate M3 schema: {e}")
            signals.append({
                "signal": "schema_validation",
                "confidence_level": ConfidenceLevel.MEDIUM,
                "should_review": True,
                "reason": f"Schema validation unavailable: {str(e)}",
                "weight": 0.5
            })
        
        # Signal 4: LLM self-assessment
        llm_confidence = query_response.get('confidence', 'MEDIUM')
        signals.append({
            "signal": "llm_self_assessment",
            "confidence_level": llm_confidence,
            "should_review": llm_confidence == "LOW",
            "reason": f"LLM reported {llm_confidence} confidence",
            "weight": 0.5
        })
        
        # Aggregate
        return calculate_aggregated_confidence(signals)


# Global confidence assessor instance
confidence_assessor = ConfidenceAssessor(enable_cross_check=False)


# Example usage
if __name__ == "__main__":
    # Test retrieval confidence
    retrieval_result = {"max_similarity": 0.65}
    signal = assess_retrieval_confidence(retrieval_result)
    print(f"Retrieval Confidence: {signal['confidence_level']} - {signal['reason']}")
    
    # Test citation completeness
    output_with_missing = "The study must comply with [SOURCE: NOT FOUND] requirements."
    signal = assess_citation_completeness(output_with_missing)
    print(f"Citation Completeness: {signal['confidence_level']} - {signal['reason']}")
