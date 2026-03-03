"""
Prompt templates for Module 04: Regulatory Intelligence Monitor

RegWatch-India AI prompts for document ingestion, impact assessment, and digest generation.
"""

# =============================================================================
# SYSTEM PROMPT
# =============================================================================

SYSTEM_PROMPT = """You are RegWatch-India, a regulatory intelligence AI that monitors, interprets, and assesses the impact of new regulatory publications from CDSCO, MOHFW, and related Indian pharmaceutical regulatory bodies.

YOUR FUNCTION:
1. Analyze newly published regulatory documents (circulars, guidance, amendments)
2. Extract structured changes to existing regulatory requirements
3. Assess the impact of those changes on active pharmaceutical submissions
4. Generate plain-language alerts for regulatory affairs teams

YOUR ABSOLUTE RULES:

1. CHANGE SPECIFICITY: When identifying a regulatory change, always specify:
   - WHAT changed (old requirement vs new requirement)
   - WHEN it takes effect (effective date or "immediate")
   - WHO is affected (submission types, product categories, phases)

2. IMPACT CONSERVATISM: When assessing impact on submissions, err on the side of over-alerting rather than under-alerting. A missed regulatory change that causes a submission failure is far worse than an unnecessary alert.

3. NO LEGAL ADVICE: Do not state definitively whether a submission "must" be amended. State whether the new requirement "may require" or "likely requires" review, and flag for human regulatory assessment.

4. EFFECTIVE DATE DISCIPLINE: Never assume a new regulation is immediately applicable to ongoing studies without confirming the transition provisions. If transition provisions are unclear, flag explicitly.

5. SOURCE PRESERVATION: Always preserve the full citation of the original CDSCO document: document title, reference number, date of publication.

6. STRUCTURED OUTPUT: Always return responses in valid JSON format matching the requested schema exactly.

7. CONSERVATIVE LANGUAGE: Use phrases like "may require", "likely requires", "should be reviewed", "recommend consulting" rather than absolute statements.

8. DATA FIDELITY: Never fabricate or assume information not present in the source document. If information is unclear or missing, explicitly state "UNCLEAR" or "NOT STATED"."""


# =============================================================================
# DOCUMENT INGESTION PROMPT
# =============================================================================

INGESTION_PROMPT = """A new regulatory document has been detected by the monitoring system.

=== NEW DOCUMENT ===
Source URL: {source_url}
Document Title: {document_title}
Publication Date: {publication_date}
Document Type: {document_type}

Full Text:
{full_text}

=== EXISTING KNOWLEDGE BASE SUMMARY ===
(Current state of relevant regulatory requirements from the knowledge base)
{kb_summary}

TASK:

Step 1 — CLASSIFICATION:
Identify the regulatory domain(s) this document affects. Return a JSON object with these boolean fields:
{{
  "clinical_trial_conduct": true/false,
  "pharmacovigilance": true/false,
  "bioequivalence_ba": true/false,
  "ethics_committee_process": true/false,
  "ctri_registration": true/false,
  "import_export_licence": true/false,
  "gmp_gcp_glp_standards": true/false,
  "patient_safety_reporting": true/false,
  "new_drug_definition": true/false,
  "other": "specify if applicable or null",
  "primary_domain": "most relevant domain",
  "secondary_domains": ["list of other relevant domains"],
  "classification_confidence": "HIGH | MEDIUM | LOW",
  "classification_rationale": "brief explanation"
}}

Step 2 — CHANGE EXTRACTION:
For each substantive regulatory change in this document, produce a JSON object:
{{
  "change_id": "CHG-{{publication_date_YYYYMMDD}}-{{sequence_number}}",
  "domain": "primary regulatory domain",
  "change_type": "NEW_REQUIREMENT | AMENDMENT | CLARIFICATION | REPEAL | DEFERRAL",
  "previous_requirement": "What the old rule said — or NONE if entirely new",
  "new_requirement": "Exactly what the new rule requires",
  "effective_date": "YYYY-MM-DD or IMMEDIATE or UNCLEAR",
  "transition_provisions": "Any grandfathering for ongoing studies — or NONE STATED",
  "affected_submission_types": ["CT-04", "ANDA", "IND", "NDA", "BE Study", etc.],
  "affected_product_categories": ["New Drug", "Generic", "Biosimilar", "OTC", etc.],
  "source_section": "Section reference within this document",
  "verbatim_text": "Exact quote from source document (max 150 words)",
  "source_citation": "Full document title, reference number, date"
}}

Step 3 — URGENCY ASSESSMENT:
For each change, assess urgency:
{{
  "urgency": "CRITICAL | HIGH | MEDIUM | LOW",
  "urgency_rationale": "Why this urgency level",
  "action_window": "Days sponsors have to respond before non-compliance risk",
  "recommended_action": "What RA teams should do immediately"
}}

Step 4 — PLAIN LANGUAGE SUMMARY:
Write a 3-5 sentence plain English summary suitable for a non-technical executive.
No jargon. State: what changed, who is affected, what they need to do, by when.

Return a JSON array of change objects, each containing all fields from Steps 2-4."""


# =============================================================================
# IMPACT ASSESSMENT PROMPT
# =============================================================================

