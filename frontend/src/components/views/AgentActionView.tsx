'use client'

import { useState, useEffect } from 'react'
import { useWorkspace } from '@/lib/workspaceStore'
import { saveToHistory } from '@/services/history'
import PageHeader from '@/components/veeva/PageHeader'
import {
  runPIIAnonymiser,
  runDocumentSummariser,
  runCompletenessAssessor,
  runCaseClassifier,
  runInspectionReportGenerator,
  runRegulatoryQA,
  runScheduleYCompliance,
  runICHGCPChecker,
  crossDocumentCheck,
  getStoredKey,
  getRawStoredKey,
} from '@/services/api'
import { GapRemediationPanel } from '@/components/GapRemediationPanel'
import { parseGapsFromResult } from '@/utils/parseGaps'

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
    sample: 'Protocol ZP-101: A randomised, double-blind, placebo-controlled Phase II trial evaluating the efficacy and safety of ZP-101 in adult subjects with Type 2 Diabetes Mellitus. Primary endpoint: change in HbA1c from baseline at Week 24. Secondary endpoints: fasting plasma glucose, body weight, lipid profile. Sample size 300 subjects (1:1 randomisation). Treatment duration: 24 weeks with 4-week follow-up. Inclusion: adults 18-75y, HbA1c 7.0-10.5%, on stable metformin >=12 weeks. Exclusion: eGFR <45, prior insulin therapy, history of pancreatitis. Investigational product: ZP-101 oral tablet 400 mg once daily.',
  },
  'm3-completeness': {
    id: 'm3-completeness', title: 'Completeness Checker', framework: 'CDSCO · NDCTR 2019 · ICH E6(R3)', icon: 'ti-checklist',
    description: 'Validate documents against CDSCO, NDCTR 2019, and ICH requirements. Flags gaps as CRITICAL / MAJOR / MINOR.',
    inputLabel: 'Document text', inputPlaceholder: 'Paste protocol, ICF, IB, or CSR…',
    sample: 'Phase II Protocol — ZP-101 in Type 2 Diabetes. Section 1 Introduction. Section 2 Objectives: primary - change in HbA1c at Week 24. Section 3 Study Design: randomised double-blind. Section 4 Eligibility Criteria. Section 5 Treatment: ZP-101 400 mg OD vs placebo. Section 6 Assessments: HbA1c, FPG, lipids at every visit. Section 7 Statistical Analysis. Section 8 Safety: AE/SAE reporting. Sponsor: Zephyr Pharma Pvt Ltd. Investigator: Dr. Priya Menon. CTRI registration pending.',
  },
  'm4-classifier': {
    id: 'm4-classifier', title: 'Case Classifier', framework: 'ICH E2A · WHO-UMC · NDCTR 2019', icon: 'ti-alert-triangle',
    description: 'Classify adverse events using ICH E2A seriousness criteria, WHO-UMC causality, and NDCTR 2019 timelines.',
    inputLabel: 'SAE narrative', inputPlaceholder: 'Paste full SAE / CT-04 narrative…',
    sample: 'A 47-year-old male subject (SAE-2025-0089) developed anaphylactic shock approximately 12 minutes after the second IV dose of BX-400 (400 mg/m²). Symptoms included generalised urticaria, hypotension (BP 70/40), tachycardia (HR 140), bronchospasm and laryngeal oedema. Subject was treated with IM adrenaline 0.5 mg, IV hydrocortisone 200 mg, IV chlorpheniramine 10 mg, and high-flow oxygen. Subject required overnight ICU admission and was discharged after 36 hours. Investigator assessment: causality - probable; outcome - recovered; seriousness - life threatening; expectedness - unexpected (not listed in IB v2.1).',
  },
  'm5-inspection': {
    id: 'm5-inspection', title: 'Inspection Report Generator', framework: 'CDSCO GCP · Schedule Y', icon: 'ti-report',
    description: 'Generate CDSCO GCP inspection report with CAPA plans, observation classification, and Schedule Y citations.',
    inputLabel: 'Inspection observations', inputPlaceholder: 'Enter site name, inspection date, and observation notes…',
    sample: 'Site: Apollo Hospitals, Chennai. Inspection date: 18-Oct-2025. Inspector: Dr. R. Kumar (CDSCO). Observations: (1) ICF v1.3 used though v1.4 is the current approved version - 4 subjects consented on old form. (2) Investigator brochure updates not communicated to all sub-investigators within 14 days. (3) Investigational product temperature log shows two excursions (28°C for 6 hours on 03-Sep, 32°C for 2 hours on 11-Sep) without deviation reports. (4) Source data verification not performed for 2 randomised subjects. (5) AE/SAE log incomplete - 3 mild AEs not captured in CRF. Subjects randomised so far: 28. Site personnel interviewed: PI, 2 sub-Is, study coordinator, pharmacist.',
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
    sample: 'Clinical Trial Application — Phase II — ZP-101 in Type 2 Diabetes. Sponsor: Zephyr Pharma Pvt Ltd. Investigational product: ZP-101 400 mg OD oral tablet. Sites: 12 across India. Number of subjects: 300. Comparator: matched placebo. Primary endpoint: HbA1c change at Week 24. Schedule Y Appendix I (chemical, pharmaceutical and biological information) attached. Schedule Y Appendix III (animal pharmacology and toxicology) attached. Schedule Y Appendix VI (Form 12) submitted. Insurance: as per Rule 39, INR 75 lakhs per subject per injury. Compensation: as per Rule 42. Free medical management per Rule 41.',
  },
  'm8-ichgcp': {
    id: 'm8-ichgcp', title: 'ICH E6(R3) GCP Compliance', framework: 'ICH E6(R3)', icon: 'ti-certificate-2',
    description: 'Full GCP evaluation against ICH E6(R3) including R3-specific QMS and Risk-Based Monitoring requirements.',
    inputLabel: 'Document text', inputPlaceholder: 'Paste protocol, monitoring plan, or QMS document…',
    sample: 'Risk-Based Monitoring Plan v1.1 for ZP-101 Phase II study. Critical data identified: HbA1c (primary endpoint), AE/SAE, IP accountability, randomisation integrity, ICF compliance. Centralised monitoring (statistical surveillance) used for primary endpoint. On-site monitoring frequency: every 8 weeks for sites with >10 subjects, every 12 weeks for sites with <10 subjects. Triggers for additional site visits: protocol deviations >10% per visit, >2 SAEs in 30 days, screen failure rate >40%, missing data >5%. Quality Management System: data quality KPIs reviewed monthly. Issue management: documented in trial master file. Vendor oversight: weekly QC reports from CRO.',
  },
  'm9-crossdoc': {
    id: 'm9-crossdoc', title: 'Cross-Document Consistency', framework: 'CDSCO · ICH', icon: 'ti-files',
    description: 'Upload Protocol, ICF, IB, and SAE reports simultaneously. AI detects contradictions and mismatches across all documents.',
    inputLabel: 'Documents', inputPlaceholder: 'Drag PDF / DOCX files here, or click to browse…',
    sample: '',
  },
}

