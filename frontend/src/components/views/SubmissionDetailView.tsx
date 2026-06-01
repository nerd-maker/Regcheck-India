'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { SUBMISSIONS, AUDIT_EVENTS } from '@/lib/mockData'
import { useWorkspace } from '@/lib/workspaceStore'
import PageHeader from '@/components/veeva/PageHeader'
import StatusBadge from '@/components/veeva/StatusBadge'
import LifecycleBar from '@/components/veeva/LifecycleBar'
import { ComplianceTrendChart } from '@/components/ComplianceTrendChart'
import { fetchSubmissions, fetchDocuments, fetchCorrespondence, uploadDocument } from '@/services/workspaceData'
import type { SubmissionRecord, DocumentRecord, HACorrespondenceRecord } from '@/lib/mockData'

export default function SubmissionDetailView() {
  const { selectedSubmissionId, setActiveView, setSelectedDocumentId, openInspector, setPrefilledInput } = useWorkspace()
  const [tab, setTab] = useState('overview')

  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([])
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [correspondence, setCorrespondence] = useState<HACorrespondenceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const loadData = () => {
    if (!selectedSubmissionId) return
    setLoading(true)
    Promise.all([
      fetchSubmissions(),
      fetchDocuments(selectedSubmissionId),
      fetchCorrespondence(selectedSubmissionId)
    ]).then(([subs, docs, corrs]) => {
      setSubmissions(subs)
      setDocuments(docs)
      setCorrespondence(corrs)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }

  useEffect(() => {
    loadData()
  }, [selectedSubmissionId])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedSubmissionId) return
    setUploading(true)
    try {
      await uploadDocument(file, selectedSubmissionId)
      loadData()
    } catch (err: any) {
      alert(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const sub = useMemo(() => {
    return submissions.find(s => s.id === selectedSubmissionId) ?? SUBMISSIONS.find(s => s.id === selectedSubmissionId) ?? null
  }, [submissions, selectedSubmissionId])

  const docs = useMemo(() => {
    return documents
  }, [documents])

  const corr = useMemo(() => {
    return correspondence
  }, [correspondence])

  const activity = useMemo(() => {
    if (!sub) return []
    return AUDIT_EVENTS.filter(e => e.target.includes(sub.number) || e.target.includes(sub.product))
  }, [sub])

  const tabs = useMemo(() => {
    if (!sub) return []
    return [
      { id: 'overview',       label: 'Overview' },
      { id: 'documents',      label: 'Documents',       count: docs.length },
      { id: 'correspondence', label: 'HA Correspondence', count: corr.length },
      { id: 'gaps',           label: 'Compliance Gaps', count: sub.openGaps },
      { id: 'activity',       label: 'Activity' },
    ]
  }, [sub, docs, corr])

  if (loading && selectedSubmissionId) {
    return (
      <div data-testid="view-submission-detail">
        <PageHeader
          crumbs={[{ label: 'Workspace', onClick: () => setActiveView('home') }, { label: 'Submissions', onClick: () => setActiveView('submissions') }, { label: 'Detail' }]}
          title="Loading..."
          icon="ti-loader-2"
        />
        <div className="rc-empty">
          <i className="ti ti-loader-2" style={{ animation: 'spin 1s linear infinite' }}/>
          <div style={{ marginTop: 8 }}>Loading submission details...</div>
        </div>
      </div>
    )
  }

  if (!sub) {
    return (
      <div data-testid="view-submission-detail">
        <PageHeader
          crumbs={[{ label: 'Workspace', onClick: () => setActiveView('home') }, { label: 'Submissions', onClick: () => setActiveView('submissions') }, { label: 'Detail' }]}
          title="Submission not found"
          icon="ti-alert-circle"
        />
        <div className="rc-empty"><i className="ti ti-folder-off"/><div>Select a submission first.</div></div>
      </div>
    )
  }

  return (
    <div data-testid="view-submission-detail" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        crumbs={[
          { label: 'Workspace', onClick: () => setActiveView('home') },
          { label: 'Submissions', onClick: () => setActiveView('submissions') },
          { label: sub.number },
        ]}
        title={sub.name}
        subtitle={`${sub.type} · ${sub.phase} · ${sub.indication} · ${sub.haAuthority}`}
        icon="ti-folder-open"
        badge={<StatusBadge state={sub.state} label={sub.stateLabel}/>}
        actions={
          <>
            <button className="rc-btn" onClick={() => {
              const url = `${window.location.origin}/app#/submission-detail/sub/${sub.id}`
              navigator.clipboard?.writeText(url).then(() => alert(`Link copied to clipboard:\n${url}`)).catch(() => alert(`Share link:\n${url}`))
            }} data-testid="sub-share-btn"><i className="ti ti-link"/> Copy link</button>
            <button className="rc-btn" onClick={() => openInspector('details')} data-testid="sub-inspect-btn"><i className="ti ti-layout-sidebar-right-expand"/> Inspect</button>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleUpload}
            />
            <button
              className="rc-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              data-testid="sub-upload-btn"
            >
              <i className={uploading ? "ti ti-loader-2" : "ti ti-upload"} style={uploading ? { animation: 'spin 1s linear infinite', marginRight: 4, display: 'inline-block' } : {}}/>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            <button className="rc-btn rc-btn-primary" onClick={() => openInspector('actions')} data-testid="sub-run-actions">
              <i className="ti ti-sparkles"/> Run AI Actions
            </button>
          </>
        }
        tabs={tabs}
        activeTab={tab}
        onTabChange={setTab}
      />

      <div className="rc-scroll" style={{ overflow: 'auto', padding: 24 }}>
        {tab === 'overview' && (
          <>
            <LifecycleBar current={sub.state}/>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16, marginBottom: 16 }}>
              <Tile label="Documents"        value={String(sub.documents)}/>
              <Tile label="Open gaps"        value={String(sub.openGaps)} valueColor={sub.openGaps > 0 ? 'var(--rc-rejected)' : 'var(--rc-approved)'}/>
              <Tile label="Compliance score" value={`${sub.complianceScore}%`}/>
              <Tile label="Target submit"    value={sub.targetSubmitDate}/>
            </div>

            <div style={{ marginBottom: 16 }}>
              <ComplianceTrendChart
                agentId="m7-scheduley"
                agentName="Schedule Y"
                submissionId={sub.id}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
              <div className="rc-card">
                <div className="rc-card-header"><span>Submission summary</span></div>
                <div className="rc-card-body" style={{ fontSize: 13, color: 'var(--rc-text-secondary)', lineHeight: 1.65 }}>
                  This {sub.type} submission for <strong style={{ color: 'var(--rc-text-primary)' }}>{sub.product}</strong> targets <strong style={{ color: 'var(--rc-text-primary)' }}>{sub.indication}</strong> ({sub.phase}). It is currently <em>{sub.stateLabel ?? sub.state}</em> with {sub.openGaps > 0 ? <span style={{ color: 'var(--rc-rejected)', fontWeight: 600 }}>{sub.openGaps} open gap{sub.openGaps !== 1 ? 's' : ''}</span> : 'no open gaps'}. Aligned with{' '}
                  {sub.frameworks.map((f, i) => (
                    <span key={f}><strong style={{ color: 'var(--rc-text-primary)' }}>{f}</strong>{i < sub.frameworks.length - 1 ? ', ' : '.'}</span>
                  ))}
                </div>
              </div>
              <div className="rc-card">
                <div className="rc-card-header"><span>Ownership & contacts</span></div>
                <div className="rc-card-body">
                  <PropRow k="Submission owner" v={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="rc-avatar" style={{ width: 22, height: 22, fontSize: 9.5, background: 'linear-gradient(135deg,#93C5FD,#1A56DB)' }}>{sub.owner.initials}</div>
                      <div><div style={{ fontSize: 12.5, fontWeight: 500 }}>{sub.owner.name}</div><div style={{ fontSize: 10.5, color: 'var(--rc-text-muted)' }}>{sub.owner.role}</div></div>
                    </div>
                  }/>
                  <PropRow k="Risk level" v={
                    <span style={{ textTransform: 'capitalize', fontSize: 12, fontWeight: 600,
                      color: sub.riskLevel === 'high' ? 'var(--rc-rejected)' : sub.riskLevel === 'medium' ? 'var(--rc-review)' : 'var(--rc-approved)' }}>
                      {sub.riskLevel}
                    </span>}/>
                  <PropRow k="Authority" v={sub.haAuthority}/>
                  <PropRow k="Updated" v={sub.updatedAt}/>
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'documents' && (
          <div className="rc-card">
            <div className="rc-card-header">
              <span>{docs.length} documents</span>
              <button className="rc-btn rc-btn-primary rc-btn-sm" onClick={() => fileInputRef.current?.click()} data-testid="add-doc-btn" disabled={uploading}>
                <i className={uploading ? "ti ti-loader-2" : "ti ti-plus"} style={uploading ? { animation: 'spin 1s linear infinite', marginRight: 4, display: 'inline-block' } : {}}/>
                {uploading ? 'Uploading...' : 'Add document'}
              </button>
            </div>
            <table className="rc-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Type</th>
                  <th>Version</th>
                  <th>State</th>
                  <th style={{ width: 130 }}>Compliance</th>
                  <th>Owner</th>
                  <th>Size</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {docs.map(d => (
                  <tr key={d.id} onClick={() => { setSelectedDocumentId(d.id); openInspector('details'); }} data-testid={`docrow-${d.id}`}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <i className="ti ti-file-text" style={{ fontSize: 14, color: 'var(--rc-primary)' }}/>
                        <div>
                          <div className="rc-table-link" style={{ fontWeight: 500 }}>{d.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--rc-text-muted)', fontFamily: 'var(--rc-font-mono)' }}>{d.number} · {d.classification}</div>
                        </div>
                      </div>
                    </td>
                    <td>{d.type}</td>
                    <td>{d.version}</td>
                    <td><StatusBadge state={d.state} size="sm"/></td>
                    <td>
                      {typeof d.complianceScore === 'number' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="rc-scorebar" style={{ flex: 1 }}>
                            <div className="rc-scorebar-fill" style={{
                              width: `${d.complianceScore}%`,
                              background: d.complianceScore >= 85 ? 'var(--rc-approved)' : d.complianceScore >= 65 ? 'var(--rc-review)' : 'var(--rc-rejected)',
                            }}/>
                          </div>
                          <span style={{ fontSize: 11.5, fontWeight: 600, minWidth: 30, textAlign: 'right' }}>{d.complianceScore}%</span>
                        </div>
                      ) : <span style={{ color: 'var(--rc-text-muted)' }}>—</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="rc-avatar" style={{ width: 22, height: 22, fontSize: 9.5, background: 'linear-gradient(135deg,#93C5FD,#1A56DB)' }}>{d.owner.initials}</div>
                        <span style={{ fontSize: 11.5 }}>{d.owner.name.split(' ')[0]}</span>
                      </div>
                    </td>
                    <td><span style={{ fontSize: 11.5, color: 'var(--rc-text-secondary)' }}>{d.size}</span></td>
                    <td><span style={{ fontSize: 11.5, color: 'var(--rc-text-secondary)' }}>{d.updatedAt}</span></td>
                  </tr>
                ))}
                {docs.length === 0 && (
                  <tr><td colSpan={8}><div className="rc-empty"><i className="ti ti-file-off"/><div>No documents in this submission.</div></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'correspondence' && (
          <div className="rc-card">
            <div className="rc-card-header"><span>{corr.length} correspondence items</span></div>
            <div>
              {corr.map(c => (
                <div key={c.id} style={{ padding: '14px 18px', borderBottom: '1px solid var(--rc-divider)', display: 'flex', gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                    background: c.priority === 'critical' ? 'var(--rc-rejected-bg)' : c.priority === 'high' ? 'var(--rc-review-bg)' : 'var(--rc-effective-bg)',
                    color:       c.priority === 'critical' ? 'var(--rc-rejected)'    : c.priority === 'high' ? 'var(--rc-review)'    : 'var(--rc-effective)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <i className="ti ti-mail" style={{ fontSize: 15 }}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontFamily: 'var(--rc-font-mono)', color: 'var(--rc-text-muted)' }}>{c.number}</span>
                      <span style={{ fontSize: 10.5, padding: '1px 6px', borderRadius: 3, background: 'var(--rc-surface-tertiary)', color: 'var(--rc-text-secondary)' }}>{c.category}</span>
                      <span style={{ fontSize: 10.5, color: c.state === 'open' ? 'var(--rc-rejected)' : c.state === 'response-drafted' ? 'var(--rc-review)' : 'var(--rc-approved)', fontWeight: 600, textTransform: 'capitalize' }}>{c.state.replace('-', ' ')}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--rc-text-primary)' }}>{c.subject}</div>
                    <div style={{ fontSize: 12, color: 'var(--rc-text-muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>{c.preview}</div>
                    <div style={{ fontSize: 11, color: 'var(--rc-text-muted)', marginTop: 5 }}>
                      {c.authority} · Received {c.receivedAt}{c.dueAt ? ` · Due ${c.dueAt}` : ''}
                    </div>
                  </div>
                </div>
              ))}
              {corr.length === 0 && (
                <div className="rc-empty"><i className="ti ti-mail-off"/><div>No correspondence items linked to this submission.</div></div>
              )}
            </div>
          </div>
        )}

        {tab === 'gaps' && (
          <div className="rc-card">
            <div className="rc-card-header"><span>{sub.openGaps} open compliance gaps</span></div>
            {sub.openGaps === 0 ? (
              <div className="rc-empty"><i className="ti ti-circle-check"/><div>No open gaps. Submission is ready for the next lifecycle stage.</div></div>
            ) : (
              <div style={{ padding: 0 }}>
                {[
                  { id: 'g1', sev: 'critical', framework: 'Schedule Y · Appendix III', text: 'Dose justification missing for paediatric subgroup' },
                  { id: 'g2', sev: 'major',    framework: 'ICH E6(R3) §7.1',           text: 'Risk-based monitoring plan does not include site visit triggers' },
                  { id: 'g3', sev: 'major',    framework: 'NDCTR 2019 Rule 33',        text: 'CTRI registration number not referenced in cover letter' },
                  { id: 'g4', sev: 'minor',    framework: 'DPDP Act 2023',             text: 'PII in 2 protocol appendices not anonymised' },
                ].slice(0, sub.openGaps).map(g => (
                  <div key={g.id} style={{ padding: '12px 18px', borderBottom: '1px solid var(--rc-divider)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span className={`rc-pill ${g.sev === 'critical' ? 'rc-pill-rejected' : g.sev === 'major' ? 'rc-pill-review' : 'rc-pill-draft'}`} style={{ textTransform: 'uppercase', fontSize: 10 }}>{g.sev}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--rc-text-primary)', fontWeight: 500 }}>{g.text}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--rc-text-muted)', marginTop: 3 }}>{g.framework}</div>
                    </div>
                    <button className="rc-btn rc-btn-sm" onClick={() => {
                      setPrefilledInput(`Resolve the following compliance gap:\n\nGap: ${g.text}\nFramework: ${g.framework}\nSubmission: ${sub.name} (${sub.number})\nProduct: ${sub.product}\nIndication: ${sub.indication}\n\nProvide a detailed remediation plan with citations to the relevant NDCTR / Schedule Y / ICH provisions and concrete content to add to the document.`)
                      setActiveView('m6-qa')
                    }} data-testid={`gap-resolve-${g.id}`}><i className="ti ti-sparkles"/> Resolve with AI</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'activity' && (
          <div className="rc-card">
            <div className="rc-card-header"><span>Activity timeline</span></div>
            <div>
              {activity.length ? activity.map(e => (
                <div key={e.id} style={{ padding: '12px 18px', borderBottom: '1px solid var(--rc-divider)', display: 'flex', gap: 12 }}>
                  <div className="rc-avatar" style={{ width: 26, height: 26, fontSize: 11, background: 'linear-gradient(135deg,#93C5FD,#1A56DB)' }}>{e.initials}</div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{e.action}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--rc-text-secondary)', marginTop: 2 }}>{e.target}</div>
                    {e.meta && <div style={{ fontSize: 11.5, color: 'var(--rc-text-muted)', marginTop: 2 }}>{e.meta}</div>}
                    <div style={{ fontSize: 10.5, color: 'var(--rc-text-muted)', marginTop: 3 }}>{e.user} · {e.ts}</div>
                  </div>
                </div>
              )) : <div className="rc-empty"><i className="ti ti-clock-off"/><div>No activity yet for this submission.</div></div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Tile({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="rc-kpi">
      <div className="rc-kpi-label">{label}</div>
      <div className="rc-kpi-value" style={{ color: valueColor }}>{value}</div>
    </div>
  )
}

function PropRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', padding: '8px 0', fontSize: 12, borderBottom: '1px solid var(--rc-divider)' }}>
      <div style={{ color: 'var(--rc-text-muted)' }}>{k}</div>
      <div style={{ color: 'var(--rc-text-primary)' }}>{v}</div>
    </div>
  )
}
