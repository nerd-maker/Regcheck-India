"""
Query Response Prompt Templates for RegCheck-India Module 03

This module contains all prompt templates for the query response pipeline:
1. System Prompt - QueryReply-India identity and rules
2. Classification Prompt - Query categorization
3. Response Generation Prompt - Structured response generation
4. Commitment Extraction Prompt - Extract sponsor commitments
"""

# =============================================================================
# 1. SYSTEM PROMPT - QUERYREPLY-INDIA
# =============================================================================

SYSTEM_PROMPT_QUERYREPLY = """You are QueryReply-India, a regulatory affairs AI specialized in drafting responses
to queries and deficiency letters from CDSCO, Indian Ethics Committees, and CTRI.

YOUR CONTEXT:
You are assisting a qualified Regulatory Affairs professional draft a response to
a regulatory query. The human expert will review, verify, and sign off on your
draft before it is submitted. You are not submitting the response — you are
drafting it for expert review.

YOUR ABSOLUTE RULES:

1. ACKNOWLEDGE THEN RESOLVE: Every response must first explicitly acknowledge
   the regulatory concern raised, then provide the resolution. Never dispute
   the legitimacy of a CDSCO query — even if you believe it is based on a
   misunderstanding. A defensive tone in regulatory responses causes rejections.

2. REGULATORY JUSTIFICATION REQUIRED: Every substantive claim in the response
   must cite either: (a) a specific regulatory guideline, (b) the original
   submission document with page/section reference, or (c) scientific literature.
   Format: [Ref: NDCTR 2019, Rule 33] or [Ref: Protocol v2.0, Section 5.3]

3. DATA ACCURACY: Only reference data and documents that were provided to you.
   Never fabricate study results, reference numbers, or document versions.

4. TONE CALIBRATION: Formal, respectful, non-argumentative. CDSCO reviewers
   respond better to concise, evidence-backed responses than to lengthy
   justifications. Aim for clarity over volume.

5. COMMITMENT TRACKING: If the response commits the sponsor to any action
   (e.g., protocol amendment, additional data provision, timeline), flag it with
   [COMMITMENT: {description} — confirm with sponsor before submission]

6. INCOMPLETE RESOLUTION FLAG: If you cannot fully resolve the query from the
   provided information, end that response point with:
   [ADDITIONAL INFORMATION NEEDED FROM SPONSOR: {specific_request}]
"""

# =============================================================================
# 2. QUERY CLASSIFICATION PROMPT
# =============================================================================

CLASSIFICATION_PROMPT = """Classify the following CDSCO/Ethics Committee query into ONE primary category
and up to TWO secondary categories from the list below.

QUERY TEXT:
"{query_text}"

CLASSIFICATION CATEGORIES:
{category_list}

Also assess:
  - Complexity: SIMPLE | MODERATE | COMPLEX
    SIMPLE: Single straightforward issue (e.g., missing document)
    MODERATE: Multiple related issues or requires analysis (e.g., protocol clarification)
    COMPLEX: Multiple unrelated issues or requires significant justification
  
  - Urgency (based on regulatory deadline if inferable): HIGH | MEDIUM | LOW
    HIGH: Deadline within 7 days or trial on hold
    MEDIUM: Deadline within 30 days
    LOW: No immediate deadline or routine query
  
  - Data gap: Can this be answered from provided documents alone?
    YES: All information available
    PARTIAL: Some information available, some missing
    NO: Critical information not provided

OUTPUT: JSON only.
{{
  "primary_category": "CAT-XX",
  "secondary_categories": ["CAT-XX", "CAT-XX"],
  "complexity": "SIMPLE | MODERATE | COMPLEX",
  "urgency": "HIGH | MEDIUM | LOW",
  "data_gap": "YES | PARTIAL | NO",
  "data_gap_detail": "What specific information is missing if PARTIAL or NO",
  "recommended_template": "Template ID from category",
  "classification_confidence": "HIGH | MEDIUM | LOW",
  "reasoning": "Brief explanation of classification"
}}
"""

# =============================================================================
# 3. RESPONSE GENERATION PROMPT
# =============================================================================

RESPONSE_GENERATION_PROMPT = """=== REGULATORY CONTEXT ===
{regulatory_context}

=== ORIGINAL SUBMISSION CONTEXT ===
Submission Type: {submission_type}
Original Submission Date: {submission_date}
Query Reference Number: {query_reference}
Query Receipt Date: {query_date} | Response Deadline: {response_deadline}

Relevant Original Document Sections:
{submission_sections}

=== QUERY TEXT ===
"{query_text}"

=== PRIOR SPONSOR RESPONSE (if this is a re-query) ===
{prior_response}

=== AVAILABLE SUPPORTING DOCUMENTS ===
{available_documents}

=== RESPONSE TEMPLATE GUIDANCE ===
{template_guidance}

NOW GENERATE THE QUERY RESPONSE:

Structure your response using this exact format:

RESPONSE TO QUERY {query_reference} — {query_category}

Point 1: QUERY UNDERSTANDING
[Restate the query in one sentence to confirm understanding]

Point 2: REGULATORY POSITION
[Cite the applicable regulation and confirm sponsor compliance or state the
corrective action taken. Cite: [Ref: {{source}}]]

Point 3: SPECIFIC RESPONSE TO QUERY
[Address the exact concern raised. Be specific. Reference the original document
with section/page numbers. If data is being provided, describe it precisely.]

Point 4: SUPPORTING EVIDENCE
[List supporting documents with document name, version, and relevant page/table.
Only list documents that were actually provided to you.]

Point 5: CONCLUSION
[One to three sentences confirming how this response resolves the query and
whether any follow-up action has been committed to by the sponsor.]

---
Then append the review metadata in JSON format:
{{
  "commitments_made": ["list of any sponsor commitments in this response"],
  "additional_info_needed": ["any gaps that require sponsor clarification"],
  "confidence": "HIGH | MEDIUM | LOW",
  "reviewer_flags": ["anything the human reviewer must specifically check"],
  "supporting_documents_referenced": ["list of documents cited"]
}}
"""

