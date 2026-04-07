"""
Query Response Generator Service

Generates structured responses to regulatory queries with commitment tracking
"""
import json
import os
from typing import Dict, List, Optional
from openai import OpenAI
import logging
import hashlib

from app.core.config import settings
from app.services.knowledge_base import knowledge_base
from app.services.query_classifier import QueryClassifier
from app.prompts.query_response_prompts import (
    SYSTEM_PROMPT_QUERYREPLY,
    RESPONSE_GENERATION_PROMPT,
    COMMITMENT_EXTRACTION_PROMPT,
    get_template_guidance
)
from app.models.query_schemas import (
    QueryInput,
    QueryClassification,
    QueryResponse,
    Commitment
)

# Production safety imports
from app.config.llm_config import LLMConfig
from app.services.session_manager import session_manager

# Gap service integrations
from app.services.commitment_tracker import commitment_manager         # Gap 16
from app.services.prompt_version_manager import prompt_version_manager # Gap 8
from app.services.aikosh_client import orchestrator, run_async

logger = logging.getLogger(__name__)


class QueryResponseGenerator:
    """
    Generates structured responses to regulatory queries
    """
    
    def __init__(self):
        self.client = OpenAI(
            api_key=settings.llm_api_key or "placeholder",
            base_url=settings.llm_base_url
        )
        self.classifier = QueryClassifier()
    
    def generate_response(
        self,
        query: QueryInput,
        classification: Optional[QueryClassification] = None,
        session_id: Optional[str] = None
    ) -> QueryResponse:
        """
        Generate response to a regulatory query
        
        Args:
            query: Query input with text and metadata
            classification: Pre-classified query (optional, will auto-classify if None)
        
        Returns:
            QueryResponse with structured response and metadata
        """
        
        # 1. Classify query if not provided
        if classification is None:
            classification = self.classifier.classify_query(
                query_text=query.query_text,
                query_reference=query.query_reference,
                response_deadline=query.response_deadline
            )
        
        # 2. Retrieve regulatory context from knowledge base
        regulatory_context = self._retrieve_regulatory_context(
            query_text=query.query_text,
            category=classification.primary_category
        )
        
        # 3. Extract relevant sections from submission documents
        submission_sections = self._extract_submission_sections(
            query=query,
            classification=classification
        )
        
        # 4. Get template guidance
        template_guidance = get_template_guidance(classification.recommended_template)
        
        # 5. Build context and generate response
        context = self._build_response_context(
            query=query,
            classification=classification,
            regulatory_context=regulatory_context,
            submission_sections=submission_sections,
            template_guidance=template_guidance
        )
        
        # 6. Generate response via Claude
        response_text = self._generate_with_claude(context, query.query_reference, classification, session_id)
        
        # 7. Extract metadata
        metadata = self._extract_metadata(response_text)
        
        # 8. Extract commitments
        commitments = self._extract_commitments(response_text)
        
        # 9. Gap 16: Store commitments in lifecycle tracker
        if commitments and session_id:
            for c in commitments:
                commitment_manager.store_commitment(
                    session_id=session_id,
                    query_reference=query.query_reference or "",
                    commitment_text=c.commitment_text if hasattr(c, 'commitment_text') else str(c),
                    deadline=c.deadline if hasattr(c, 'deadline') else None,
                    owner=c.owner if hasattr(c, 'owner') else "RA Team"
                )
        
        return QueryResponse(
            response_text=response_text,
            commitments_made=commitments,
            additional_info_needed=metadata.get('additional_info_needed', []),
            confidence=metadata.get('confidence', 'MEDIUM'),
            reviewer_flags=metadata.get('reviewer_flags', []),
            supporting_documents_referenced=metadata.get('supporting_documents_referenced', [])
        )

    def classify_and_respond(self, query: QueryInput) -> dict:
        classification = run_async(
            orchestrator.call(
                group_name="query_intelligence",
                role="classifier",
                prompt=f"Classify this CDSCO query into one of 16 categories: {query.query_text}",
                temperature=0.0,
                max_tokens=500,
            )
        )
        response_draft = run_async(
            orchestrator.call(
                group_name="query_intelligence",
                role="responder",
                system_prompt="You are a regulatory affairs expert drafting CDSCO query responses.",
                prompt=f"Query Category: {classification.get('content', '')}\nQuery Text: {query.query_text}",
                temperature=0.2,
                max_tokens=3000,
            )
        )
        out = {
            "classification": classification.get("content", ""),
            "response": response_draft.get("content", ""),
            "models_used": [classification.get("model_used"), response_draft.get("model_used")],
        }
        ctext = classification.get("content", "").lower()
        if "pharmacovigilance" in ctext or "cat-07" in ctext:
            validation = run_async(
                orchestrator.call(
                    group_name="query_intelligence",
                    role="validator",
                    prompt=f"Validate this pharmacovigilance response for ICH E2A compliance: {response_draft.get('content', '')}",
                    temperature=0.0,
                    max_tokens=1000,
                )
            )
            out["validation"] = validation.get("content", "")
            out["models_used"].append(validation.get("model_used"))
        return out
    
    def _retrieve_regulatory_context(self, query_text: str, category: str) -> str:
        """Retrieve relevant regulatory chunks from knowledge base"""
        
        # Get category info for better filtering
        category_info = self.classifier.get_category_info(category)
        
        # Query knowledge base
        results = knowledge_base.query(
            query_text=query_text,
            n_results=5
        )
        
        if not results or not results.get('documents'):
            return "No specific regulatory context retrieved. Use general regulatory knowledge."
        
        # Format regulatory context
        context_parts = []
        for i, (doc, metadata) in enumerate(zip(results['documents'][0], results['metadatas'][0])):
            source = metadata.get('source', 'Unknown')
            context_parts.append(f"[Regulatory Reference {i+1}]\nSource: {source}\nContent: {doc}\n")
        
        return "\n".join(context_parts)
    
    def _extract_submission_sections(
        self,
        query: QueryInput,
        classification: QueryClassification
    ) -> str:
        """Extract relevant sections from original submission documents"""
        
        if not query.submission_documents:
            return "[No submission documents provided]"
        
        # Format available documents
        doc_list = []
        for doc in query.submission_documents:
            doc_info = f"- {doc.get('name', 'Unknown')} (Version {doc.get('version', 'N/A')}, Date: {doc.get('date', 'N/A')})"
            if 'content' in doc:
                doc_info += f"\n  Relevant excerpt: {doc['content'][:500]}..."
            doc_list.append(doc_info)
        
        return "\n".join(doc_list)
    
    def _build_response_context(
        self,
        query: QueryInput,
        classification: QueryClassification,
        regulatory_context: str,
        submission_sections: str,
        template_guidance: str
    ) -> str:
        """Build complete context for response generation"""
        
        category_info = self.classifier.get_category_info(classification.primary_category)
        
        context = RESPONSE_GENERATION_PROMPT.format(
            regulatory_context=regulatory_context,
            submission_type=query.submission_type,
            submission_date=query.submission_date,
            query_reference=query.query_reference,
            query_date=query.query_date,
            response_deadline=query.response_deadline or "Not specified",
            submission_sections=submission_sections,
            query_text=query.query_text,
            prior_response=query.prior_response or "NONE — first response",
            available_documents="\n".join([
                f"- {doc.get('name', 'Unknown')} v{doc.get('version', 'N/A')}"
                for doc in query.submission_documents
            ]),
            template_guidance=template_guidance,
            query_category=category_info.get('name', classification.primary_category)
        )
        
        return context
    
    def _generate_with_claude(
        self,
        context: str,
        query_reference: str,
        classification: QueryClassification,
        session_id: Optional[str] = None
    ) -> str:
        """
        Generate response using Claude API
        
        Production Safety:
        - Uses LLM config for temperature (0.2) and tokens (2500)
        - Logs to session audit trail
        """
        
        # Rule 5: Use configured temperature
        # Rule 6: Use configured token budget
        temperature = LLMConfig.get_temperature("M3_QUERY")
        max_tokens = LLMConfig.get_max_tokens("M3_QUERY_RESPONSE")
        
        use_ensemble = bool(os.getenv("SARVAM_API_KEY"))
        if use_ensemble:
            response = run_async(
                orchestrator.call(
                    group_name="query_intelligence",
                    role="responder",
                    system_prompt=SYSTEM_PROMPT_QUERYREPLY,
                    prompt=context,
                    temperature=temperature,
                    max_tokens=max_tokens,
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
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT_QUERYREPLY},
                    {"role": "user", "content": context}
                ]
            )
            response_text = raw.choices[0].message.content
            model_used = "nvidia-fallback"
            usage_tokens = raw.usage.completion_tokens if raw.usage else 0
        
        # Rule 2: Log to audit trail
        if session_id:
            session_manager.log_operation(
                session_id=session_id,
                module="M3",
                operation="generate_response",
                input_hash=hashlib.sha256(context.encode()).hexdigest()[:16],
                output_hash=hashlib.sha256(response_text.encode()).hexdigest()[:16],
                temperature=temperature,
                max_tokens=max_tokens,
                actual_tokens=usage_tokens,
                metadata={
                    "query_reference": query_reference,
                    "classification": classification.primary_category,
                    "model_attribution": {
                        "primary_model": model_used,
                        "provider": "AIKosh India Sovereign AI Stack",
                        "sovereign": model_used.startswith(("sarvam", "bharatgen")),
                    },
                }
            )
        
        return response_text
    
    def _extract_metadata(self, response_text: str) -> Dict:
        """Extract metadata JSON from response"""
        
        # Try to find JSON block at end of response
        try:
            # Look for JSON between curly braces
            start = response_text.rfind('{')
            end = response_text.rfind('}') + 1
            
            if start != -1 and end > start:
                json_str = response_text[start:end]
                metadata = json.loads(json_str)
                return metadata
        except:
            pass
        
        # Fallback metadata
        return {
            "commitments_made": [],
            "additional_info_needed": [],
            "confidence": "MEDIUM",
            "reviewer_flags": ["Metadata extraction failed - manual review required"],
            "supporting_documents_referenced": []
        }
    
    def _extract_commitments(self, response_text: str) -> List[str]:
        """Extract commitments from response text"""
        
        # Use Claude to extract commitments
        prompt = COMMITMENT_EXTRACTION_PROMPT.format(response_text=response_text)
        
        try:
            response = self.client.chat.completions.create(
                model=settings.llm_model,
                max_tokens=1024,
                temperature=0.3,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            result = json.loads(response.choices[0].message.content)
            commitments = result.get('commitments', [])
            
            # Convert to simple list of descriptions
            return [c.get('description', str(c)) for c in commitments]
            
        except:
            # Fallback: search for [COMMITMENT: ...] tags
            commitments = []
            lines = response_text.split('\n')
            for line in lines:
                if '[COMMITMENT:' in line:
                    # Extract commitment text
                    start = line.find('[COMMITMENT:') + 12
                    end = line.find(']', start)
                    if end > start:
                        commitments.append(line[start:end].strip())
            
            return commitments