type ResultState =
  | { kind: 'idle' }
  | { kind: 'loading'; elapsedMs: number }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; data: any }

export default function AgentActionView({ agentId }: { agentId: string }) {
  const { setActiveView, consumePrefilledInput, selectedSubmissionId } = useWorkspace()
  const agent = AGENTS[agentId] ?? AGENTS['m3-completeness']
  const [input, setInput] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [result, setResult] = useState<ResultState>({ kind: 'idle' })

  // Pre-fill the input when this view is launched from the Inspector
  // "Compliance Actions" panel on a document / submission.
  useEffect(() => {
    const text = consumePrefilledInput()
    if (text) setInput(text)
  }, [agentId, consumePrefilledInput])

  const run = async () => {
    setResult({ kind: 'loading', elapsedMs: 0 })
    const startedAt = Date.now()
    const timer = setInterval(() => {
      setResult(s => s.kind === 'loading' ? { kind: 'loading', elapsedMs: Date.now() - startedAt } : s)
    }, 250)

    try {
      let data: any
      switch (agent.id) {
        case 'm1-anonymiser':   data = await runPIIAnonymiser(input);          break
        case 'm2-summariser':   data = await runDocumentSummariser(input);     break
        case 'm3-completeness': data = await runCompletenessAssessor(input, 'GENERAL'); break
        case 'm4-classifier':   data = await runCaseClassifier(input);          break
        case 'm5-inspection':   data = await runInspectionReportGenerator(input); break
        case 'm6-qa':           data = await runRegulatoryQA(input);            break
        case 'm7-scheduley':    data = await runScheduleYCompliance(input);     break
        case 'm8-ichgcp':       data = await runICHGCPChecker(input);           break
        case 'm9-crossdoc':
          if (files.length < 2) throw new Error('Please upload at least 2 documents to compare.')
          data = await crossDocumentCheck(files)
          break
        default: throw new Error('Unknown agent')
      }
      setResult({ kind: 'ok', data })
      // Save run to persistent history (fire-and-forget — doesn't block UI)
      saveToHistory(
        agent.title,
        agent.id,
        agent.id === 'm9-crossdoc'
          ? files.map(f => f.name).join(', ')
          : input,
        data,
        {
          filename: agent.id === 'm9-crossdoc'
            ? files[0]?.name
            : undefined,
          submissionId: selectedSubmissionId || undefined,
        }
      ).catch(() => { /* history save errors are non-blocking */ })
    } catch (e: any) {
      setResult({ kind: 'error', message: e?.message || 'Request failed.' })
    } finally {
      clearInterval(timer)
    }
  }

  const hasKey = typeof window !== 'undefined' && getRawStoredKey().length > 0
  const wordCount = input.split(/\s+/).filter(Boolean).length
  const canRun = result.kind !== 'loading'
    && (agent.id === 'm9-crossdoc' ? files.length >= 2 : wordCount >= 5)

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
            {agent.id !== 'm9-crossdoc' && (
              <button className="rc-btn" onClick={() => setInput(agent.sample)} data-testid="agent-sample-btn">
                <i className="ti ti-clipboard"/> Use sample
              </button>
            )}
            <button
              className="rc-btn rc-btn-primary"
              disabled={!canRun}
              onClick={run}
              data-testid="agent-run-btn"
            >
              <i className={`ti ${result.kind === 'loading' ? 'ti-loader-2 spin' : 'ti-sparkles'}`}/>
              {result.kind === 'loading' ? 'Running…' : 'Run Analysis'}
            </button>
          </>
        }
      />

      {!hasKey && (
        <div style={{ padding: '12px 24px 0' }}>
          <div className="rc-banner rc-banner-info" data-testid="api-key-banner">
            <i className="ti ti-info-circle" style={{ fontSize: 16 }}/>
            <div style={{ flex: 1 }}>
              <strong>Using server-side key.</strong> No personal Anthropic key set — running against the vault&apos;s shared key. Add your own in Settings → API &amp; Vaults for per-user rate limiting and audit attribution.
            </div>
            <button className="rc-btn rc-btn-sm" onClick={() => setActiveView('apikeys')}>Configure</button>
          </div>
        </div>
      )}

      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        {/* Input */}
        <div className="rc-card">
          <div className="rc-card-header">
            <span>{agent.inputLabel}</span>
            {agent.id !== 'm9-crossdoc' && (
              <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--rc-text-muted)' }}>
                {wordCount} words {wordCount > 0 && wordCount < 5 && <span style={{ color: 'var(--rc-rejected)' }}> · min 5</span>}
              </span>
            )}
          </div>
          <div className="rc-card-body">
            <p style={{ fontSize: 12, color: 'var(--rc-text-muted)', margin: '0 0 10px', lineHeight: 1.6 }}>{agent.description}</p>
            {agent.id === 'm9-crossdoc' ? (
              <FileDropzone files={files} setFiles={setFiles}/>
            ) : (
              <textarea
                className="rc-textarea"
                placeholder={agent.inputPlaceholder}
                value={input}
                onChange={e => setInput(e.target.value)}
                style={{ minHeight: 240 }}
                data-testid="agent-input"
              />
            )}
          </div>
        </div>

        {/* Result */}
        <div className="rc-card">
          <div className="rc-card-header">
            <span>Result</span>
            {result.kind === 'ok' && (
              <button
                className="rc-btn rc-btn-ghost rc-btn-sm"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = `${agent.id}-${Date.now()}.json`; a.click()
                  URL.revokeObjectURL(url)
                }}
                data-testid="agent-export-btn"
              >
                <i className="ti ti-file-export"/> Export JSON
              </button>
            )}
          </div>
          <div style={{ minHeight: 360 }}>
            {result.kind === 'idle' && (
              <div className="rc-empty" data-testid="result-idle">
                <i className="ti ti-circle-dashed"/>
                <div style={{ fontSize: 12 }}>Run analysis to see findings, citations, and AI recommendations.</div>
              </div>
            )}
            {result.kind === 'loading' && (
              <div className="rc-empty" data-testid="result-loading">
                <i className="ti ti-loader-2 spin"/>
                <div style={{ fontSize: 12 }}>Running {agent.title}… <span style={{ color: 'var(--rc-text-muted)', fontFamily: 'var(--rc-font-mono)' }}>{(result.elapsedMs / 1000).toFixed(1)}s</span></div>
                <div style={{ fontSize: 11, color: 'var(--rc-text-muted)', marginTop: 6 }}>
                  Cold-start can take up to 90s on first request after idle.
                </div>
              </div>
            )}
            {result.kind === 'error' && (
              <div style={{ padding: 16 }}>
                <div className="rc-banner rc-banner-error" data-testid="result-error">
                  <i className="ti ti-alert-circle" style={{ fontSize: 16 }}/>
                  <div style={{ flex: 1 }}>
                    <strong>Analysis failed.</strong>
                    <div style={{ fontSize: 12, marginTop: 4, color: 'var(--rc-rejected)' }}>{result.message}</div>
                  </div>
                </div>
              </div>
            )}
            {result.kind === 'ok' && <AgentResultRenderer data={result.data} agentId={agent.id}/>}
          </div>
        </div>
      </div>

      {result.kind === 'ok' && (
        <div style={{ padding: '0 24px 24px' }}>
          <GapRemediationPanel
            submissionId={selectedSubmissionId ?? undefined}
            agentId={agentId}
            agentName={agent.title}
            pendingGaps={parseGapsFromResult(result.data)}
          />
        </div>
      )}
    </div>
  )
}

