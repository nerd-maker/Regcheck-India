'use client'

import { useState, useEffect } from 'react'
import { useWorkspace } from '@/lib/workspaceStore'
import PageHeader from '@/components/veeva/PageHeader'
import FileUpload from '@/components/FileUpload'

interface AgentMeta {
  id: string
  title: string
  framework: string
  icon: string
  description: string
  inputLabel: string
  sampleFileName: string
  sampleText: string
}

const AGENTS: Record<string, AgentMeta> = {
  'm1-anonymiser': {
    id: 'm1-anonymiser',
    title: 'PII Anonymiser',
    framework: 'DPDP Act 2023 · Schedule Y',
    icon: 'ti-shield-check',
    description: 'Detect and redact patient, investigator, and sponsor PII per DPDP Act 2023. Preserves clinical and demographic context with safe placeholders.',
    inputLabel: 'Upload Document for PII Redaction',
    sampleFileName: 'ZP-101_ICF_English_v1.4.pdf',
    sampleText: 'Investigator: Dr. Priya Menon, MD, PAN: ABCDE1234F. Patient: Ramesh Iyer, DOB 12-Mar-1979, Aadhaar XXXX-XXXX-1234, residing at 14 Brigade Rd, Bengaluru-560001. Ethics Committee: Independent Ethics Committee of Pune. Secretary: Mr. Deepak Nair.',
  },
  'm2-summariser': {
    id: 'm2-summariser',
    title: 'Document Summariser',
    framework: 'CDSCO · ICH',
    icon: 'ti-file-description',
    description: 'Precis-style summary with section-level highlights, key recommendations, and CDSCO/ICH regulatory citations.',
    inputLabel: 'Upload Document for Summarisation',
    sampleFileName: 'ZP-101_Phase_II_Protocol_v2.1.pdf',
    sampleText: 'Protocol ZP-101: A randomised, double-blind, placebo-controlled Phase II trial evaluating the efficacy and safety of ZP-101 in adult subjects with Type 2 Diabetes Mellitus. Primary endpoint: change in HbA1c from baseline at Week 24. Treatment duration is 24 weeks with 1:1 allocation to active drug (400 mg QD) or placebo.',
  },
  'm3-completeness': {
    id: 'm3-completeness',
    title: 'Completeness Checker',
    framework: 'CDSCO · NDCTR 2019 · ICH E6(R3)',
    icon: 'ti-checklist',
    description: 'Validate documents against CDSCO, NDCTR 2019, and ICH requirements. Flags missing and incomplete sections as CRITICAL / MAJOR / MINOR.',
    inputLabel: 'Upload Submission Package for Completeness Check',
    sampleFileName: 'ZP-101_CDSCO_Filing_Package.zip',
    sampleText: 'Clinical Trial Application — Phase II — ZP-101 in Type 2 Diabetes Mellitus. Includes Protocol Cover Page, Study Objectives, Patient Inclusion/Exclusion Criteria, Adverse Event Reporting Procedures, and Statistical Analysis Plan. Incomplete site monitor checklists.',
  },
  'm4-classifier': {
    id: 'm4-classifier',
    title: 'Case Classifier',
    framework: 'ICH E2A · WHO-UMC · NDCTR 2019',
    icon: 'ti-alert-triangle',
    description: 'Classify adverse events using ICH E2A seriousness criteria, WHO-UMC causality, and Indian PvPI reporting timelines.',
    inputLabel: 'Upload SAE Narrative / CT-04 Report',
    sampleFileName: 'SAE_Narrative_CASE-2025-0089.docx',
    sampleText: 'A 67-year-old female subject developed sudden onset severe dyspnoea, urticaria, and hypotension (BP 80/50 mmHg) approximately 12 minutes after the second IV infusion of study drug BX-400 (400 mg). Emergency treatment was initiated in the ICU with adrenaline and hydrocortisone. Causality assessed as probably related.',
  },
  'm5-inspection': {
    id: 'm5-inspection',
    title: 'Inspection Report Generator',
    framework: 'CDSCO GCP · Schedule Y',
    icon: 'ti-report',
    description: 'Generate CDSCO GCP inspection report with corrective actions (CAPA), observation classification, and Schedule Y compliance rating.',
    inputLabel: 'Upload Site Observation Notes / Inspection Raw Logs',
    sampleFileName: 'Apollo_Chennai_GCP_Audit_Notes.docx',
    sampleText: 'Site: Apollo Hospitals, Chennai. Observation 1: ICF v1.3 used for 3 subjects after v1.4 approved by EC. Observation 2: Temperature logs for IP storage showed excursions up to 29°C on two dates. Observation 3: ISF is missing updated CV for 1 co-investigator.',
  },
  'm6-qa': {
    id: 'm6-qa',
    title: 'Regulatory Q&A',
    framework: 'NDCTR 2019 · Schedule Y · ICH · ICMR',
    icon: 'ti-message-question',
    description: 'RAG-powered assistant grounded in NDCTR 2019, Schedule Y, ICH guidelines, and ICMR ethics corpus.',
    inputLabel: 'Enter your regulatory question',
    sampleFileName: '',
    sampleText: 'What is the CDSCO reporting timeline for an SUSAR in a clinical trial in India?',
  },
  'm7-scheduley': {
    id: 'm7-scheduley',
    title: 'Schedule Y Deep Check',
    framework: 'Schedule Y · NDCTR 2019 Rules 1–105',
    icon: 'ti-scale',
    description: 'Deep compliance checklist across Schedule Y Appendices I–XI and NDCTR 2019 Rules. Detects clinical, toxicology, and consent gaps.',
    inputLabel: 'Upload Protocol / CMC Package',
    sampleFileName: 'Clinical_Trial_Protocol_ZP-101_ScheduleY.pdf',
    sampleText: 'Clinical Trial Protocol v2.1. Appendix I drug formulation data complete. Appendix II animal toxicology data complete. Appendix IV Patient Information Sheet lacks injury compensation statement.',
  },
  'm8-ichgcp': {
    id: 'm8-ichgcp',
    title: 'ICH E6(R3) GCP Compliance',
    framework: 'ICH E6(R3)',
    icon: 'ti-certificate-2',
    description: 'Full GCP evaluation against ICH E6(R3) draft guidelines including QMS, Quality Tolerance Limits, and Risk-Based Monitoring.',
    inputLabel: 'Upload Monitoring Plan / QMS Document',
    sampleFileName: 'Risk_Based_Monitoring_Plan_v1.1.pdf',
    sampleText: 'Risk-Based Monitoring Plan v1.1. Protocol ZP-101. QMS lacks definition of Quality Tolerance Limits (QTLs) for primary efficacy endpoints. Monitoring triggers do not define site visit deviations numeric thresholds.',
  },
  'm9-crossdoc': {
    id: 'm9-crossdoc',
    title: 'Cross-Document Consistency',
    framework: 'CDSCO · ICH',
    icon: 'ti-files',
    description: 'Simultaneously analyze Protocol, ICF, and Investigator Brochure. AI detects dosage, eligibility, safety, and date contradictions.',
    inputLabel: 'Upload Documents for Cross-Doc Analysis',
    sampleFileName: 'Protocol_v2.1_and_ICF_v1.4',
    sampleText: 'Cross-document consistency check. Protocol v2.1 states starting dose is 400 mg daily, but ICF Page 3 references 200 mg. Inclusion age in protocol is 18-75, but ICF Page 2 limits to 18-65. Severe urticaria safety risk in IB Section 6.4 is missing from ICF risks.',
  },
}

