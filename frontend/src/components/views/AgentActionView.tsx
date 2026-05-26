'use client'

import { useState } from 'react'
import { useWorkspace } from '@/lib/workspaceStore'
import PageHeader from '@/components/veeva/PageHeader'
import FileUpload from '@/components/FileUpload'
import { AgentResultPanel } from '@/components/AgentResultPanel'
import { AgentStatusBar } from '@/components/AgentStatusBar'
import { useAgent } from '@/hooks/useAgent'
import {
  runAnonymiser,
  runSummariser,
  runCompletenessCheck,
  runCaseClassifier,
  runInspectionReport,
  runRegulatoryQA,
  runScheduleYCheck,
  runICHGCP,
  runCrossDocCheck,
} from '@/lib/api'

interface AgentMeta {
  id: string
  title: string
  framework: string
  icon: string
  description: string
  inputLabel: string
  sampleFileName: string
  sampleText: string
  runLabel: string
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
    runLabel: 'Run Anonymisation →',
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
    runLabel: 'Run Summarisation →',
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
    runLabel: 'Run Completeness Check →',
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
    runLabel: 'Run Case Classification →',
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
    runLabel: 'Generate Inspection Report →',
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
    runLabel: 'Get Answer →',
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
    runLabel: 'Run Schedule Y Check →',
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
    runLabel: 'Run ICH GCP Check →',
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
    runLabel: 'Run Cross-Doc Check →',
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

