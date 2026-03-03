"""
Document Generation Prompt Templates for RegCheck-India Module 02

This module contains all prompt templates for the document generation pipeline:
1. System Prompt - DocGen-India identity and rules
2. Context Injection Template - Schema + Data + Requirements
3. Section Generation Template - Task prompt for specific sections
4. Regional Language ICF Template - Multilingual translation
"""

# =============================================================================
# 1. SYSTEM PROMPT - DOCGEN-INDIA
# =============================================================================

SYSTEM_PROMPT_DOCGEN = """You are DocGen-India, a regulatory document drafting AI specialized in creating
first-draft pharmaceutical regulatory documents for Indian submissions to CDSCO,
CTRI, and Ethics Committees.

YOUR CORE FUNCTION:
You generate structured, regulation-compliant draft sections of regulatory documents
from structured data inputs. You are a first-draft tool — your output will always
be reviewed and edited by a qualified Regulatory Affairs professional.

YOUR ABSOLUTE RULES:

1. SCHEMA FIRST: Never deviate from the mandatory document structure provided
   in the context. The section order, heading names, and required subsections
   are fixed by CDSCO/ICH guidelines. You complete the content — you do not
   decide the structure.

2. DATA FIDELITY: Only use data explicitly provided in the study inputs.
   If a required data field is marked {MISSING} or not provided, write:
   [DATA REQUIRED: {field_name} — must be completed by sponsor before submission]
   Never invent study data, patient numbers, dosing details, or safety findings.

3. PLACEHOLDER DISCIPLINE: Use standardized placeholders for all missing data:
   [SPONSOR TO COMPLETE: description] for data the sponsor must provide
   [SITE TO COMPLETE: description] for site-specific information
   [REGULATORY REVIEW REQUIRED: description] for judgment calls
   This makes the review process explicit and auditable.

4. CONSERVATIVE LANGUAGE: Use hedged, factual language. Do not write
   promotional language about the drug. Do not state efficacy conclusions
   beyond what the data input explicitly states. Regulators distrust overreach.

5. CITATION OF TEMPLATES: When you use a standard regulatory phrase or formula,
   note its source inline: (per ICH E6(R3) template) or (per CDSCO 2018 BA/BE
   Guidance Section 4.2). This helps the reviewer validate your choices.

6. SECTION COMPLETION SCORE: At the end of each section, append:
   COMPLETION: {percentage}% | PLACEHOLDERS: {count} | REVIEW PRIORITY: H/M/L
   This tells the reviewer where to focus their editing effort.
"""

# =============================================================================
# 2. CONTEXT INJECTION TEMPLATE
# =============================================================================

CONTEXT_INJECTION_TEMPLATE = """=== DOCUMENT SCHEMA ===
Document Type: {document_type}
Regulatory Standard: {regulatory_standard}
Required Sections (in order):
{schema_section_list}

Current Section Being Generated: {current_section_number} — {section_heading}
Previously Generated Sections: {completed_sections}

=== REGULATORY REQUIREMENTS FOR THIS SECTION ===
{section_specific_requirements}
Source: {requirement_citation}

=== STUDY DATA INPUTS ===
Study Title: {study_title}
Protocol Number: {protocol_number}
Phase: {phase} | Indication: {indication}
IMP (Investigational Medicinal Product): {imp_name} | Dose: {dose} | Route: {route}
Comparator: {comparator_name}
Study Design: {design_type} | Blinding: {blinding} | Randomization: {randomization}
Sample Size: N={sample_size} | Duration: {duration}
Sites: {site_count} sites | Countries: {countries}
Primary Endpoint: {primary_endpoint}
Secondary Endpoints: {secondary_endpoints}
Key Inclusion Criteria: {inclusion_criteria}
Key Exclusion Criteria: {exclusion_criteria}
SAE Reporting Window: {sae_window}
Ethics Committee: {ec_name} | EC Reference: {ec_reference}
Sponsor: {sponsor_name} | CRO: {cro_name}
Additional Context: {additional_notes}
"""

# =============================================================================
# 3. SECTION GENERATION TASK PROMPT
# =============================================================================

SECTION_GENERATION_TEMPLATE = """Generate the content for Section {section_number}: {section_heading} of the
{document_type}.

Use ONLY the study data provided above. Do not invent data.
Follow the mandatory structure for this section per {regulatory_standard}.
Write in formal regulatory document style — third person, present tense for
study design, past tense for completed activities, active voice where possible.

SPECIFIC INSTRUCTIONS FOR THIS SECTION TYPE:
{section_specific_instructions}

OUTPUT FORMAT:
{{
  "section_number": "{section_number}",
  "section_heading": "{section_heading}",
  "generated_content": "Full section text with all subsections",
  "placeholders_used": ["list of all [DATA REQUIRED:...] tags inserted"],
  "regulatory_choices_made": [
    {{"choice": "What template/formula was used", "source": "Citation"}}
  ],
  "completion_pct": <number>,
  "review_priority": "HIGH | MEDIUM | LOW",
  "review_priority_reason": "Why this priority level"
}}
"""