// ─── Result renderer ─────────────────────────────────────────────────────────
function AgentResultRenderer({ data, agentId }: { data: any; agentId: string }) {
  // Backend response shape: { agent, model, result, timestamp, token_usage }
  const top = data?.result ?? data
  const model = data?.model
  const usage = data?.token_usage

  // Pull common signals
  const scoreRaw = top?.overall_completeness_score ?? top?.compliance_score ?? top?.gcp_score ?? top?.confidence ?? top?.confidence_score
  const score = typeof scoreRaw === 'number' ? Math.round(scoreRaw <= 1 ? scoreRaw * 100 : scoreRaw) : null
  const percentageStr = top?.compliance_percentage ?? top?.completeness_percentage ?? top?.gcp_percentage
  const readiness = top?.submission_readiness ?? top?.overall_compliance_status ?? top?.overall_gcp_status
  const risk = top?.regulatory_risk

  const critical = arr(top?.critical_gaps) || arr(top?.critical_non_compliances) || arr(top?.critical_deviations)
  const major    = arr(top?.major_non_compliances) || arr(top?.major_deviations) || arr(top?.incomplete_sections)
  const minor    = arr(top?.minor_non_compliances) || arr(top?.minor_deviations) || arr(top?.minor_gaps)
  const recs     = arr(top?.recommendations) || arr(top?.priority_actions)
  const checklist: any[] = arr(top?.compliance_checklist) || arr(top?.gcp_principles) || []

  // QA-specific
  const answer  = typeof top?.answer === 'string' ? top.answer : null
  const sources = arr(top?.references) || arr(top?.applicable_guidelines)

  // Classifier-specific
  const primary = top?.primary_category
  const seriousness = top?.seriousness_criteria
  const causality = top?.causality
  const timeline = top?.reporting_timeline

  const isQA = !!answer
  const isClassify = !!primary && !!causality

  return (
    <div data-testid="result-ok" className="rc-scroll" style={{ maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}>
      {/* ── Headline ─────────────────────────────────────────────────────── */}
      {(score !== null || readiness) && (
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--rc-divider)', background: 'var(--rc-surface-secondary)' }}>
          {score !== null && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--rc-text-muted)' }}>
                    {agentId === 'm6-qa' ? 'Confidence' : agentId === 'm4-classifier' ? 'Classifier confidence' : 'Compliance score'}
                  </div>
                  <div style={{
                    fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em',
                    color: score >= 80 ? 'var(--rc-approved)' : score >= 50 ? 'var(--rc-review)' : 'var(--rc-rejected)',
                  }}>{percentageStr ?? `${score}%`}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  {readiness && (
                    <span className={`rc-pill ${readinessPillClass(readiness)}`} style={{ fontSize: 11 }}>{String(readiness).replace(/_/g, ' ')}</span>
                  )}
                  {risk && (
                    <span className={`rc-pill ${riskPillClass(risk)}`} style={{ fontSize: 10, textTransform: 'uppercase' }}>Risk: {String(risk)}</span>
                  )}
                </div>
              </div>
              <div className="rc-scorebar" style={{ height: 6 }}>
                <div className="rc-scorebar-fill" style={{
                  width: `${score}%`,
                  background: score >= 80 ? 'var(--rc-approved)' : score >= 50 ? 'var(--rc-review)' : 'var(--rc-rejected)',
                }}/>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── QA: prose answer + sources ──────────────────────────────────── */}
      {isQA && (
        <>
          <Section title="Answer">
            <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--rc-text-primary)', whiteSpace: 'pre-line' }}>
              {answer}
            </div>
          </Section>
          {arr(top?.key_requirements) && (
            <Section title="Key requirements">
              <BulletList items={arr(top?.key_requirements)!}/>
            </Section>
          )}
          {sources && sources.length > 0 && (
            <Section title="Regulatory basis">
              {sources.map((s: any, i: number) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px dashed var(--rc-divider)' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--rc-text-primary)' }}>{s.title || s.guideline || s.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--rc-text-muted)' }}>{s.document || s.section || s.relevance || ''}</div>
                </div>
              ))}
            </Section>
          )}
        </>
      )}

      {/* ── Classifier: structured cards ────────────────────────────────── */}
      {isClassify && (
        <>
          <Section title="Classification">
            <PropGrid>
              <Prop k="Primary category" v={<strong>{String(primary).replace(/_/g, ' ')}</strong>}/>
              {top?.priority_score !== undefined && <Prop k="Priority" v={<strong>{Number(top.priority_score).toFixed(2)}</strong>}/>}
              {top?.requires_expedited_reporting !== undefined && (
                <Prop k="Expedited reporting" v={
                  <span className={`rc-pill ${top.requires_expedited_reporting ? 'rc-pill-rejected' : 'rc-pill-draft'}`}>
                    {top.requires_expedited_reporting ? 'Required' : 'Not required'}
                  </span>
                }/>
              )}
            </PropGrid>
            {top?.classification_rationale && (
              <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--rc-text-secondary)', lineHeight: 1.6 }}>{top.classification_rationale}</div>
            )}
          </Section>
          {seriousness && (
            <Section title="Seriousness criteria (ICH E2A)">
              <PropGrid>
                {Object.entries(seriousness).map(([k, v]) => (
                  <Prop key={k} k={k.replace(/_/g, ' ')} v={<BoolPill val={!!v}/>}/>
                ))}
              </PropGrid>
            </Section>
          )}
          {causality && (
            <Section title="Causality (WHO-UMC)">
              <PropGrid>
                {Object.entries(causality).map(([k, v]) => (
                  <Prop key={k} k={k.replace(/_/g, ' ')} v={String(v)}/>
                ))}
              </PropGrid>
            </Section>
          )}
          {timeline && (
            <Section title="Reporting timeline">
              <PropGrid>
                {Object.entries(timeline).map(([k, v]) => (
                  <Prop key={k} k={k.replace(/_/g, ' ')} v={String(v) || '—'}/>
                ))}
              </PropGrid>
            </Section>
          )}
        </>
      )}

      {/* ── Severity-grouped findings ───────────────────────────────────── */}
      {(critical?.length || major?.length || minor?.length) && (
        <Section title="Findings">
          {critical && critical.length > 0 && <FindingGroup label="Critical" count={critical.length} sev="critical" items={critical}/>}
          {major    && major.length > 0    && <FindingGroup label="Major"    count={major.length}    sev="major"    items={major}/>}
          {minor    && minor.length > 0    && <FindingGroup label="Minor"    count={minor.length}    sev="minor"    items={minor}/>}
        </Section>
      )}

      {/* ── Checklist (Schedule Y / ICH GCP) ─────────────────────────────── */}
      {checklist.length > 0 && (
        <Section title="Requirement checklist">
          {checklist.map((c, i) => (
            <ChecklistRow key={i} item={c}/>
          ))}
        </Section>
      )}

      {/* ── Recommendations ─────────────────────────────────────────────── */}
      {recs && recs.length > 0 && (
        <Section title="Recommendations">
          <BulletList items={recs}/>
        </Section>
      )}

      {/* ── Fallback for unrecognised shapes ────────────────────────────── */}
      {!isQA && !isClassify && !critical?.length && !major?.length && !minor?.length && !checklist.length && !recs?.length && (
        <Section title="Raw response">
          <pre style={{
            margin: 0, padding: 0,
            fontSize: 11.5, fontFamily: 'var(--rc-font-mono)',
            color: 'var(--rc-text-primary)',
            background: 'var(--rc-surface-secondary)',
            maxHeight: 480, overflow: 'auto',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {typeof top === 'string' ? top : JSON.stringify(top, null, 2)}
          </pre>
        </Section>
      )}

      {/* ── Footer: model + token usage ─────────────────────────────────── */}
      {(model || usage) && (
        <div style={{ padding: '10px 16px', fontSize: 11, color: 'var(--rc-text-muted)', display: 'flex', alignItems: 'center', gap: 14, borderTop: '1px solid var(--rc-divider)', flexWrap: 'wrap', background: 'var(--rc-surface-secondary)' }}>
          {model && <span><i className="ti ti-brain" style={{ marginRight: 4 }}/>Model: <strong style={{ color: 'var(--rc-text-secondary)' }}>{model}</strong></span>}
          {usage && (
            <span>
              <i className="ti ti-coin" style={{ marginRight: 4 }}/>
              {usage.input_tokens ?? usage.prompt_tokens ?? 0}↑ / {usage.output_tokens ?? usage.completion_tokens ?? 0}↓ tokens
            </span>
          )}
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <i className="ti ti-info-circle"/> AI output — requires RA sign-off before CDSCO submission.
          </span>
        </div>
      )}
    </div>
  )
}

