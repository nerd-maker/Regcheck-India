'use client'

import { useState } from 'react'
import { useWorkspace } from '@/lib/workspaceStore'
import { DOCUMENTS, SUBMISSIONS, PEOPLE, AUDIT_EVENTS } from '@/lib/mockData'
import StatusBadge from './StatusBadge'

// Available "Compliance Actions" — AI agents that can be run on a document
const COMPLIANCE_ACTIONS = [
  { id: 'm1-anonymiser',   label: 'PII Anonymisation',         icon: 'ti-shield-check',     desc: 'DPDP Act 2023 + Schedule Y compliant redaction' },
  { id: 'm3-completeness', label: 'Completeness Check',        icon: 'ti-checklist',        desc: 'Identify CRITICAL / MAJOR / MINOR gaps' },
  { id: 'm7-scheduley',    label: 'Schedule Y Deep Check',     icon: 'ti-scale',            desc: 'Appendices I–XI + NDCTR 2019 Rules 1–105' },
  { id: 'm8-ichgcp',       label: 'ICH E6(R3) GCP Check',      icon: 'ti-certificate-2',    desc: 'Full GCP evaluation incl. R3 QMS + RBM' },
  { id: 'm2-summariser',   label: 'Document Summariser',       icon: 'ti-file-description', desc: 'Precis with regulatory citations' },
  { id: 'm9-crossdoc',     label: 'Cross-document Check',      icon: 'ti-files',            desc: 'Detect contradictions across submission' },
  { id: 'm4-classifier',   label: 'SAE Case Classification',   icon: 'ti-alert-triangle',   desc: 'ICH E2A · WHO-UMC · NDCTR timelines' },
  { id: 'm5-inspection',   label: 'Inspection Report',         icon: 'ti-report',           desc: 'CDSCO GCP inspection format' },
  { id: 'm6-qa',           label: 'Regulatory Q&A',            icon: 'ti-message-question', desc: 'RAG-grounded answers from regulations' },
]