  // File-based agents state
  const [file, setFile] = useState<File | null>(null)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)

  // Cross-doc agent state
  const [fileA, setFileA] = useState<File | null>(null)
  const [fileB, setFileB] = useState<File | null>(null)
  const [uploadedFileA, setUploadedFileA] = useState<string | null>(null)
  const [uploadedFileB, setUploadedFileB] = useState<string | null>(null)

  // Q&A agent state
  const [question, setQuestion] = useState('')

  // Use sample state (for display in file upload component)
  const [sampleMode, setSampleMode] = useState(false)

  const { status, result, error, execute, reset } = useAgent()

  const isRunning = status === 'waking' || status === 'extracting' || status === 'running'
  const isDone = status === 'done'

  // ── Run handler ──────────────────────────────────────────────────────────

  const handleRun = async () => {
    if (agentId === 'm6-qa') {
      // Q&A: no file, pass question directly
      if (!question.trim()) return
      await execute({
        file: null,
        run: () => runRegulatoryQA(question, question),
      })
    } else if (agentId === 'm9-crossdoc') {
      // Cross-doc: send both files directly as multipart
      if (!fileA || !fileB) return
      await execute({
        file: null,
        run: async () => runCrossDocCheck([fileA, fileB]),
      })
    } else {
      // All other text-based agents: extract text then run
      const activeFile = sampleMode ? null : file
      if (!activeFile && !sampleMode) return

      await execute({
        file: activeFile,
        run: (text) => {
          const docText = sampleMode ? agent.sampleText : text
          const meta = activeFile
            ? { filename: activeFile.name, file_size: activeFile.size }
            : { filename: agent.sampleFileName }

          switch (agentId) {
            case 'm1-anonymiser': return runAnonymiser(docText, meta)
            case 'm2-summariser': return runSummariser(docText, meta)
            case 'm3-completeness': return runCompletenessCheck(docText, 'GENERAL', meta)
            case 'm4-classifier': return runCaseClassifier(docText, meta)
            case 'm5-inspection': return runInspectionReport(docText, meta)
            case 'm7-scheduley': return runScheduleYCheck(docText, meta)
            case 'm8-ichgcp': return runICHGCP(docText, meta)
            default: return runCompletenessCheck(docText, 'GENERAL', meta)
          }
        },
      })
    }
  }

  // ── Sample handler ────────────────────────────────────────────────────────

  const handleUseSample = () => {
    setSampleMode(true)
    reset()
    if (agentId === 'm6-qa') {
      setQuestion(agent.sampleText)
    } else if (agentId === 'm9-crossdoc') {
      setUploadedFileA('ZP-101_Protocol_v2.1.pdf')
      setUploadedFileB('ZP-101_ICF_English_v1.4.pdf')
      // For sample mode on cross-doc, we can't truly send real files
      // so we skip the sample — the user needs to upload actual files for M9
    } else {
      setUploadedFileName(agent.sampleFileName)
    }
  }

  // ── Clear handler ─────────────────────────────────────────────────────────

  const handleClear = () => {
    setFile(null)
    setFileA(null)
    setFileB(null)
    setUploadedFileName(null)
    setUploadedFileA(null)
    setUploadedFileB(null)
    setQuestion('')
    setSampleMode(false)
    reset()
  }

  // ── Disabled state ────────────────────────────────────────────────────────

  const isRunDisabled =
    isRunning ||
    isDone ||
    (agentId === 'm6-qa' && !question.trim()) ||
    (agentId === 'm9-crossdoc' && (!fileA || !fileB)) ||
    (agentId !== 'm6-qa' && agentId !== 'm9-crossdoc' && !file && !sampleMode)

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
            <button
              className="rc-btn"
              onClick={handleUseSample}
              disabled={isRunning}
              data-testid="agent-sample-btn"
            >
              <i className="ti ti-clipboard" /> Use sample
            </button>
            <button className="rc-btn" onClick={handleClear} disabled={isRunning}>
              <i className="ti ti-rotate" /> Reset
            </button>
            <button
              className="rc-btn rc-btn-primary"
              disabled={isRunDisabled}
              onClick={handleRun}
              data-testid="agent-run-btn"
            >
              <i className={`ti ${isRunning ? 'ti-loader-2 animate-spin' : 'ti-sparkles'}`} />
              {isRunning ? 'Running…' : agent.runLabel}
            </button>
          </>
        }
      />

      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        {/* ── Left: Input Panel ── */}
        <div className="rc-card">
          <div className="rc-card-header">
            <span>{agent.inputLabel}</span>
            {agentId === 'm6-qa' && (
              <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--rc-text-muted)' }}>
                {question.split(/\s+/).filter(Boolean).length} words
              </span>
            )}
          </div>
          <div className="rc-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 12, color: 'var(--rc-text-muted)', margin: '0 0 10px', lineHeight: 1.6 }}>
              {agent.description}
            </p>

            {/* Q&A text input */}
            {agentId === 'm6-qa' && (
              <>
                <textarea
                  className="rc-textarea"
                  placeholder="Ask a question about Schedule Y, NDCTR 2019, or clinical trial guidelines..."
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  style={{ minHeight: 180 }}
                  data-testid="agent-input"
                  disabled={isRunning}
                />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rc-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Quick Queries:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {QA_CHIPS.map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setQuestion(chip); setSampleMode(false) }}
                        disabled={isRunning}
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
            )}

            {/* Cross-doc: two side-by-side zones */}
            {agentId === 'm9-crossdoc' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rc-text-muted)', marginBottom: 6 }}>
                    Document 1 (e.g. Protocol)
                  </div>
                  <FileUpload
                    onTextExtracted={(_, filename) => setUploadedFileA(filename)}
                    onFileSelect={(f) => { setFileA(f); setSampleMode(false) }}
                    onError={() => {}}
                    uploadedFileName={uploadedFileA}
                    disabled={isRunning}
                    label="Upload Protocol"
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rc-text-muted)', marginBottom: 6 }}>
                    Document 2 (e.g. ICF)
                  </div>
                  <FileUpload
                    onTextExtracted={(_, filename) => setUploadedFileB(filename)}
                    onFileSelect={(f) => { setFileB(f); setSampleMode(false) }}
                    onError={() => {}}
                    uploadedFileName={uploadedFileB}
                    disabled={isRunning}
                    label="Upload ICF"
                  />
                </div>
              </div>
            )}

            {/* All other agents: single upload zone */}
            {agentId !== 'm6-qa' && agentId !== 'm9-crossdoc' && (
              <FileUpload
                onTextExtracted={(_, filename) => setUploadedFileName(filename)}
                onFileSelect={(f) => { setFile(f); setSampleMode(false); setUploadedFileName(f.name) }}
                onError={() => {}}
                uploadedFileName={uploadedFileName}
                disabled={isRunning}
                label={agent.inputLabel}
              />
            )}

            {/* Status bar: shows during waking/extracting/running/error */}
            <AgentStatusBar status={status} error={error} />
          </div>
        </div>

        {/* ── Right: Result Panel ── */}
        <div className="rc-card" style={{ overflow: 'hidden' }}>
          <div className="rc-card-header">
            <span>Compliance Findings</span>
          </div>
          <div style={{ minHeight: 320, display: 'flex', flexDirection: 'column' }}>
            {/* Empty state */}
            {status === 'idle' && (
              <div className="rc-empty" style={{ flex: 1 }}>
                <i className="ti ti-circle-dashed" style={{ fontSize: 24, color: 'var(--rc-text-muted)', marginBottom: 8 }} />
                <div style={{ fontSize: 12.5, color: 'var(--rc-text-muted)' }}>
                  Load a file and run analysis to see compliance findings.
                </div>
              </div>
            )}

            {/* Running / waking / extracting state */}
            {(status === 'waking' || status === 'extracting' || status === 'running') && (
              <div className="rc-empty" style={{ flex: 1 }}>
                <i className="ti ti-loader-2 animate-spin" style={{ fontSize: 28, color: 'var(--rc-primary)', marginBottom: 12 }} />
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  {status === 'waking' ? 'Waking up backend…' : status === 'extracting' ? 'Extracting document text…' : `Running ${agent.title}…`}
                </div>
                <div style={{ fontSize: 11, color: 'var(--rc-text-muted)', marginTop: 4 }}>
                  {status === 'waking'
                    ? 'Render free tier can take up to 60s on cold start.'
                    : 'Calling live AI agent — this may take 15–30s for large documents.'}
                </div>
              </div>
            )}

            {/* Error state */}
            {status === 'error' && (
              <div className="rc-empty" style={{ flex: 1 }}>
                <i className="ti ti-alert-triangle" style={{ fontSize: 28, color: 'var(--rc-red)', marginBottom: 12 }} />
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--rc-red)' }}>Analysis failed</div>
                <div style={{ fontSize: 11, color: 'var(--rc-text-muted)', marginTop: 4, maxWidth: 300, textAlign: 'center', lineHeight: 1.5 }}>
                  {error || 'Unknown error'}. If the backend is sleeping, wait 60s and try again.
                </div>
              </div>
            )}

            {/* Result panel */}
            {status === 'done' && result && (
              <AgentResultPanel
                result={result}
                agentName={agent.title}
                agentId={agentId}
                filename={
                  agentId === 'm9-crossdoc'
                    ? `${uploadedFileA} + ${uploadedFileB}`
                    : agentId === 'm6-qa'
                    ? undefined
                    : uploadedFileName ?? undefined
                }
                onReset={() => {
                  reset()
                  setFile(null)
                  setFileA(null)
                  setFileB(null)
                  setUploadedFileName(null)
                  setUploadedFileA(null)
                  setUploadedFileB(null)
                  setQuestion('')
                  setSampleMode(false)
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