const QA_CHIPS = [
  'What is the CDSCO reporting timeline for an SUSAR in a clinical trial in India?',
  'What are the paediatric dosing rationale requirements under Schedule Y?',
  'What are the mandatory elements of an Informed Consent Form under NDCTR 2019?',
  'What is the retention period required for clinical trial documents in India?'
]

export default function AgentActionView({ agentId }: { agentId: string }) {
  const { setActiveView } = useWorkspace()
  const agent = AGENTS[agentId] ?? AGENTS['m3-completeness']
  const [input, setInput] = useState('')
  const [uploadedFile, setUploadedFile] = useState<string | null>(null)
  const [uploadedFile2, setUploadedFile2] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<null | any>(null)

  const handleUseSample = () => {
    setInput(agent.sampleText)
    if (agentId === 'm9-crossdoc') {
      setUploadedFile('ZP-101_Protocol_v2.1.pdf')
      setUploadedFile2('ZP-101_ICF_English_v1.4.pdf')
    } else if (agentId !== 'm6-qa') {
      setUploadedFile(agent.sampleFileName)
    }
  }

  const handleClear = () => {
    setInput('')
    setUploadedFile(null)
    setUploadedFile2(null)
    setResult(null)
  }

  const runAnalysisSim = () => {
    setRunning(true)
    setResult(null)
    setTimeout(() => {
      setRunning(false)
      let agentResult: any = {}

      if (agentId === 'm1-anonymiser') {
        agentResult = {
          headline: 'Anonymisation complete — 8 entities redacted',
          summary: 'Successfully scanned the document per DPDP Act 2023. Redacted 2 HARD PII elements (Aadhaar, DOB) and 6 SOFT PII elements (Names, Locations) while preserving clinical and demographic context.',
          compliance: ['DPDP Act 2023', 'Schedule Y'],
          redactedText: 'Investigator: INVESTIGATOR-A, MD, PAN: [PAN_REDACTED]. Patient: [PATIENT: adult_male_45-50yr], DOB [DOB: 1970s, age_46yr], Aadhaar [AADHAAR_REDACTED], residing at [ADDRESS_REDACTED]. Site: SITE-A. Ethics Committee: [EC_REDACTED]. Secretary: INVESTIGATOR-B.',
          entities: [
            { type: 'Patient Name', val: 'Ramesh Iyer', repl: '[PATIENT: adult_male_45-50yr]' },
            { type: 'Aadhaar', val: 'XXXX-XXXX-1234', repl: '[AADHAAR_REDACTED]' },
            { type: 'DOB', val: '12-Mar-1979', repl: '[DOB: 1970s, age_46yr]' },
            { type: 'Investigator Name', val: 'Dr. Priya Menon', repl: 'INVESTIGATOR-A' },
            { type: 'Address', val: '14 Brigade Rd, Bengaluru-560001', repl: '[ADDRESS_REDACTED]' },
            { type: 'Secretary Name', val: 'Mr. Deepak Nair', repl: 'INVESTIGATOR-B' },
          ]
        }
      } else if (agentId === 'm2-summariser') {
        agentResult = {
          headline: 'Document summary generated',
          summary: 'Protocol ZP-101. Phase II Clinical Trial. Executive summary, key sections, and regulatory relevance compiled below.',
          sections: [
            { name: '1.0 Trial Objective', content: 'Evaluate efficacy and safety of ZP-101 in adult subjects with Type 2 Diabetes Mellitus.' },
            { name: '2.0 Study Design', content: 'Randomised, double-blind, placebo-controlled Phase II trial. 24-week treatment period, 1:1 ratio.' },
            { name: '3.0 Key Endpoint', content: 'Change in HbA1c from baseline at Week 24.' },
            { name: '4.0 Regulatory Relevance', content: 'Aligns with NDCTR 2019 Rule 25 requirements for Phase II clinical trials in India.' }
          ],
          keyPoints: [
            'ZP-101 is a novel compound targeting HbA1c reduction.',
            'Safety warnings include monitoring renal function (eGFR > 30).',
            'Requires local Ethics Committee approval prior to site initiation.'
          ]
        }
      } else if (agentId === 'm3-completeness') {
        agentResult = {
          headline: 'Completeness check: 85% Score (Needs Revision)',
          summary: 'Validated submission package against CDSCO checklist. Found 1 critical gap and 2 major/minor deviations.',
          score: 85,
          gaps: [
            { sev: 'critical', ref: 'Schedule Y Appendix III §4', desc: 'Paediatric sub-study dose rationale is missing from Section 7.4. CDSCO requires paediatric trials to have a clear PK/PD extrapolation model.', rec: 'Add pediatric dose justification referencing the Phase I PK/PD data and the model-informed dosing analysis (Section 5.2).' },
            { sev: 'major', ref: 'NDCTR 2019 Rule 33', desc: 'Investigator CV does not display MCI registration details. Needed for site initiation compliance.', rec: 'Attach copy of investigator\'s active medical registration certificate.' },
            { sev: 'minor', ref: 'ICH E6(R3) §7.1.4', desc: 'Section 12.1 study monitoring plan does not define site visit frequency triggers.', rec: 'Define quantitative triggers (e.g. >10% protocol deviations, >2 SAEs in 30 days).' }
          ]
        }
      } else if (agentId === 'm4-classifier') {
        agentResult = {
          headline: 'SAE Case Classified: Grade IV Serious Adverse Event (Expedited)',
          summary: 'Analyzed SAE narrative for Patient CASE-2025-0089. Seriousness criteria met. Expedited 24-hour reporting to CDSCO required.',
          priority: '9/10 (High Urgency)',
          criteria: {
            'Life Threatening': 'YES',
            'Hospitalisation': 'YES',
            'ICU Admission': 'YES',
            'Disability': 'NO'
          },
          causality: 'PROBABLE (WHO-UMC category: Related)',
          rationale: 'Temporal relationship is highly suggestive (onset 12 min post-infusion). Anaphylaxis is a known drug-class reaction but unexpected in severity for this compound.',
          deadline: '25-Oct-2025 (within 24 hours of notification)',
          remediations: [
            'Notify CDSCO / CLA within 24 hours of local site report.',
            'Submit full Form CT-04 narrative within 14 days.',
            'Quarantine study drug batch if another event is reported at same site.'
          ]
        }
      } else if (agentId === 'm5-inspection') {
        agentResult = {
          headline: 'GCP Inspection Report Generated: 3 Observations Logged',
          summary: 'Inspection details at Apollo Hospitals, Chennai. Overall Compliance Rating: Needs Improvement.',
          rating: 'Needs Improvement',
          findings: [
            { id: 'OBS-01', type: 'Critical', desc: 'ICF version 1.3 was used for 3 subjects after EC approved version 1.4 was already active at the site.', ref: 'CDSCO GCP §2.4.2', capa: 'Re-consent all active subjects using ICF v1.4 immediately. Retrain study coordinators on version control.' },
            { id: 'OBS-02', type: 'Major', desc: 'Temperature logs for investigational product storage showed excursions (up to 29°C) on 2 dates. No stability query was raised.', ref: 'CDSCO GCP §4.6', capa: 'Quarantine remaining study drug at site. Calibrate digital thermometer and check drug stability data.' },
            { id: 'OBS-03', type: 'Minor', desc: 'Investigator site file is missing updated signed/dated CV for 1 co-investigator.', ref: 'CDSCO GCP §3.2', capa: 'Obtain current signed/dated CV and medical license within 15 days.' }
          ]
        }
      } else if (agentId === 'm6-qa') {
        agentResult = {
          headline: 'Regulatory Q&A Response Grounded in Corpus',
          summary: 'Direct answer generated with citations. Grounded in NDCTR 2019 and Schedule Y.',
          answer: 'According to Rule 39 of the New Drugs and Clinical Trials Rules (NDCTR) 2019, any serious adverse event (SAE) occurring during a clinical trial in India must be reported by the investigator to the Central Licencing Authority (CDSCO), the Ethics Committee, and the Sponsor within twenty-four (24) hours of its occurrence. Subsequently, the sponsor must submit a detailed report along with a causality assessment to the CDSCO and the Ethics Committee within fourteen (14) days of the event.',
          citations: [
            'NDCTR 2019, Rule 39 (Reporting of Serious Adverse Event)',
            'Schedule Y, Appendix XI (Data Elements for SAE Reporting)',
            'CDSCO Guidance Document CDSCO/CT/2024/02'
          ]
        }
      } else if (agentId === 'm7-scheduley') {
        agentResult = {
          headline: 'Schedule Y Check: 78% Score (Partial Compliance)',
          summary: 'Appendix checklists processed. Identified 1 critical and 1 major non-compliance.',
          score: 78,
          critical: [
            'Appendix IV - Patient Information Sheet is missing the mandatory statement regarding compensation for trial-related injury (NDCTR Rule 39).'
          ],
          major: [
            'Appendix III - Preclinical animal toxicology studies do not include mutagenicity study data for local registration.'
          ],
          checklist: [
            { req: 'Appendix I - Drug formulation & stability', status: 'Compliant' },
            { req: 'Appendix II - Animal pharmacology data', status: 'Compliant' },
            { req: 'Appendix III - Clinical protocol details', status: 'Partial Compliance' },
            { req: 'Appendix IV - Informed Consent Form', status: 'Non-Compliant' }
          ]
        }
      } else if (agentId === 'm8-ichgcp') {
        agentResult = {
          headline: 'ICH E6(R3) GCP Compliance: 82% Score (Passed with Recommendations)',
          summary: 'Evaluated document against draft E6(R3) guidelines. 2 key deviations in Risk-Based Monitoring and QMS.',
          score: 82,
          deviations: [
            { type: 'Major', ref: 'ICH E6(R3) §1.2.3', desc: 'Quality Management System does not define Quality Tolerance Limits (QTLs) for primary efficacy endpoints.' },
            { type: 'Major', ref: 'ICH E6(R3) §7.1.4', desc: 'Risk-Based Monitoring plan does not establish quantitative site-visit triggers (e.g. site deviation rate > 10%).' }
          ],
          recommendations: [
            'Define QTLs for primary and secondary efficacy parameters in the QMS.',
            'Incorporate specific, numerical site visit triggers in the Risk-Based Monitoring section.',
            'Establish investigator sign-off for decentralized trial data portals.'
          ]
        }
      } else if (agentId === 'm9-crossdoc') {
        agentResult = {
          headline: 'Cross-Document Consistency: 5 Mismatches Detected',
          summary: 'Scanned Protocol, ICF, and Investigator Brochure. Discovered 3 dosing and eligibility contradictions.',
          score: 52,
          mismatches: [
            { severity: 'Critical', category: 'Dosing', desc: 'Protocol Section 4.2 states ZP-101 starting dose is 400 mg daily, but the ICF (Page 3) references 200 mg daily dose.', docA: 'Protocol v2.1', docB: 'ICF English v1.4' },
            { severity: 'Major', category: 'Eligibility', desc: 'Protocol Section 5.1 includes subjects aged 18-75 years, whereas the ICF Page 2 limits inclusion to subjects aged 18-65 years.', docA: 'Protocol v2.1', docB: 'ICF English v1.4' },
            { severity: 'Critical', category: 'Safety', desc: 'Investigator Brochure Section 6.4 lists severe urticaria as a known risk, but this is omitted from the ICF risks section.', docA: 'Investigator Brochure v3.0', docB: 'ICF English v1.4' }
          ],
          matrix: [
            { pair: 'Protocol vs ICF', status: 'Issues Found', count: 3 },
            { pair: 'Protocol vs IB', status: 'Issues Found', count: 2 },
            { pair: 'IB vs ICF', status: 'Issues Found', count: 1 }
          ]
        }
      }

      setResult(agentResult)
    }, 2000)
  }

  const handleDownloadReport = () => {
    if (!result) return
    let text = `RegCheck-India — ${agent.title} Report\n`
    text += `Generated: ${new Date().toLocaleString()}\n`
    text += `Framework: ${agent.framework}\n`
    text += `--------------------------------------------------\n\n`
    text += `Summary:\n${result.summary}\n\n`

    if (agentId === 'm1-anonymiser') {
      text += `Entities Redacted:\n`
      result.entities.forEach((e: any) => {
        text += `- [${e.type}] "${e.val}" -> ${e.repl}\n`
      })
      text += `\nRedacted Content:\n${result.redactedText}\n`
    } else if (agentId === 'm2-summariser') {
      text += `Structured Summary:\n`
      result.sections.forEach((s: any) => {
        text += `\n* ${s.name} *\n${s.content}\n`
      })
    } else if (agentId === 'm3-completeness') {
      text += `Gaps Found:\n`
      result.gaps.forEach((g: any) => {
        text += `[${g.sev.toUpperCase()}] (${g.ref}): ${g.desc}\nRemediation: ${g.rec}\n\n`
      })
    } else if (agentId === 'm4-classifier') {
      text += `Seriousness Criteria:\n`
      Object.entries(result.criteria).forEach(([k, v]) => {
        text += `- ${k}: ${v}\n`
      })
      text += `\nCausality:\n${result.causality}\n`
      text += `Rationale: ${result.rationale}\n`
      text += `Deadline: ${result.deadline}\n`
    } else if (agentId === 'm5-inspection') {
      text += `Observations:\n`
      result.findings.forEach((f: any) => {
        text += `[${f.type.toUpperCase()}] ${f.id} (${f.ref}): ${f.desc}\nCAPA Action: ${f.capa}\n\n`
      })
    } else if (agentId === 'm6-qa') {
      text += `Question: ${input}\n\n`
      text += `Answer:\n${result.answer}\n\nCitations:\n`
      result.citations.forEach((c: any) => {
        text += `- ${c}\n`
      })
    } else if (agentId === 'm7-scheduley') {
      text += `Critical Gaps:\n`
      result.critical.forEach((g: any) => {
        text += `- ${g}\n`
      })
      text += `\nChecklist:\n`
      result.checklist.forEach((c: any) => {
        text += `- ${c.req}: ${c.status} (${c.finding || ''})\n`
      })
    } else if (agentId === 'm8-ichgcp') {
      text += `Deviations:\n`
      result.deviations.forEach((d: any) => {
        text += `[${d.type}] (${d.ref}): ${d.desc}\n`
      })
      text += `\nRecommendations:\n`
      result.recommendations.forEach((r: any) => {
        text += `- ${r}\n`
      })
    } else if (agentId === 'm9-crossdoc') {
      text += `Mismatches:\n`
      result.mismatches.forEach((m: any) => {
        text += `[${m.severity}] Category: ${m.category}\n- Contradiction: ${m.desc}\n- Source A: ${m.docA}\n- Source B: ${m.docB}\n\n`
      })
    }

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `compliance_report_${agentId}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const isRunDisabled = running || (agentId === 'm6-qa' ? !input : (agentId === 'm9-crossdoc' ? (!uploadedFile || !uploadedFile2) : !uploadedFile))

  return (
    <div data-testid={`agent-${agentId}`}>
      <PageHeader
        crumbs={[
          { label: 'Workspace', onClick: () => setActiveView('home') },
          { label: 'Compliance Agents', onClick: () => setActiveView('home') },
          { label: agent.title },
        ]}
        title={agent.title}
        subtitle={agent.framework}
        icon={agent.icon}
        actions={
          <>
            <button className="rc-btn" onClick={handleUseSample} disabled={running} data-testid="agent-sample-btn">
              <i className="ti ti-clipboard"/> Use sample
            </button>
            <button className="rc-btn" onClick={handleClear} disabled={running}>
              <i className="ti ti-rotate"/> Reset
            </button>
            <button className="rc-btn rc-btn-primary" disabled={isRunDisabled} onClick={runAnalysisSim} data-testid="agent-run-btn">
              <i className={`ti ${running ? 'ti-loader-2 animate-spin' : 'ti-sparkles'}`}/> {running ? 'Running…' : 'Run Analysis'}
            </button>
          </>
        }
      />

      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        {/* Left Side: Input Panel */}
        <div className="rc-card">
          <div className="rc-card-header">
            <span>{agent.inputLabel}</span>
            {agentId === 'm6-qa' && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--rc-text-muted)' }}>{input.split(/\s+/).filter(Boolean).length} words</span>}
          </div>
          <div className="rc-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 12, color: 'var(--rc-text-muted)', margin: '0 0 10px', lineHeight: 1.6 }}>{agent.description}</p>
            
            {agentId === 'm6-qa' ? (
              <>
                <textarea
                  className="rc-textarea"
                  placeholder="Ask a question about Schedule Y, NDCTR 2019, or clinical trial guidelines..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  style={{ minHeight: 180 }}
                  data-testid="agent-input"
                  disabled={running}
                />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rc-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Quick Queries:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {QA_CHIPS.map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => setInput(chip)}
                        disabled={running}
                        style={{
                          background: 'rgba(26, 86, 219, 0.05)',
                          border: '1px solid rgba(26, 86, 219, 0.15)',
                          borderRadius: 4,
                          padding: '6px 10px',
                          fontSize: 11.5,
                          textAlign: 'left',
                          cursor: 'pointer',
                          color: 'var(--rc-primary)',
                        }}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : agentId === 'm9-crossdoc' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rc-text-muted)', marginBottom: 6 }}>Document 1 (e.g. Protocol)</div>
                  <FileUpload
                    onTextExtracted={(text, filename) => {
                      setUploadedFile(filename)
                      if (!input) setInput(text)
                    }}
                    onError={() => {}}
                    uploadedFileName={uploadedFile}
                    disabled={running}
                    label="Upload Protocol"
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rc-text-muted)', marginBottom: 6 }}>Document 2 (e.g. ICF)</div>
                  <FileUpload
                    onTextExtracted={(text, filename) => {
                      setUploadedFile2(filename)
                    }}
                    onError={() => {}}
                    uploadedFileName={uploadedFile2}
                    disabled={running}
                    label="Upload ICF"
                  />
                </div>
              </div>
            ) : (
              <FileUpload
                onTextExtracted={(text, filename) => {
                  setUploadedFile(filename)
                  setInput(text)
                }}
                onError={() => {}}
                uploadedFileName={uploadedFile}
                disabled={running}
                label={agent.inputLabel}
              />
            )}
          </div>
        </div>

        {/* Right Side: Result Panel */}
        <div className="rc-card">
          <div className="rc-card-header">
            <span>Compliance Findings</span>
            {result && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={handleDownloadReport}>
                  <i className="ti ti-download"/> Download Report
                </button>
              </div>
            )}
          </div>
          <div style={{ minHeight: 320, padding: result ? 0 : 24, display: 'flex', flexDirection: 'column' }}>
            {!result && !running && (
              <div className="rc-empty" style={{ flex: 1 }}>
                <i className="ti ti-circle-dashed" style={{ fontSize: 24, color: 'var(--rc-text-muted)', marginBottom: 8 }}/>
                <div style={{ fontSize: 12.5, color: 'var(--rc-text-muted)' }}>Load a file and run analysis to see compliance findings.</div>
              </div>
            )}
            
            {running && (
              <div className="rc-empty" style={{ flex: 1 }}>
                <i className="ti ti-loader-2 animate-spin" style={{ fontSize: 28, color: 'var(--rc-primary)', marginBottom: 12 }}/>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Running {agent.title}…</div>
                <div style={{ fontSize: 11, color: 'var(--rc-text-muted)', marginTop: 4 }}>Simulating local LLM evaluation &amp; guideline cross-referencing...</div>
              </div>
            )}

            {result && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Result header */}
                <div style={{ padding: '14px 16px', background: 'rgba(26, 86, 219, 0.05)', color: 'var(--rc-primary)', fontSize: 12.5, fontWeight: 600, borderBottom: '1px solid var(--rc-divider)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="ti ti-sparkles"/> {result.headline}
                </div>
                <div style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--rc-text-secondary)', lineHeight: 1.6, borderBottom: '1px solid var(--rc-divider)' }}>
                  {result.summary}
                </div>

                <div className="rc-scroll" style={{ flex: 1, padding: 16, overflowY: 'auto', maxHeight: 450 }}>
                  {/* Agent 1 Custom PII Layout */}
                  {agentId === 'm1-anonymiser' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rc-text-muted)', textTransform: 'uppercase' }}>Redacted Document Preview:</div>
                        <div style={{ background: 'var(--rc-bg-secondary)', border: '1px solid var(--rc-divider)', borderRadius: 6, padding: 12, fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.5, color: 'var(--rc-text-primary)' }}>
                          {result.redactedText}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rc-text-muted)', textTransform: 'uppercase' }}>Entity Redaction List:</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--rc-divider)', textAlign: 'left', color: 'var(--rc-text-muted)' }}>
                              <th style={{ padding: '6px 4px' }}>Type</th>
                              <th style={{ padding: '6px 4px' }}>Original Value</th>
                              <th style={{ padding: '6px 4px' }}>Anonymised Placeholder</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.entities.map((e: any, idx: number) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--rc-divider)' }}>
                                <td style={{ padding: '8px 4px', fontWeight: 500 }}>{e.type}</td>
                                <td style={{ padding: '8px 4px', color: 'var(--rc-text-secondary)' }}>{e.val}</td>
                                <td style={{ padding: '8px 4px', fontFamily: 'monospace', color: 'var(--rc-primary)' }}>{e.repl}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Agent 2 Custom Summariser Layout */}
                  {agentId === 'm2-summariser' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {result.sections.map((s: any, idx: number) => (
                          <div key={idx} style={{ padding: 12, background: 'var(--rc-bg-secondary)', border: '1px solid var(--rc-divider)', borderRadius: 6 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4, color: 'var(--rc-text-primary)' }}>{s.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--rc-text-secondary)', lineHeight: 1.5 }}>{s.content}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rc-text-muted)', textTransform: 'uppercase' }}>Key Reviewer Takeaways:</div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--rc-text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {result.keyPoints.map((kp: string, idx: number) => (
                            <li key={idx}>{kp}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Agent 3 Custom Completeness Layout */}
                  {agentId === 'm3-completeness' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: 'var(--rc-bg-secondary)', border: '1px solid var(--rc-divider)', borderRadius: 6 }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', border: '4px solid var(--rc-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--rc-orange)', fontSize: 13 }}>
                          {result.score}%
                        </div>
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 600 }}>Completeness Rating</div>
                          <div style={{ fontSize: 11, color: 'var(--rc-text-muted)' }}>Gaps detected in submission modules. Revision recommended.</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {result.gaps.map((gap: any, idx: number) => (
                          <div key={idx} style={{ padding: 12, border: '1px solid var(--rc-divider)', borderRadius: 6, borderLeft: `4px solid ${gap.sev === 'critical' ? 'var(--rc-red)' : gap.sev === 'major' ? 'var(--rc-orange)' : 'var(--rc-primary)'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <span className={`rc-pill ${gap.sev === 'critical' ? 'rc-pill-rejected' : gap.sev === 'major' ? 'rc-pill-review' : 'rc-pill-draft'}`} style={{ textTransform: 'uppercase', fontSize: 9.5 }}>{gap.sev}</span>
                              <span style={{ fontSize: 10.5, color: 'var(--rc-text-muted)' }}>{gap.ref}</span>
                            </div>
                            <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--rc-text-primary)', marginBottom: 4 }}>{gap.desc}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--rc-text-secondary)', lineHeight: 1.5 }}>
                              <strong style={{ color: 'var(--rc-primary)' }}>Remediation:</strong> {gap.rec}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Agent 4 Custom Case Classifier Layout */}
                  {agentId === 'm4-classifier' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div style={{ padding: 10, background: 'var(--rc-bg-secondary)', border: '1px solid var(--rc-divider)', borderRadius: 6 }}>
                          <div style={{ fontSize: 10.5, color: 'var(--rc-text-muted)', textTransform: 'uppercase' }}>Causality Rating</div>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--rc-primary)' }}>{result.causality.split(' ')[0]}</div>
                        </div>
                        <div style={{ padding: 10, background: 'var(--rc-bg-secondary)', border: '1px solid var(--rc-divider)', borderRadius: 6 }}>
                          <div style={{ fontSize: 10.5, color: 'var(--rc-text-muted)', textTransform: 'uppercase' }}>Reporting Deadline</div>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--rc-red)' }}>24 Hours (SUSAR)</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rc-text-muted)', textTransform: 'uppercase' }}>Seriousness Criteria Profile:</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <tbody>
                            {Object.entries(result.criteria).map(([k, v]: any, idx: number) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--rc-divider)' }}>
                                <td style={{ padding: '6px 4px', color: 'var(--rc-text-secondary)' }}>{k}</td>
                                <td style={{ padding: '6px 4px', fontWeight: 600, textAlign: 'right', color: v === 'YES' ? 'var(--rc-red)' : 'var(--rc-text-muted)' }}>{v}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ padding: 12, background: 'var(--rc-bg-secondary)', border: '1px solid var(--rc-divider)', borderRadius: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rc-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Causality Rationale:</div>
                        <div style={{ fontSize: 12, color: 'var(--rc-text-secondary)', lineHeight: 1.5 }}>{result.rationale}</div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rc-text-muted)', textTransform: 'uppercase' }}>Mandatory Pharmacovigilance Actions:</div>
                        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--rc-text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {result.remediations.map((rem: string, idx: number) => (
                            <li key={idx}>{rem}</li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  )}

                  {/* Agent 5 Custom Inspection Report Layout */}
                  {agentId === 'm5-inspection' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, background: 'var(--rc-bg-secondary)', border: '1px solid var(--rc-divider)', borderRadius: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>Compliance Rating:</div>
                        <span className="rc-pill rc-pill-review">{result.rating}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {result.findings.map((f: any, idx: number) => (
                          <div key={idx} style={{ padding: 12, border: '1px solid var(--rc-divider)', borderRadius: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--rc-primary)' }}>{f.id}</span>
                              <span className={`rc-pill ${f.type === 'Critical' ? 'rc-pill-rejected' : f.type === 'Major' ? 'rc-pill-review' : 'rc-pill-draft'}`} style={{ textTransform: 'uppercase', fontSize: 9.5 }}>{f.type}</span>
                            </div>
                            <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--rc-text-primary)', marginBottom: 4 }}>{f.desc}</div>
                            <div style={{ fontSize: 11, color: 'var(--rc-text-muted)', marginBottom: 6 }}>Ref: {f.ref}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--rc-text-secondary)', lineHeight: 1.5, background: 'rgba(26, 86, 219, 0.03)', padding: 8, borderRadius: 4 }}>
                              <strong style={{ color: 'var(--rc-primary)' }}>CAPA Plan:</strong> {f.capa}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Agent 6 Custom Q&A Layout */}
                  {agentId === 'm6-qa' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ padding: 12, background: 'var(--rc-bg-secondary)', border: '1px solid var(--rc-divider)', borderRadius: 6, lineHeight: 1.6, fontSize: 12.5, color: 'var(--rc-text-primary)' }}>
                        {result.answer}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rc-text-muted)', textTransform: 'uppercase' }}>Cited Regulatory Basis:</div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--rc-text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {result.citations.map((cit: string, idx: number) => (
                            <li key={idx} style={{ color: 'var(--rc-primary)', fontWeight: 500 }}>{cit}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Agent 7 Custom Schedule Y Layout */}
                  {agentId === 'm7-scheduley' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: 'var(--rc-bg-secondary)', border: '1px solid var(--rc-divider)', borderRadius: 6 }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', border: '4px solid var(--rc-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--rc-orange)', fontSize: 13 }}>
                          {result.score}%
                        </div>
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 600 }}>Schedule Y Compliance</div>
                          <div style={{ fontSize: 11, color: 'var(--rc-text-muted)' }}>Identified critical non-compliance under Appendix IV.</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rc-red)', textTransform: 'uppercase' }}>Critical Gaps:</div>
                        {result.critical.map((c: string, idx: number) => (
                          <div key={idx} style={{ padding: 10, background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 6, fontSize: 12, color: 'var(--rc-red)', lineHeight: 1.5 }}>
                            {c}
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rc-text-muted)', textTransform: 'uppercase' }}>Major Gaps:</div>
                        {result.major.map((m: string, idx: number) => (
                          <div key={idx} style={{ padding: 10, background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 6, fontSize: 12, color: 'var(--rc-orange)', lineHeight: 1.5 }}>
                            {m}
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rc-text-muted)', textTransform: 'uppercase' }}>Appendix Checklist:</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--rc-divider)', textAlign: 'left', color: 'var(--rc-text-muted)' }}>
                              <th style={{ padding: '6px 4px' }}>Section</th>
                              <th style={{ padding: '6px 4px', textAlign: 'right' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.checklist.map((c: any, idx: number) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--rc-divider)' }}>
                                <td style={{ padding: '8px 4px', color: 'var(--rc-text-primary)' }}>{c.req}</td>
                                <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600, color: c.status === 'Compliant' ? 'var(--rc-green)' : c.status === 'Non-Compliant' ? 'var(--rc-red)' : 'var(--rc-orange)' }}>
                                  {c.status}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Agent 8 Custom ICH GCP Layout */}
                  {agentId === 'm8-ichgcp' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: 'var(--rc-bg-secondary)', border: '1px solid var(--rc-divider)', borderRadius: 6 }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', border: '4px solid var(--rc-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--rc-green)', fontSize: 13 }}>
                          {result.score}%
                        </div>
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 600 }}>ICH E6(R3) Compliance Score</div>
                          <div style={{ fontSize: 11, color: 'var(--rc-text-muted)' }}>Passed with 2 major deviations. Remediation required.</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rc-text-muted)', textTransform: 'uppercase' }}>GCP Deviations:</div>
                        {result.deviations.map((dev: any, idx: number) => (
                          <div key={idx} style={{ padding: 12, border: '1px solid var(--rc-divider)', borderRadius: 6, borderLeft: '4px solid var(--rc-orange)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
                              <span style={{ fontWeight: 600, color: 'var(--rc-orange)' }}>{dev.type}</span>
                              <span style={{ color: 'var(--rc-text-muted)' }}>{dev.ref}</span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--rc-text-secondary)', lineHeight: 1.5 }}>{dev.desc}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rc-text-muted)', textTransform: 'uppercase' }}>Key Recommendations:</div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--rc-text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {result.recommendations.map((rec: string, idx: number) => (
                            <li key={idx}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Agent 9 Custom Cross-Doc Layout */}
                  {agentId === 'm9-crossdoc' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 8, padding: 12, background: 'var(--rc-bg-secondary)', border: '1px solid var(--rc-divider)', borderRadius: 6 }}>
                        <div>
                          <div style={{ fontSize: 10.5, color: 'var(--rc-text-muted)', textTransform: 'uppercase' }}>Consistency Score</div>
                          <div style={{ fontSize: 20, fontWeight: 'bold', color: 'var(--rc-red)' }}>{result.score}%</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>Contradictions Found</div>
                          <div style={{ fontSize: 11, color: 'var(--rc-text-muted)' }}>Mismatches detected between Protocol &amp; ICF.</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rc-text-muted)', textTransform: 'uppercase' }}>Inconsistencies Profile:</div>
                        {result.mismatches.map((m: any, idx: number) => (
                          <div key={idx} style={{ padding: 12, border: '1px solid var(--rc-divider)', borderRadius: 6, borderLeft: `4px solid ${m.severity === 'Critical' ? 'var(--rc-red)' : m.severity === 'Major' ? 'var(--rc-orange)' : 'var(--rc-primary)'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <span className={`rc-pill ${m.severity === 'Critical' ? 'rc-pill-rejected' : 'rc-pill-review'}`} style={{ textTransform: 'uppercase', fontSize: 9.5 }}>{m.severity}</span>
                              <span style={{ fontSize: 10.5, color: 'var(--rc-primary)', fontWeight: 600 }}>{m.category}</span>
                            </div>
                            <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--rc-text-primary)', marginBottom: 4 }}>{m.desc}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, padding: 6, background: 'var(--rc-bg-secondary)', borderRadius: 4, border: '1px solid var(--rc-divider)' }}>
                              <div><strong>{m.docA}:</strong> Dosing/Age/Details</div>
                              <div><strong>{m.docB}:</strong> Mismatched text</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rc-text-muted)', textTransform: 'uppercase' }}>Consistency Matrix:</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--rc-divider)', textAlign: 'left', color: 'var(--rc-text-muted)' }}>
                              <th style={{ padding: '6px 4px' }}>Document Pair</th>
                              <th style={{ padding: '6px 4px', textAlign: 'right' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.matrix.map((item: any, idx: number) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--rc-divider)' }}>
                                <td style={{ padding: '8px 4px', color: 'var(--rc-text-primary)' }}>{item.pair}</td>
                                <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600, color: item.status === 'Consistent' ? 'var(--rc-green)' : 'var(--rc-red)' }}>
                                  {item.status} ({item.count})
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ padding: '10px 16px', fontSize: 11, color: 'var(--rc-text-muted)', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--rc-divider)', background: 'var(--rc-bg-secondary)', borderBottomLeftRadius: 6, borderBottomRightRadius: 6 }}>
                  <i className="ti ti-info-circle"/>
                  AI-generated simulation. All findings must be reviewed by qualified RA professionals before submission to CDSCO.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes rc-spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