export default function RightInspector() {
  const {
    inspectorOpen, closeInspector,
    inspectorTab, setInspectorTab,
    selectedDocumentId, selectedSubmissionId,
    setActiveView, setPrefilledInput,
  } = useWorkspace()

  if (!inspectorOpen) return null

  const doc = DOCUMENTS.find(d => d.id === selectedDocumentId)
  const sub = SUBMISSIONS.find(s => s.id === selectedSubmissionId)

  const subject = doc ?? sub
  if (!subject) {
    return (
      <div className="rc-inspector" style={{ width: 'var(--rc-inspector-width)' }} data-testid="right-inspector">
        <div className="rc-inspector-header">
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11.5, color: 'var(--rc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Inspector
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>Nothing selected</div>
          </div>
          <button className="rc-inspector-close" onClick={closeInspector} aria-label="Close" data-testid="inspector-close">
            <i className="ti ti-x" style={{ fontSize: 16 }}/>
          </button>
        </div>
        <div className="rc-empty">
          <i className="ti ti-pointer"/>
          <div style={{ fontSize: 12 }}>Select a document or submission to see details and run compliance actions.</div>
        </div>
      </div>
    )
  }

  const isDoc = !!doc
  const title = isDoc ? doc!.name : sub!.name
  const number = isDoc ? doc!.number : sub!.number

  return (
    <div className="rc-inspector rc-scroll" style={{ width: 'var(--rc-inspector-width)' }} data-testid="right-inspector">
      {/* Header */}
      <div className="rc-inspector-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, color: 'var(--rc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 4 }}>
            {isDoc ? 'Document' : 'Submission'} · {number}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--rc-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </div>
          <div style={{ marginTop: 6 }}>
            <StatusBadge state={subject.state} label={isDoc ? undefined : sub!.stateLabel}/>
          </div>
        </div>
        <button className="rc-inspector-close" onClick={closeInspector} aria-label="Close" data-testid="inspector-close">
          <i className="ti ti-x" style={{ fontSize: 16 }}/>
        </button>
      </div>

      {/* Tabs */}
      <div className="rc-inspector-tabs">
        <button className={`rc-inspector-tab${inspectorTab === 'details' ? ' is-active' : ''}`}
          onClick={() => setInspectorTab('details')}
          data-testid="inspector-tab-details"
        >Details</button>
        <button className={`rc-inspector-tab${inspectorTab === 'actions' ? ' is-active' : ''}`}
          onClick={() => setInspectorTab('actions')}
          data-testid="inspector-tab-actions"
        >Compliance Actions</button>
        <button className={`rc-inspector-tab${inspectorTab === 'activity' ? ' is-active' : ''}`}
          onClick={() => setInspectorTab('activity')}
          data-testid="inspector-tab-activity"
        >Activity</button>
      </div>

      <div className="rc-inspector-body">
        {inspectorTab === 'details' && (
          <div className="rc-prop-list">
            {isDoc ? (
              <>
                <PropRow k="Number" v={doc!.number}/>
                <PropRow k="Type" v={doc!.type}/>
                <PropRow k="Classification" v={doc!.classification}/>
                <PropRow k="Version" v={doc!.version}/>
                <PropRow k="Lifecycle" v={<StatusBadge state={doc!.state} size="sm"/>}/>
                <PropRow k="Owner" v={<OwnerCell name={doc!.owner.name} initials={doc!.owner.initials} role={doc!.owner.role}/>}/>
                <PropRow k="Country" v="India"/>
                <PropRow k="Language" v={doc!.language.toUpperCase()}/>
                <PropRow k="File Size" v={doc!.size}/>
                <PropRow k="Updated" v={`${doc!.updatedAt} · ${doc!.updatedBy}`}/>
                {typeof doc!.complianceScore === 'number' && (
                  <PropRow k="Compliance" v={<ScoreCell score={doc!.complianceScore}/>}/>
                )}
                {doc!.flags && doc!.flags.length > 0 && (
                  <PropRow k="Flags" v={
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {doc!.flags.map(f => (
                        <span key={f} style={{
                          fontSize: 10.5, fontWeight: 600,
                          padding: '1px 6px', borderRadius: 3,
                          background: f === 'critical-gap' ? 'var(--rc-rejected-bg)' : f === 'expedited' ? 'var(--rc-review-bg)' : 'var(--rc-effective-bg)',
                          color: f === 'critical-gap' ? 'var(--rc-rejected)' : f === 'expedited' ? 'var(--rc-review)' : 'var(--rc-effective)',
                        }}>{f.replace('-', ' ')}</span>
                      ))}
                    </div>
                  }/>
                )}
              </>
            ) : (
              <>
                <PropRow k="Number" v={sub!.number}/>
                <PropRow k="Type" v={sub!.type}/>
                <PropRow k="Product" v={sub!.product}/>
                <PropRow k="Indication" v={sub!.indication}/>
                <PropRow k="Phase" v={sub!.phase}/>
                <PropRow k="Authority" v={sub!.haAuthority}/>
                <PropRow k="Target Submit" v={sub!.targetSubmitDate}/>
                <PropRow k="Owner" v={<OwnerCell name={sub!.owner.name} initials={sub!.owner.initials} role={sub!.owner.role}/>}/>
                <PropRow k="Documents" v={String(sub!.documents)}/>
                <PropRow k="Open Gaps" v={
                  <span style={{ color: sub!.openGaps > 0 ? 'var(--rc-rejected)' : 'var(--rc-approved)', fontWeight: 600 }}>{sub!.openGaps}</span>
                }/>
                <PropRow k="Compliance" v={<ScoreCell score={sub!.complianceScore}/>}/>
                <PropRow k="Frameworks" v={
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {sub!.frameworks.map(f => (
                      <span key={f} style={{ fontSize: 10.5, padding: '1px 6px', borderRadius: 3, background: 'var(--rc-surface-tertiary)', color: 'var(--rc-text-secondary)' }}>{f}</span>
                    ))}
                  </div>
                }/>
              </>
            )}
          </div>
        )}

        {inspectorTab === 'actions' && (
          <ComplianceActions
            isDoc={isDoc}
            onRun={(actionId) => {
              // Pre-fill the agent's input box with the document excerpt
              // (or a representative summary for submission-level runs).
              if (isDoc && doc?.excerpt) {
                setPrefilledInput(doc.excerpt)
              } else if (!isDoc && sub) {
                setPrefilledInput(`Submission: ${sub.name} (${sub.number})\nType: ${sub.type}\nProduct: ${sub.product}\nIndication: ${sub.indication}\nPhase: ${sub.phase}\nAuthority: ${sub.haAuthority}\nFrameworks: ${sub.frameworks.join(', ')}`)
              }
              setActiveView(actionId)
              closeInspector()
            }}
          />
        )}

        {inspectorTab === 'activity' && (
          <div>
            {AUDIT_EVENTS.slice(0, 6).map(e => (
              <div key={e.id} style={{ display: 'flex', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--rc-divider)' }}>
                <div className="rc-avatar" style={{ width: 24, height: 24, fontSize: 10, background: 'linear-gradient(135deg,#93C5FD,#1A56DB)' }}>{e.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--rc-text-primary)', fontWeight: 500 }}>{e.action}</div>
                  {e.meta && <div style={{ fontSize: 11.5, color: 'var(--rc-text-secondary)', marginTop: 2 }}>{e.meta}</div>}
                  <div style={{ fontSize: 10.5, color: 'var(--rc-text-muted)', marginTop: 3 }}>{e.user} · {e.ts}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PropRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rc-prop-row">
      <div className="rc-prop-key">{k}</div>
      <div className="rc-prop-val">{v}</div>
    </div>
  )
}

function OwnerCell({ name, initials, role }: { name: string; initials: string; role: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="rc-avatar" style={{ width: 22, height: 22, fontSize: 9.5, background: 'linear-gradient(135deg,#93C5FD,#1A56DB)' }}>{initials}</div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 500 }}>{name}</div>
        <div style={{ fontSize: 10.5, color: 'var(--rc-text-muted)' }}>{role}</div>
      </div>
    </div>
  )
}

function ScoreCell({ score }: { score: number }) {
  const color = score >= 85 ? 'var(--rc-approved)' : score >= 65 ? 'var(--rc-review)' : 'var(--rc-rejected)'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color }}>{score}%</span>
      </div>
      <div className="rc-scorebar"><div className="rc-scorebar-fill" style={{ width: `${score}%`, background: color }}/></div>
    </div>
  )
}

function ComplianceActions({ isDoc, onRun }: { isDoc: boolean; onRun: (id: string) => void }) {
  const list = isDoc ? COMPLIANCE_ACTIONS : COMPLIANCE_ACTIONS.filter(a => ['m9-crossdoc', 'm6-qa', 'm5-inspection'].includes(a.id))
  return (
    <div data-testid="compliance-actions-list">
      <div style={{ padding: '12px 16px', background: 'var(--rc-surface-secondary)', fontSize: 11.5, color: 'var(--rc-text-secondary)' }}>
        <i className="ti ti-sparkles" style={{ fontSize: 13, color: 'var(--rc-primary)', marginRight: 6 }}/>
        AI-assisted actions you can run on this {isDoc ? 'document' : 'submission'}. All outputs are cited and require RA sign-off.
      </div>
      {list.map(a => (
        <div key={a.id} className="rc-action" onClick={() => onRun(a.id)} data-testid={`run-action-${a.id}`}>
          <div className="rc-action-icon"><i className={`ti ${a.icon}`}/></div>
          <div className="rc-action-main">
            <div className="rc-action-title">{a.label}</div>
            <div className="rc-action-desc">{a.desc}</div>
          </div>
          <i className="ti ti-chevron-right rc-action-arrow"/>
        </div>
      ))}
    </div>
  )
}