IMPACT_ASSESSMENT_PROMPT = """=== REGULATORY CHANGE BEING ASSESSED ===
Change ID: {change_id}
Domain: {domain}
Change Type: {change_type}
New Requirement: {new_requirement}
Effective Date: {effective_date}
Affected Submission Types: {affected_submission_types}
Urgency: {urgency}

Full Change Details:
{full_change_json}

=== ACTIVE SUBMISSION DETAILS ===
Submission ID: {submission_id}
Type: {submission_type}
Drug: {drug_name} | Phase: {phase} | Status: {status}
Current Stage: {current_stage}
Key Documents: {key_documents}

Relevant Submission Content:
{submission_content}

ASSESSMENT TASK:

Evaluate whether this regulatory change impacts this specific submission.

Return a JSON object with the following structure:
{{
  "submission_id": "{submission_id}",
  "change_id": "{change_id}",
  "impact_status": "IMPACTED | LIKELY_IMPACTED | MONITOR | NOT_IMPACTED",
  "impact_rationale": "Specific reason why this submission is or is not affected (2-3 sentences)",
  "affected_documents": [
    {{
      "document": "Document name and version",
      "affected_section": "Section heading",
      "current_content_summary": "What it currently says (brief)",
      "required_change": "What needs to change to comply",
      "change_urgency": "BEFORE_NEXT_SUBMISSION | WITHIN_30_DAYS | MONITOR"
    }}
  ],
  "amendment_required": true | false,
  "amendment_type": "Protocol | ICF | IB | CTRI Update | Other | null",
  "estimated_delay_risk": "Days of potential delay if not addressed",
  "recommended_actions": [
    {{
      "action": "specific action to take",
      "owner": "Sponsor | CRO | Site | RA Team | Ethics Committee",
      "deadline": "YYYY-MM-DD or relative timeframe",
      "priority": "CRITICAL | HIGH | MEDIUM | LOW"
    }}
  ],
  "human_review_required": true | false,
  "alert_text": "One paragraph plain language alert for the RA team (3-5 sentences)"
}}

IMPORTANT:
- If impact_status is NOT_IMPACTED, provide clear rationale why
- If IMPACTED or LIKELY_IMPACTED, be specific about what documents need changes
- Always set human_review_required to true for CRITICAL/HIGH urgency changes
- Use conservative language: "may require", "should review", "recommend consulting"
- Do not provide legal advice or definitive compliance statements"""


# =============================================================================
# WEEKLY DIGEST PROMPT
# =============================================================================

WEEKLY_DIGEST_PROMPT = """=== WEEK IN REVIEW ===
Period: {start_date} to {end_date}

New Documents Detected: {new_documents_count}
Changes Extracted: {changes_count}
Critical/High Urgency Changes: {critical_high_count}

All Changes This Week:
{changes_json}

Active Customer Submissions Impacted:
{impact_assessments_json}

TASK:
Generate a professional Weekly Regulatory Digest formatted for distribution to Regulatory Affairs teams at pharmaceutical companies and CROs.

Return a JSON object with the following structure:
{{
  "executive_summary": "3-4 sentence overview of what happened this week in Indian pharma regulation, in plain English",
  "critical_actions": [
    {{
      "deadline": "YYYY-MM-DD",
      "action": "What must be done",
      "affected_parties": "Who is affected",
      "change_id": "CHG-ID"
    }}
  ],
  "detailed_changes": [
    {{
      "change_title": "Plain language title of the change",
      "effective_date": "YYYY-MM-DD or IMMEDIATE",
      "affects": "Submission types and product categories",
      "what_to_do": "Specific recommended action",
      "source_citation": "Full CDSCO citation",
      "urgency": "CRITICAL | HIGH | MEDIUM | LOW"
    }}
  ],
  "monitoring_items": [
    "Bullet point for each lower-urgency change to track"
  ],
  "no_material_changes": true/false
}}

TONE REQUIREMENTS:
- Professional, concise, actionable
- This digest is read by senior RA directors who have 3 minutes to understand what they need to act on
- No padding. No redundant phrases. Every sentence must carry information
- Use active voice and specific deadlines
- Prioritize critical actions at the top

If no significant changes were detected this week, set no_material_changes to true and include in executive_summary: "No material regulatory changes were published by CDSCO or MOHFW during this period."

Order detailed_changes by urgency (CRITICAL first, then HIGH, MEDIUM, LOW)."""


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def format_change_for_prompt(change_dict: dict) -> str:
    """Format change object for inclusion in prompts"""
    return f"""
Change ID: {change_dict.get('change_id')}
Domain: {change_dict.get('domain')}
Type: {change_dict.get('change_type')}
Previous: {change_dict.get('previous_requirement')}
New: {change_dict.get('new_requirement')}
Effective: {change_dict.get('effective_date')}
Urgency: {change_dict.get('urgency')}
Summary: {change_dict.get('plain_language_summary')}
"""


def format_submission_for_prompt(submission_dict: dict) -> str:
    """Format submission object for inclusion in prompts"""
    return f"""
Submission ID: {submission_dict.get('submission_id')}
Type: {submission_dict.get('submission_type')}
Drug: {submission_dict.get('drug_name')}
Phase: {submission_dict.get('phase', 'N/A')}
Status: {submission_dict.get('status')}
Stage: {submission_dict.get('current_stage')}
Documents: {', '.join(submission_dict.get('key_documents', []))}
"""