// ── helpers ──────────────────────────────────────────────────────────────────
function arr(x: any): any[] | null { return Array.isArray(x) && x.length > 0 ? x : null }

function readinessPillClass(s: string): string {
  const v = String(s).toLowerCase()
  if (v.includes('ready') && !v.includes('not')) return 'rc-pill-approved'
  if (v.includes('compliant') && !v.includes('non')) return 'rc-pill-approved'
  if (v.includes('partial')) return 'rc-pill-review'
  return 'rc-pill-rejected'
}
function riskPillClass(s: string): string {
  const v = String(s).toLowerCase()
  if (v.includes('critical') || v.includes('high')) return 'rc-pill-rejected'
  if (v.includes('medium')) return 'rc-pill-review'
  return 'rc-pill-approved'
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: '1px solid var(--rc-divider)' }}>
      <div style={{ padding: '10px 16px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--rc-text-muted)', background: 'var(--rc-surface)' }}>
        {title}
      </div>
      <div style={{ padding: '4px 16px 14px' }}>{children}</div>
    </div>
  )
}

function PropGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>{children}</div>
}
function Prop({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', fontSize: 12, padding: '4px 0' }}>
      <span style={{ color: 'var(--rc-text-muted)', textTransform: 'capitalize' }}>{k}</span>
      <span style={{ color: 'var(--rc-text-primary)' }}>{v}</span>
    </div>
  )
}
function BoolPill({ val }: { val: boolean }) {
  return <span className={`rc-pill ${val ? 'rc-pill-rejected' : 'rc-pill-approved'}`} style={{ fontSize: 10 }}>{val ? 'YES' : 'NO'}</span>
}

