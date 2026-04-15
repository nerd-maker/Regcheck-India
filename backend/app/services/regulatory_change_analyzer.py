"""
Regulatory Change Analyzer Service

Analyzes new CDSCO/MOHFW documents and extracts structured regulatory changes.
"""

import json
import logging
import os
from datetime import datetime
from typing import List, Dict, Any


from app.core.config import settings
from app.models.regulatory_change_schemas import (
    RegulatoryChange,
    ChangeClassification,
    NewDocumentRequest
)
from app.prompts.regulatory_intelligence_prompts import (
    SYSTEM_PROMPT,
    INGESTION_PROMPT
)
from app.services.claude_client import call_claude, MODEL_SONNET

logger = logging.getLogger(__name__)


class RegulatoryChangeAnalyzer:
    """
    Analyzes new regulatory documents and extracts structured changes.
    
    Uses Claude API to:
    1. Classify regulatory domains
    2. Extract structured changes
    3. Assess urgency
    4. Generate plain language summaries
    """
    
    def __init__(self):
        """Initialize the analyzer with Claude API client"""
    
    
    def ingest_new_document(
        self,
        document_request: NewDocumentRequest,
        kb_summary: str = ""
    ) -> tuple[ChangeClassification, List[RegulatoryChange]]:
        """
        Ingest and analyze a new regulatory document.
        
        Args:
            document_request: New document details
            kb_summary: Current knowledge base summary for comparison
        
        Returns:
            Tuple of (classification, list of changes)
        """
        input_text = document_request.full_text

        # Format the ingestion prompt
        prompt = INGESTION_PROMPT.format(
            source_url=document_request.source_url,
            document_title=document_request.document_title,
            publication_date=document_request.publication_date,
            document_type=document_request.document_type,
            full_text=input_text,
            kb_summary=kb_summary or "No existing requirements found for comparison."
        )

        result = call_claude(
            prompt=prompt,
            system_prompt=SYSTEM_PROMPT,
            model=MODEL_SONNET,
            max_tokens=3000,
            temperature=0.0,
        )
        response_text = result["content"]
        
        # Extract JSON from response (handle markdown code blocks)
        if "```json" in response_text:
            json_start = response_text.find("```json") + 7
            json_end = response_text.find("```", json_start)
            json_text = response_text[json_start:json_end].strip()
        elif "```" in response_text:
            json_start = response_text.find("```") + 3
            json_end = response_text.find("```", json_start)
            json_text = response_text[json_start:json_end].strip()
        else:
            json_text = response_text.strip()
        
        # Parse JSON response
        try:
            parsed = json.loads(json_text)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse Claude response as JSON: {e}\nResponse: {response_text}")
        
        # Handle both single object and array responses
        if isinstance(parsed, dict):
            # Single change or classification object
            if "primary_domain" in parsed:
                # Classification object
                classification = ChangeClassification(**parsed)
                changes = []
            else:
                # Single change object
                classification = self._extract_classification_from_change(parsed)
                changes = [self._create_change_object(parsed, document_request)]
        elif isinstance(parsed, list):
            # Array of changes
            if len(parsed) > 0:
                classification = self._extract_classification_from_change(parsed[0])
                changes = [self._create_change_object(c, document_request) for c in parsed]
            else:
                classification = ChangeClassification(
                    primary_domain="Unknown",
                    classification_confidence="LOW",
                    classification_rationale="No changes detected"
                )
                changes = []
        else:
            raise ValueError(f"Unexpected response format: {type(parsed)}")
        
        return classification, changes
    
    
    def _extract_classification_from_change(self, change_dict: dict) -> ChangeClassification:
        """Extract classification from a change object"""
        domain = change_dict.get("domain", "Unknown")
        
        return ChangeClassification(
            primary_domain=domain,
            secondary_domains=[],
            classification_confidence="MEDIUM",
            classification_rationale=f"Inferred from change domain: {domain}"
        )
    
    
    def _create_change_object(
        self,
        change_dict: dict,
        document_request: NewDocumentRequest
    ) -> RegulatoryChange:
        """Create RegulatoryChange object from parsed JSON"""
        
        # Generate change ID if not provided
        if "change_id" not in change_dict or not change_dict["change_id"]:
            date_str = document_request.publication_date.replace("-", "")
            change_dict["change_id"] = f"CHG-{date_str}-001"
        
        # Add source URL
        change_dict["source_url"] = document_request.source_url
        
        # Ensure source citation includes document title
        if "source_citation" not in change_dict:
            change_dict["source_citation"] = (
                f"{document_request.document_title}, "
                f"{document_request.publication_date}"
            )
        
        return RegulatoryChange(**change_dict)
    
    
    def classify_domains(self, document_text: str) -> ChangeClassification:
        """
        Classify regulatory domains affected by a document.
        
        Args:
            document_text: Full text of the document
        
        Returns:
            ChangeClassification object
        """
        # This is a simplified version - in production, you'd use a more sophisticated prompt
        prompt = f"""Classify the regulatory domains affected by this document.

Document Text:
{document_text[:2000]}...

Return a JSON object with domain classifications."""
        
        result = call_claude(
            prompt=prompt,
            system_prompt=SYSTEM_PROMPT,
            model=MODEL_SONNET,
            max_tokens=2000,
            temperature=0.0,
        )
        
        response_text = result["content"]
        
        # Parse JSON
        if "```json" in response_text:
            json_start = response_text.find("```json") + 7
            json_end = response_text.find("```", json_start)
            json_text = response_text[json_start:json_end].strip()
        else:
            json_text = response_text.strip()
        
        parsed = json.loads(json_text)
        return ChangeClassification(**parsed)
    
    
    def assess_urgency(self, change: RegulatoryChange) -> str:
        """
        Assess urgency of a regulatory change.
        
        Args:
            change: RegulatoryChange object
        
        Returns:
            Urgency level (CRITICAL, HIGH, MEDIUM, LOW)
        """
        # Urgency is already assessed during ingestion
        return change.urgency
    
    
    def generate_summary(self, changes: List[RegulatoryChange]) -> str:
        """
        Generate plain language summary of multiple changes.
        
        Args:
            changes: List of RegulatoryChange objects
        
        Returns:
            Plain language summary
        """
        if not changes:
            return "No regulatory changes detected."
        
        summaries = [c.plain_language_summary for c in changes]
        return "\n\n".join(summaries)