# =============================================================================
# 4. SECTION-SPECIFIC INSTRUCTION TEMPLATES
# =============================================================================

SECTION_INSTRUCTIONS = {
    "Informed Consent": """
- Use plain language at a reading level accessible to a person with 8th grade
  education (Flesch-Kincaid Grade 8 or below)
- Include all mandatory ICH E6(R3) elements: purpose, duration, procedures,
  risks, benefits, alternatives, confidentiality, compensation, contact info,
  voluntary participation statement
- Flag any section requiring local ethics committee specific language with
  [EC CUSTOMIZATION REQUIRED: {description}]
- Use second person (you) throughout
- Avoid medical jargon or define terms in parentheses
- Keep sentences short (maximum 20 words)
""",
    
    "SAE Narrative": """
- Follow WHO narrative format: patient description, event, timeline, causality
- Include: time to onset, action taken with IMP, outcome, investigator assessment
- Causality assessment must reference WHO-UMC scale
- Use past tense and be factual
- Include exact dates and times
- Include relevant lab values with units and normal ranges
- Causality categories: Certain, Probable/Likely, Possible, Unlikely, Conditional, Unassessable
""",
    
    "Statistical Methods": """
- Specify analysis populations (ITT, PP, Safety)
- State the primary analysis test with alpha level (default 0.05 two-sided)
- For BE studies: state the acceptance criteria (80.00–125.00% per CDSCO 2018)
- Include sample size justification with power calculation
- Specify handling of missing data
- Define all statistical terms
- Specify software to be used (e.g., SAS 9.4, R 4.0)
""",
    
    "Study Design": """
- Use present tense for study design description
- Include study flow diagram placeholder: [STUDY DIAGRAM TO BE INSERTED]
- Specify visit windows (e.g., Day 7 ± 2 days)
- For crossover designs: specify washout periods
- Define study day numbering convention
- Include randomization ratio and stratification factors if applicable
""",
    
    "Eligibility Criteria": """
- Number each criterion
- Use specific, measurable criteria
- Include units for all lab values
- Specify washout requirements for prior medications
- Include age ranges with units (years)
- Specify diagnostic criteria with references
- List prohibited concomitant medications
""",
    
    "Safety Assessment": """
- Define AE, SAE, SUSAR clearly
- Use CTCAE v5.0 for AE grading
- State SAE reporting timeline: 14 days to CDSCO and EC per NDCTR 2019 Rule 16
- Specify causality assessment method: WHO-UMC scale
- Include contact information for safety reporting
- Reference DSMB if applicable
"""
}

# =============================================================================
# 5. REGIONAL LANGUAGE ICF TRANSLATION PROMPT
# =============================================================================

REGIONAL_LANGUAGE_ICF_TEMPLATE = """You are given an approved English Informed Consent Form for a clinical trial.
Translate and adapt it to {target_language}.

TRANSLATION RULES:

1. ACCURACY OVER FLUENCY: Prioritize precise meaning over natural phrasing.
   Medical terms that lack direct equivalents must be: (a) transliterated with
   the English term in parentheses, OR (b) explained with a descriptive phrase.
   Example: "randomization (yadrichhik chunav — random selection process)"

2. READING LEVEL: Target 6th grade reading level in {target_language}.
   Avoid technical jargon. Use simple sentence structures.

3. DO NOT OMIT: Every substantive element of the English source must appear
   in the translation. Flag any element you cannot adequately translate with:
   [TRANSLATION UNCERTAIN: {{element}} — requires native language medical review]

4. CULTURAL APPROPRIATENESS: Note any elements that may require cultural
   adaptation for the target population with:
   [CULTURAL REVIEW FLAG: {{element}} — reason]

5. BACK-TRANSLATION TAG: At the end of each translated paragraph, append the
   machine back-translation to English in italics so the reviewer can compare:
   [BACK-TRANSLATION: {{back-translated text}}]

SOURCE ICF:
{source_icf_content}

OUTPUT FORMAT:
{{
  "target_language": "{target_language}",
  "source_version": "{icf_version}",
  "translated_sections": [
    {{
      "heading": "Section heading in {target_language}",
      "translated_text": "Full translated section",
      "back_translation": "English back-translation",
      "translation_flags": ["any TRANSLATION UNCERTAIN or CULTURAL REVIEW flags"],
      "review_required": true | false
    }}
  ],
  "total_flags": <number>,
  "recommended_review": "Native language medical professional review required: Y/N"
}}
"""

# =============================================================================
# SUPPORTED LANGUAGES
# =============================================================================

SUPPORTED_LANGUAGES = {
    "hindi": "Hindi (हिन्दी)",
    "tamil": "Tamil (தமிழ்)",
    "marathi": "Marathi (मराठी)",
    "bengali": "Bengali (বাংলা)",
    "telugu": "Telugu (తెలుగు)",
    "kannada": "Kannada (ಕನ್ನಡ)",
    "gujarati": "Gujarati (ગુજરાતી)",
    "malayalam": "Malayalam (മലയാളം)"
}
