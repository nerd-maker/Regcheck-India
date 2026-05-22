'use client'

import { useState } from 'react'
import { useWorkspace } from '@/lib/workspaceStore'
import PageHeader from '@/components/veeva/PageHeader'

interface AgentMeta {
  id: string
  title: string
  framework: string
  icon: string
  description: string
  inputLabel: string
  inputPlaceholder: string
  sample: string
}

const AGENTS: Record<string, AgentMeta> = {
  'm1-anonymiser': {
    id: 'm1-anonymiser', title: 'PII Anonymiser', framework: 'DPDP Act 2023 · Schedule Y', icon: 'ti-shield-check',
    description: 'Detect and redact patient, investigator, and sponsor PII per DPDP Act 2023. Outputs JSON with entity list and a redacted document.',
    inputLabel: 'Document text', inputPlaceholder: 'Paste protocol, ICF, narrative, or any document containing PII…',
    sample: 'Investigator: Dr. Priya Menon, MD, PAN: ABCDE1234F. Patient: Ramesh Iyer, DOB 12-Mar-1979, Aadhaar XXXX-XXXX-1234, residing at 14 Brigade Rd, Bengaluru-560001.',
  },
  'm2-summariser': {
    id: 'm2-summariser', title: 'Document Summariser', framework: 'CDSCO · ICH', icon: 'ti-file-description',
    description: 'Precis-style summary with section-level highlights and regulatory citations.',
    inputLabel: 'Document text', inputPlaceholder: 'Paste protocol, SUGAM application, SAE narrative, or meeting transcript…',
    sample: 'Protocol ZP-101: A randomised, double-blind, placebo-controlled Phase II trial evaluating the efficacy and safety of ZP-101 in adult subjects with Type 2 Diabetes Mellitus. Primary endpoint: change in HbA1c from baseline at Week 24…',
  },
  'm3-completeness': {
    id: 'm3-completeness', title: 'Completeness Checker', framework: 'CDSCO · NDCTR 2019 · ICH E6(R3)', icon: 'ti-checklist',
    description: 'Validate documents against CDSCO, NDCTR 2019, and ICH requirements. Flags gaps as CRITICAL / MAJOR / MINOR.',
    inputLabel: 'Document text', inputPlaceholder: 'Paste protocol, ICF, IB, or CSR…',
    sample: 'Phase II Protocol — ZP-101…',
  },
  'm4-classifier': {
    id: 'm4-classifier', title: 'Case Classifier', framework: 'ICH E2A · WHO-UMC · NDCTR 2019', icon: 'ti-alert-triangle',
    description: 'Classify adverse events using ICH E2A seriousness criteria, WHO-UMC causality, and NDCTR 2019 timelines.',
    inputLabel: 'SAE narrative', inputPlaceholder: 'Paste full SAE / CT-04 narrative…',
    sample: 'A 47-year-old male subject (SAE-2025-0089) developed anaphylactic shock approximately 12 minutes after the second IV dose of BX-400 (400 mg/m²)…',
  },
  'm5-inspection': {
    id: 'm5-inspection', title: 'Inspection Report Generator', framework: 'CDSCO GCP · Schedule Y', icon: 'ti-report',
    description: 'Generate CDSCO GCP inspection report with CAPA plans, observation classification, and Schedule Y citations.',
    inputLabel: 'Inspection observations', inputPlaceholder: 'Enter site name, inspection date, and observation notes…',
    sample: 'Site: Apollo Hospitals, Chennai · Inspection: 18-Oct-2025 · Observations: (1) ICF v1.3 used though v1.4 is the current approved version…',
  },
  'm6-qa': {
    id: 'm6-qa', title: 'Regulatory Q&A', framework: 'NDCTR 2019 · Schedule Y · ICH · ICMR', icon: 'ti-message-question',
    description: 'RAG-powered assistant grounded in NDCTR 2019, Schedule Y, ICH guidelines, and ICMR ethics corpus.',
    inputLabel: 'Your question', inputPlaceholder: 'e.g. What is the CDSCO reporting timeline for an SUSAR in a paediatric study?',
    sample: 'What are the CDSCO timelines for reporting an SAE in a Phase II clinical trial in India?',
  },
  'm7-scheduley': {
    id: 'm7-scheduley', title: 'Schedule Y Deep Check', framework: 'Schedule Y · NDCTR 2019 Rules 1–105', icon: 'ti-scale',
    description: 'Deep compliance checks across Schedule Y Appendices I–XI and NDCTR 2019 Rules.',
    inputLabel: 'Document text', inputPlaceholder: 'Paste protocol or CMC/CTA package…',
    sample: 'Clinical Trial Application — Phase II — ZP-101 in Type 2 Diabetes…',
  },
  'm8-ichgcp': {
    id: 'm8-ichgcp', title: 'ICH E6(R3) GCP Compliance', framework: 'ICH E6(R3)', icon: 'ti-certificate-2',
    description: 'Full GCP evaluation against ICH E6(R3) including R3-specific QMS and Risk-Based Monitoring requirements.',
    inputLabel: 'Document text', inputPlaceholder: 'Paste protocol, monitoring plan, or QMS document…',
    sample: 'Risk-Based Monitoring Plan v1.1 for ZP-101 Phase II study…',
  },
  'm9-crossdoc': {
    id: 'm9-crossdoc', title: 'Cross-Document Consistency', framework: 'CDSCO · ICH', icon: 'ti-files',
    description: 'Upload Protocol, ICF, IB, and SAE reports simultaneously. AI detects contradictions and mismatches across all documents.',
    inputLabel: 'Documents', inputPlaceholder: 'Drag PDF / DOCX files here, or click to browse…',
    sample: '(Demo) — drop 2-4 documents from the same submission to detect dose, eligibility, endpoint and date mismatches.',
  },
}