# =============================================================================
# 4. COMMITMENT EXTRACTION PROMPT
# =============================================================================

COMMITMENT_EXTRACTION_PROMPT = """Extract all sponsor commitments from the following query response.

A commitment is any action the sponsor has agreed to take, such as:
- Protocol amendment
- ICF revision
- Additional data submission
- Timeline extension request
- Site documentation update
- Safety report submission

RESPONSE TEXT:
"{response_text}"

For each commitment, extract:
- Type of commitment (Protocol Amendment, Data Submission, etc.)
- Description of what will be done
- Timeline if mentioned
- Responsible party if mentioned

OUTPUT: JSON only.
{{
  "commitments": [
    {{
      "type": "commitment type",
      "description": "what will be done",
      "timeline": "when it will be done or null",
      "responsible_party": "who will do it or null",
      "priority": "HIGH | MEDIUM | LOW"
    }}
  ],
  "total_commitments": <number>
}}
"""

# =============================================================================
# 5. CATEGORY-SPECIFIC RESPONSE TEMPLATES
# =============================================================================

RESPONSE_TEMPLATES = {
    "TMPL-PROTOCOL-DESIGN": {
        "acknowledgment_template": "We acknowledge the concern regarding {specific_concern} in the protocol design.",
        "regulatory_position_template": "Per {regulatory_ref}, the protocol design must clearly define {requirement}. [Ref: {citation}]",
        "response_structure": [
            "Restate the specific protocol design concern",
            "Cite ICH E9 or ICH E6(R3) Section 6 as applicable",
            "Reference Protocol section and page number",
            "Provide specific justification or corrective action",
            "List supporting documents (SAP, sample size calculation)"
        ],
        "common_commitments": [
            "Protocol amendment to clarify endpoint definition",
            "Revised statistical analysis plan submission",
            "Updated sample size calculation"
        ]
    },
    
    "TMPL-ICF": {
        "acknowledgment_template": "We acknowledge the concern regarding {specific_concern} in the Informed Consent Form.",
        "regulatory_position_template": "Per NDCTR 2019 Rule 18 and ICH E6(R3) Section 4.8, the ICF must {requirement}. [Ref: {citation}]",
        "response_structure": [
            "Restate the ICF concern",
            "Cite NDCTR 2019 Rule 18 or ICH E6(R3) Section 4.8",
            "Reference ICF version and section",
            "Provide revised ICF text or explanation",
            "Confirm regional language versions if applicable"
        ],
        "common_commitments": [
            "Revised ICF submission",
            "Re-consent of enrolled subjects",
            "Regional language ICF translation"
        ]
    },
    
    "TMPL-SAFETY-MONITORING": {
        "acknowledgment_template": "We acknowledge the concern regarding {specific_concern} in the safety monitoring plan.",
        "regulatory_position_template": "Per NDCTR 2019 Rule 16, SAE reporting must occur within {timeline}. [Ref: NDCTR 2019, Rule 16]",
        "response_structure": [
            "Restate the safety monitoring concern",
            "Cite NDCTR 2019 Rule 16 or ICH E6(R3) Section 5.17",
            "Reference Protocol safety section",
            "Describe safety monitoring procedures",
            "Confirm DSMB charter if applicable"
        ],
        "common_commitments": [
            "DSMB charter submission",
            "Updated safety monitoring plan",
            "Revised SAE reporting procedures"
        ]
    }
}

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def format_category_list(categories):
    """Format category list for classification prompt"""
    formatted = []
    for cat in categories:
        formatted.append(
            f"  {cat['id']}: {cat['name']} — {cat['description']}"
        )
    return "\n".join(formatted)


def get_template_guidance(template_id):
    """Get template guidance for response generation"""
    template = RESPONSE_TEMPLATES.get(template_id, {})
    if not template:
        return "No specific template guidance available. Follow general response structure."
    
    guidance = f"""
Template: {template_id}

Acknowledgment: {template.get('acknowledgment_template', 'N/A')}
Regulatory Position: {template.get('regulatory_position_template', 'N/A')}

Response Structure:
{chr(10).join(f"- {item}" for item in template.get('response_structure', []))}

Common Commitments for this category:
{chr(10).join(f"- {item}" for item in template.get('common_commitments', []))}
"""
    return guidance
