"""
Sample regulatory data for initial knowledge base population.

This module contains sample excerpts from Indian pharmaceutical regulations.
In production, replace with complete regulatory documents.
"""
from typing import List, Dict


def get_sample_regulations() -> List[Dict]:
    """
    Get sample regulatory documents for knowledge base.
    
    Returns:
        List of regulatory document chunks with metadata
    """
    
    sample_docs = [
        # NDCTR 2019 - Informed Consent
        {
            "id": "ndctr_2019_rule_18_icf",
            "text": """Informed Consent Process (NDCTR 2019, Rule 18):
            
(1) The investigator shall obtain freely given informed consent from every subject or, in the case of a subject who is unable to give informed consent, from his legally acceptable representative, prior to clinical trial participation.

(2) The informed consent shall be documented by means of a written, signed and dated informed consent form.

(3) The informed consent form shall be in the language understandable to the subject or his legally acceptable representative and shall contain all elements as specified in Schedule II.

(4) Both the informed consent discussion and the written informed consent form shall include explanations of the following:
   (a) That the trial involves research
   (b) The purpose of the trial
   (c) The trial treatment(s) and the probability for random assignment to each treatment
   (d) The trial procedures to be followed
   (e) The subject's responsibilities
   (f) Those aspects of the trial that are experimental
   (g) The reasonably foreseeable risks or inconveniences to the subject
   (h) The reasonably expected benefits
   (i) The alternative procedure(s) or course(s) of treatment that may be available
   (j) The compensation and treatment available in case of trial-related injury
   (k) The anticipated prorated payment, if any, to the subject for participating in the trial
   (l) That the subject's participation is voluntary
   (m) That the subject may refuse to participate or withdraw from the trial at any time""",
            "source": "NDCTR 2019",
            "citation": "Rule 18",
            "document_type": "informed_consent",
            "metadata": {"section": "Informed Consent Process", "rule_number": "18"}
        },
        
        # NDCTR 2019 - Protocol Requirements
        {
            "id": "ndctr_2019_rule_22_protocol",
            "text": """Clinical Trial Protocol Requirements (NDCTR 2019, Rule 22):

The protocol shall contain the following information:

(a) General Information:
    - Protocol title, protocol identifying number, and date
    - Name and address of the sponsor
    - Name and title of the person(s) authorized to sign the protocol
    
(b) Background Information:
    - Name and description of the investigational product(s)
    - Summary of findings from non-clinical studies
    - Summary of known and potential risks and benefits
    - Description of and justification for the route of administration, dosage, dosage regimen, and treatment period(s)
    
(c) Trial Objectives and Purpose:
    - Detailed description of the objectives and the purpose of the trial
    
(d) Trial Design:
    - Scientific rationale for the trial design
    - Description of the type/design of trial
    - Description of measures taken to minimize/avoid bias
    - Description of the trial treatment(s) and the dosage and dosage regimen
    - Expected duration of subject participation
    - Description of the "stopping rules" or "discontinuation criteria"
    
(e) Selection and Withdrawal of Subjects:
    - Subject inclusion criteria
    - Subject exclusion criteria
    - Subject withdrawal criteria""",
            "source": "NDCTR 2019",
            "citation": "Rule 22",
            "document_type": "protocol",
            "metadata": {"section": "Protocol Requirements", "rule_number": "22"}
        },
        
        # CDSCO BA/BE Guidelines
        {
            "id": "cdsco_babe_study_design",
            "text": """Bioavailability and Bioequivalence Study Design (CDSCO Guidelines):

Study Design Requirements:
- BA/BE studies should be conducted as randomized, single-dose, two-treatment, two-period, two-sequence crossover studies
- A minimum washout period of at least 5 times the half-life of the drug should be maintained between the two periods
- Studies should be conducted under fasting conditions unless otherwise justified
- For modified release formulations, both fasting and fed studies may be required

Subject Selection:
- Healthy adult volunteers (18-55 years) should be enrolled
- Minimum 12 subjects should complete the study
- Subjects should be screened for medical history, physical examination, and laboratory tests
- Written informed consent must be obtained from all subjects

Sample Collection:
- Blood samples should be collected at appropriate time points to adequately characterize the absorption and elimination phases
- At least 12-18 samples per subject per period
- Sampling should continue for at least 3 times the terminal half-life""",
            "source": "CDSCO BA/BE Guidelines 2005",
            "citation": "Section 3.2 - Study Design",
            "document_type": "protocol",
            "metadata": {"guideline_type": "BA/BE", "section": "Study Design"}
        },
        
        # ICH E6(R3) GCP - Investigator Responsibilities
        {
            "id": "ich_e6r3_investigator_responsibilities",
            "text": """Investigator Responsibilities (ICH E6(R3) Section 4.1):

4.1.1 The investigator should be qualified by education, training, and experience to assume responsibility for the proper conduct of the trial.

4.1.2 The investigator should be thoroughly familiar with the appropriate use of the investigational product(s).

4.1.3 The investigator should be aware of, and should comply with, GCP and the applicable regulatory requirements.

4.1.4 The investigator/institution should permit monitoring and auditing by the sponsor, and inspection by the appropriate regulatory authority(ies).

4.1.5 The investigator should maintain a list of appropriately qualified persons to whom the investigator has delegated significant trial-related duties.

Medical Care of Trial Subjects (ICH E6(R3) Section 4.3):

4.3.1 A qualified physician (or dentist, when appropriate) who is an investigator or a sub-investigator for the trial, should be responsible for all trial-related medical decisions.

4.3.2 During and following a subject's participation in a trial, the investigator/institution should ensure that adequate medical care is provided to a subject for any adverse events, including clinically significant laboratory values, related to the trial.""",
            "source": "ICH E6(R3) GCP Guidelines",
            "citation": "Section 4.1 and 4.3",
            "document_type": "protocol",
            "metadata": {"guideline": "ICH E6(R3)", "section": "Investigator Responsibilities"}
        },
        
        # CTRI Registration Requirements
        {
            "id": "ctri_registration_requirements",
            "text": """CTRI Registration Requirements:

Mandatory Registration Timeline:
- All clinical trials conducted in India must be registered in the Clinical Trials Registry of India (CTRI) before enrollment of the first participant
- Registration must be completed within 30 days of Ethics Committee approval
- Trial registration number must be mentioned in all publications

Required Information for Registration:
1. Trial Identification:
   - Public title of the trial
   - Scientific title
   - Trial acronym (if any)
   
2. Trial Details:
   - Type of trial (interventional/observational)
   - Trial phase
   - Study design
   - Primary and secondary outcomes
   
3. Participant Information:
   - Target sample size
   - Inclusion/exclusion criteria
   - Age group
   
4. Administrative Information:
   - Principal investigator details
   - Sponsor details
   - Source of funding
   - Ethics committee approval details
   - Regulatory approval details (CT-04 for Phase II/III/IV)
   
5. Intervention Details:
   - Type of intervention
   - Drug/device details
   - Comparator details""",
            "source": "CTRI Registration Guidelines",
            "citation": "CTRI Registration Manual 2023",
            "document_type": "ctri_form",
            "metadata": {"requirement_type": "Registration", "authority": "ICMR"}
        },
        
        # Schedule Y - Clinical Trial Phases
        {
            "id": "schedule_y_phase_definitions",
            "text": """Clinical Trial Phase Definitions (Schedule Y):

Phase I Clinical Trials:
These are the first trials of a new drug in human subjects. The objectives are to determine:
- The tolerance of the human body to the drug
- Pharmacokinetic and pharmacodynamic properties
- Side effects associated with increasing doses
- Early evidence of effectiveness
Usually conducted in 20-80 healthy volunteers or patients

Phase II Clinical Trials:
Controlled clinical studies conducted to evaluate:
- The effectiveness of the drug for a particular indication
- Determine the common short-term side effects and risks
- Study design may be comparative (with placebo or active control)
Usually conducted in 100-300 patients with the disease/condition

Phase III Clinical Trials:
Expanded controlled and uncontrolled trials:
- Intended to gather additional information about effectiveness and safety
- Needed to evaluate the overall benefit-risk relationship
- Provide adequate basis for physician labeling
Usually conducted in 1000-3000 patients

Phase IV Clinical Trials (Post-Marketing Surveillance):
- Conducted after the drug is marketed
- Designed to monitor long-term effectiveness and impact
- Detect rare or long-term adverse effects
- Determine cost-effectiveness""",
            "source": "Schedule Y (Drugs and Cosmetics Rules)",
            "citation": "Schedule Y, Part II - Clinical Trial Phases",
            "document_type": "general",
            "metadata": {"schedule": "Y", "section": "Phase Definitions"}
        },
        
        # Ethics Committee Requirements
        {
            "id": "ethics_committee_requirements",
            "text": """Ethics Committee Review Requirements (NDCTR 2019, Rule 7):

Composition of Ethics Committee:
- Shall consist of at least 7 members
- At least one member from each: basic medical scientist, clinician, legal expert, social scientist/philosopher/ethicist/theologian, lay person from community
- At least one woman member
- At least one member from outside the institution

Ethics Committee Responsibilities:
1. Review and approve/reject clinical trial protocols
2. Review protocol amendments
3. Review serious adverse events
4. Conduct continuing review at least annually
5. Review subject recruitment procedures and materials
6. Review informed consent forms and process
7. Review compensation provisions for trial-related injury
8. Review investigator qualifications

Documents Required for EC Review:
- Protocol and amendments
- Investigator's Brochure
- Informed Consent Form
- Subject recruitment materials
- Investigator qualifications (CV, GCP training certificate)
- Facilities and equipment details
- Compensation provisions
- Insurance details
- Regulatory approval status""",
            "source": "NDCTR 2019",
            "citation": "Rule 7 - Ethics Committee",
            "document_type": "general",
            "metadata": {"rule_number": "7", "topic": "Ethics Committee"}
        },
        
        # Adverse Event Reporting
        {
            "id": "ndctr_2019_sae_reporting",
            "text": """Serious Adverse Event Reporting Requirements (NDCTR 2019, Rule 16):

Reporting Timeline:
- Serious Adverse Events (SAEs) must be reported to the Licensing Authority, Ethics Committee, and Sponsor within 24 hours of occurrence
- Fatal or life-threatening SAEs require immediate reporting (within 24 hours)
- All other SAEs should be reported within 7 calendar days
- Follow-up information should be submitted within 8 additional days (15 days total)

SAE Definition:
A serious adverse event is any untoward medical occurrence that:
- Results in death
- Is life-threatening
- Requires inpatient hospitalization or prolongation of existing hospitalization
- Results in persistent or significant disability/incapacity
- Is a congenital anomaly/birth defect
- Is a medically important event

Reporting Format:
- SAEs should be reported in CIOMS format or equivalent
- Report should include: subject identification, event description, onset date, severity, causality assessment, action taken, outcome
- Investigator's assessment of causality (related/not related to study drug)

Annual Safety Reports:
- Sponsor must submit annual safety update to Licensing Authority and Ethics Committee
- Should include summary of all SAEs, SUSARs, and safety-related protocol amendments""",
            "source": "NDCTR 2019",
            "citation": "Rule 16 - Safety Reporting",
            "document_type": "general",
            "metadata": {"rule_number": "16", "topic": "Safety Reporting"}
        }
    ]
    
    return sample_docs


def get_regulation_summary() -> str:
    """Get a summary of available regulatory documents."""
    docs = get_sample_regulations()
    
    summary = f"Sample Regulatory Knowledge Base ({len(docs)} documents):\n\n"
    
    sources = {}
    for doc in docs:
        source = doc['source']
        if source not in sources:
            sources[source] = []
        sources[source].append(doc['citation'])
    
    for source, citations in sources.items():
        summary += f"- {source}: {len(citations)} chunks\n"
        for citation in citations:
            summary += f"  - {citation}\n"
    
    return summary