function FindingGroup({ label, count, sev, items }: { label: string; count: number; sev: 'critical' | 'major' | 'minor'; items: any[] }) {
  const pillCls = sev === 'critical' ? 'rc-pill-rejected' : sev === 'major' ? 'rc-pill-review' : 'rc-pill-draft'
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span className={`rc-pill ${pillCls}`} style={{ textTransform: 'uppercase', fontSize: 10 }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--rc-text-muted)' }}>{count} item{count !== 1 ? 's' : ''}</span>
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--rc-text-primary)', lineHeight: 1.6 }}>
        {items.map((it: any, i: number) => (
          <li key={i} style={{ marginBottom: 4 }}>{typeof it === 'string' ? it : (it.finding || it.gap || it.description || JSON.stringify(it))}</li>
        ))}
      </ul>
    </div>
  )
}

function ChecklistRow({ item }: { item: any }) {
  const status = String(item.status || '').toLowerCase()
  const cls = status.includes('compliant') && !status.includes('non') ? 'rc-pill-approved'
    : status.includes('partial') ? 'rc-pill-review'
    : status.includes('non') ? 'rc-pill-rejected'
    : 'rc-pill-draft'
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px dashed var(--rc-divider)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 4 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--rc-text-primary)' }}>
          {item.requirement || item.principle || item.name}
        </div>
        {item.status && <span className={`rc-pill ${cls}`} style={{ fontSize: 10, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{String(item.status).replace(/_/g, ' ')}</span>}
      </div>
      {(item.section || item.ich_reference) && (
        <div style={{ fontSize: 11, color: 'var(--rc-text-muted)', marginBottom: 4, fontFamily: 'var(--rc-font-mono)' }}>{item.section || item.ich_reference}</div>
      )}
      {(item.finding || item.observation) && (
        <div style={{ fontSize: 12, color: 'var(--rc-text-secondary)', lineHeight: 1.6, marginBottom: 4 }}>{item.finding || item.observation}</div>
      )}
      {(item.corrective_action) && (
        <div style={{ fontSize: 11.5, color: 'var(--rc-text-secondary)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--rc-primary)' }}>Corrective action: </strong>{item.corrective_action}
        </div>
      )}
    </div>
  )
}