export default function AgentActionView({ agentId }: { agentId: string }) {
  const { setActiveView } = useWorkspace()
  const agent = AGENTS[agentId] ?? AGENTS['m3-completeness']
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<null | { headline: string; summary: string; findings: { sev: 'critical' | 'major' | 'minor'; framework: string; finding: string; recommendation: string }[] }>(null)

  const runMock = () => {
    setRunning(true)
    setResult(null)
    setTimeout(() => {
      setRunning(false)
      setResult({
        headline: 'Analysis complete — 4 findings detected',
        summary: `${agent.title} review against ${agent.framework} returned 4 findings: 1 critical, 2 major, 1 minor. All findings include regulatory citations and AI-suggested remediations.`,
        findings: [
          { sev: 'critical', framework: 'Schedule Y · Appendix III §4',  finding: 'Dose justification for paediatric subgroup is missing.', recommendation: 'Add a paediatric dose rationale referencing the Phase I PK/PD data and the model-informed dosing analysis (Section 5.2).' },
          { sev: 'major',    framework: 'ICH E6(R3) §7.1.4',             finding: 'Risk-based monitoring plan does not define site visit triggers.', recommendation: 'Define quantitative triggers (e.g. >10% protocol deviations, >2 SAEs in 30 days) per ICH E6(R3) §7.1.4 (b).' },
          { sev: 'major',    framework: 'NDCTR 2019 · Rule 33',          finding: 'CTRI registration number is not referenced in the cover letter.', recommendation: 'Add CTRI/2025/03/072314 to the cover letter header and the Section 1.1 of the protocol.' },
          { sev: 'minor',    framework: 'CDSCO Submission Guidance 2024', finding: 'Submission section numbering does not follow the CDSCO eCTD-lite template.', recommendation: 'Renumber sections to match Module 1 / 2 / 3 of CDSCO eCTD-lite v1.0.' },
        ],
      })
    }, 1100)
  }

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
            <button className="rc-btn" onClick={() => setInput(agent.sample)} data-testid="agent-sample-btn"><i className="ti ti-clipboard"/> Use sample</button>
            <button className="rc-btn"><i className="ti ti-history"/> History</button>
            <button className="rc-btn rc-btn-primary" disabled={running || (!input && agentId !== 'm9-crossdoc')} onClick={runMock} data-testid="agent-run-btn">
              <i className={`ti ${running ? 'ti-loader-2' : 'ti-sparkles'}`}/> {running ? 'Running…' : 'Run Analysis'}
            </button>
          </>
        }
      />

      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <div className="rc-card">
          <div className="rc-card-header">
            <span>{agent.inputLabel}</span>
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--rc-text-muted)' }}>{input.split(/\s+/).filter(Boolean).length} words</span>
          </div>
          <div className="rc-card-body">
            <p style={{ fontSize: 12, color: 'var(--rc-text-muted)', margin: '0 0 10px', lineHeight: 1.6 }}>{agent.description}</p>
            {agentId === 'm9-crossdoc' ? (
              <div style={{ border: '2px dashed var(--rc-border-strong)', borderRadius: 8, padding: 32, textAlign: 'center', color: 'var(--rc-text-muted)' }}>
                <i className="ti ti-cloud-upload" style={{ fontSize: 28, display: 'block', marginBottom: 8 }}/>
                <div style={{ fontSize: 13 }}>Drag PDF or DOCX files here, or click to browse (mocked in this build)</div>
              </div>
            ) : (
              <textarea
                className="rc-textarea"
                placeholder={agent.inputPlaceholder}
                value={input}
                onChange={e => setInput(e.target.value)}
                style={{ minHeight: 220 }}
                data-testid="agent-input"
              />
            )}
          </div>
        </div>

        <div className="rc-card">
          <div className="rc-card-header">
            <span>Result</span>
            {result && <button className="rc-btn rc-btn-ghost rc-btn-sm"><i className="ti ti-file-export"/> Export JSON</button>}
          </div>
          <div style={{ minHeight: 320 }}>
            {!result && !running && (
              <div className="rc-empty"><i className="ti ti-circle-dashed"/><div style={{ fontSize: 12 }}>Run analysis to see findings, citations, and AI recommendations.</div></div>
            )}
            {running && (
              <div className="rc-empty">
                <i className="ti ti-loader-2" style={{ animation: 'rc-spin 1s linear infinite' }}/>
                <div style={{ fontSize: 12 }}>Running {agent.title}… cross-referencing regulatory corpus.</div>
              </div>
            )}
            {result && (
              <div>
                <div style={{ padding: '14px 16px', background: 'var(--rc-effective-bg)', color: 'var(--rc-effective)', fontSize: 12.5, fontWeight: 500, borderBottom: '1px solid var(--rc-divider)' }}>
                  <i className="ti ti-circle-check" style={{ marginRight: 6 }}/>{result.headline}
                </div>
                <div style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--rc-text-secondary)', lineHeight: 1.6, borderBottom: '1px solid var(--rc-divider)' }}>{result.summary}</div>
                <div>
                  {result.findings.map((f, i) => (
                    <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid var(--rc-divider)' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                        <span className={`rc-pill ${f.sev === 'critical' ? 'rc-pill-rejected' : f.sev === 'major' ? 'rc-pill-review' : 'rc-pill-draft'}`} style={{ textTransform: 'uppercase', fontSize: 9.5 }}>{f.sev}</span>
                        <span style={{ fontSize: 11, color: 'var(--rc-text-muted)' }}>{f.framework}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--rc-text-primary)', marginBottom: 4 }}>{f.finding}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--rc-text-secondary)', lineHeight: 1.6 }}><strong style={{ color: 'var(--rc-primary)' }}>Recommendation: </strong>{f.recommendation}</div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '10px 16px', fontSize: 11, color: 'var(--rc-text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="ti ti-info-circle"/>
                  AI-generated. All findings must be reviewed by qualified RA professionals before submission to CDSCO.
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
