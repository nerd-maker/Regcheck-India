"""
Query Classifier Service

Classifies regulatory queries into categories for targeted response generation
"""
import json
import os
from pathlib import Path
from typing import Dict, List, Optional
from openai import OpenAI
import logging
import hashlib

from app.core.config import settings
from app.prompts.query_response_prompts import (
    CLASSIFICATION_PROMPT,
    format_category_list
)
from app.models.query_schemas import QueryClassification

# Production safety imports
from app.config.llm_config import LLMConfig
from app.services.session_manager import session_manager
from app.services.review_queue import review_queue, assess_confidence

# Gap service integrations
from app.services.classification_confidence import classification_confidence_manager  # Gap 11
from app.services.aikosh_client import orchestrator, run_async

logger = logging.getLogger(__name__)


class QueryClassifier:
    """
    Classifies regulatory queries into predefined categories
    """
    
    def __init__(self, categories_file: str = "app/data/query_categories.json"):
        self.categories_file = Path(categories_file)
        self.categories = self._load_categories()
        self.client = OpenAI(
            api_key=settings.llm_api_key or "placeholder",
            base_url=settings.llm_base_url
        )
    
    def _load_categories(self) -> List[Dict]:
        """Load query categories from JSON file"""
        if not self.categories_file.exists():
            raise FileNotFoundError(f"Categories file not found: {self.categories_file}")
        
        with open(self.categories_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get('categories', [])
    
    def classify_query(
        self,
        query_text: str,
        query_reference: str = None,
        response_deadline: str = None,
        session_id: Optional[str] = None
    ) -> QueryClassification:
        """
        Classify a regulatory query
        
        Production Safety:
        - Uses LLM config for temperature (0.2) and tokens (2500)
        - Logs to session audit trail
        - Checks confidence threshold
        
        Args:
            query_text: Full text of the query
            query_reference: Query reference number
            response_deadline: Response deadline date
            session_id: Optional session ID for audit trail
        
        Returns:
            QueryClassification with category, complexity, urgency, data gaps
        """
        
        # Build classification prompt
        category_list = format_category_list(self.categories)
        
        prompt = CLASSIFICATION_PROMPT.format(
            query_text=query_text,
            category_list=category_list
        )
        
        # Rule 5: Use configured temperature
        # Rule 6: Use configured token budget
        temperature = LLMConfig.get_temperature("M3_QUERY")
        max_tokens = LLMConfig.get_max_tokens("M3_QUERY_RESPONSE")
        
        use_ensemble = bool(settings.__dict__.get("sarvam_api_key", os.getenv("SARVAM_API_KEY")))
        if use_ensemble:
            response = run_async(
                orchestrator.call(
                    group_name="query_intelligence",
                    role="classifier",
                    prompt=prompt,
                    temperature=0.0,
                    max_tokens=500,
                )
            )
            response_text = response.get("content", "")
            model_used = response.get("model_used", "nvidia-fallback")
            usage_tokens = response.get("usage", {}).get("completion_tokens", 0)
        else:
            raw = self.client.chat.completions.create(
                model=LLMConfig.LLM_MODEL,
                temperature=temperature,
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )
            response_text = raw.choices[0].message.content
            model_used = "nvidia-fallback"
            usage_tokens = getattr(raw.usage, "output_tokens", getattr(raw.usage, "completion_tokens", 0))
        
        # Parse response
        try:
            result = json.loads(response_text)
            
            # Enhance with urgency assessment if deadline provided
            if response_deadline and result.get('urgency') == 'MEDIUM':
                result['urgency'] = self._assess_urgency_from_deadline(response_deadline)
            
            classification = QueryClassification(**result)
            
            # Gap 11: Classification confidence assessment
            # Enforces 0.75 threshold, high-stakes mandatory confirmation,
            # and presents top-2 candidates for low-confidence classifications
            confidence_map = {"HIGH": 0.9, "MEDIUM": 0.75, "LOW": 0.5}
            confidence_score = confidence_map.get(result.get('classification_confidence', 'MEDIUM'), 0.75)
            
            routing = classification_confidence_manager.assess_classification(
                category_id=result.get('primary_category', ''),
                confidence_score=confidence_score,
                secondary_categories=result.get('secondary_categories', [])
            )
            
            # Attach routing decision to classification
            classification.classification_routing = routing.get("action", "AUTO_PROCEED")
            classification.requires_confirmation = routing.get("requires_confirmation", False)
            
            # Rule 2: Log to audit trail
            if session_id:
                session_manager.log_operation(
                    session_id=session_id,
                    module="M3",
                    operation="classify_query",
                    input_hash=hashlib.sha256(prompt.encode()).hexdigest()[:16],
                    output_hash=hashlib.sha256(response_text.encode()).hexdigest()[:16],
                    confidence_score=confidence_score,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    actual_tokens=usage_tokens,
                    metadata={
                        "primary_category": result.get('primary_category'),
                        "complexity": result.get('complexity'),
                        "urgency": result.get('urgency'),
                        "classification_routing": routing.get("action"),
                        "is_high_stakes": routing.get("is_high_stakes", False),
                        "model_attribution": {
                            "primary_model": model_used,
                            "provider": "AIKosh India Sovereign AI Stack",
                            "sovereign": model_used.startswith(("sarvam", "bharatgen")),
                        },
                    }
                )
            
            return classification
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse failed in query classification: {e}")
            # Fallback classification
            return QueryClassification(
                primary_category="CAT-09",  # Default to Regulatory Compliance
                secondary_categories=[],
                complexity="MODERATE",
                urgency="MEDIUM",
                data_gap="PARTIAL",
                data_gap_detail="Unable to parse classification response",
                recommended_template="TMPL-REGULATORY-COMPLIANCE",
                classification_confidence="LOW",
                reasoning="Fallback classification due to parsing error"
            )
    
    def _assess_urgency_from_deadline(self, deadline: str) -> str:
        """Assess urgency based on response deadline"""
        from datetime import datetime, timedelta
        
        try:
            deadline_date = datetime.strptime(deadline, "%Y-%m-%d")
            today = datetime.now()
            days_remaining = (deadline_date - today).days
            
            if days_remaining <= 7:
                return "HIGH"
            elif days_remaining <= 30:
                return "MEDIUM"
            else:
                return "LOW"
        except:
            return "MEDIUM"
    
    def get_category_info(self, category_id: str) -> Dict:
        """Get detailed information about a category"""
        for category in self.categories:
            if category['id'] == category_id:
                return category
        return {}
    
    def get_all_categories(self) -> List[Dict]:
        """Get all available categories"""
        return self.categories
    
    def search_categories_by_keywords(self, keywords: List[str]) -> List[Dict]:
        """Search categories by keywords"""
        matching_categories = []
        
        for category in self.categories:
            category_keywords = category.get('keywords', [])
            if any(kw.lower() in [ck.lower() for ck in category_keywords] for kw in keywords):
                matching_categories.append(category)
        
        return matching_categories