function BulletList({ items }: { items: any[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--rc-text-primary)', lineHeight: 1.7 }}>
      {items.map((it, i) => (
        <li key={i} style={{ marginBottom: 4 }}>{typeof it === 'string' ? it : JSON.stringify(it)}</li>
      ))}
    </ul>
  )
}

// ─── File dropzone (M9 only) ─────────────────────────────────────────────────
function FileDropzone({ files, setFiles }: { files: File[]; setFiles: (f: File[]) => void }) {
  const [drag, setDrag] = useState(false)
  return (
    <div>
      <label
        htmlFor="rc-file-input"
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => {
          e.preventDefault(); setDrag(false)
          const dropped = Array.from(e.dataTransfer.files)
          setFiles([...files, ...dropped].slice(0, 6))
        }}
        style={{
          border: `2px dashed ${drag ? 'var(--rc-primary)' : 'var(--rc-border-strong)'}`,
          background: drag ? 'var(--rc-primary-soft)' : 'transparent',
          borderRadius: 8, padding: 32, textAlign: 'center',
          color: 'var(--rc-text-muted)', cursor: 'pointer', display: 'block',
        }}
      >
        <i className="ti ti-cloud-upload" style={{ fontSize: 28, display: 'block', marginBottom: 8, color: 'var(--rc-primary)' }}/>
        <div style={{ fontSize: 13, color: 'var(--rc-text-primary)', fontWeight: 500 }}>
          Drop 2–6 documents here, or click to browse
        </div>
        <div style={{ fontSize: 11, marginTop: 4 }}>PDF or DOCX · Up to 6 files</div>
        <input
          id="rc-file-input" type="file" multiple
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          style={{ display: 'none' }}
          onChange={e => {
            const selected = Array.from(e.target.files ?? [])
            setFiles([...files, ...selected].slice(0, 6))
          }}
          data-testid="agent-file-input"
        />
      </label>
      {files.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {files.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--rc-divider)' }}>
              <i className="ti ti-file-text" style={{ fontSize: 14, color: 'var(--rc-primary)' }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{f.name}</div>
                <div style={{ fontSize: 11, color: 'var(--rc-text-muted)' }}>{(f.size / 1024).toFixed(1)} KB</div>
              </div>
              <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remove">
                <i className="ti ti-x"/>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
