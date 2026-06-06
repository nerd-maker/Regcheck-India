'use client'

import { useState, useMemo, useEffect } from 'react'
import { useWorkspace } from '@/lib/workspaceStore'
import PageHeader from '@/components/veeva/PageHeader'
import FilterBar from '@/components/veeva/FilterBar'
import { exportCSV, timestampedName } from '@/lib/csv'
import { transitionCorrespondenceState } from '@/services/workspaceData'
import { useCorrespondence } from '@/hooks/useWorkspaceData'
import axios from 'axios'
import { getStoredKey } from '@/services/api'

const STATE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  'open':              { bg: 'var(--rc-rejected-bg)',  color: 'var(--rc-rejected)',  label: 'Open' },
  'response-drafted':  { bg: 'var(--rc-review-bg)',    color: 'var(--rc-review)',    label: 'Response Drafted' },
  'closed':            { bg: 'var(--rc-approved-bg)',  color: 'var(--rc-approved)',  label: 'Closed' },
}

export default function HACorrespondenceView() {
  const { setActiveView, setPrefilledInput } = useWorkspace()
  const [tab, setTab] = useState('inbox')
  const [active, setActive] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')

  const { data: correspondence, loading, reload: loadCorrespondence } = useCorrespondence()

  // ── New correspondence form state ─────────────────────────────────────
  const [showNewForm, setShowNewForm] = useState(false)
  const [newSubject, setNewSubject] = useState('')
  const [newAuthority, setNewAuthority] = useState('CDSCO')
  const [newCategory, setNewCategory] = useState('Query')
  const [newPriority, setNewPriority] = useState('standard')
  const [newSubmitting, setNewSubmitting] = useState(false)

  const handleNewResponse = async () => {
    if (!newSubject.trim()) return
    setNewSubmitting(true)
    try {
      await axios.post('/api/regcheck/correspondence', {
        subject: newSubject,
        authority: newAuthority,
        category: newCategory,
        priority: newPriority,
        direction: 'outbound',
        preview: newSubject,
      }, {
        headers: { 'x-anthropic-api-key': getStoredKey() },
        timeout: 8000,
      })
      await loadCorrespondence()
      setShowNewForm(false)
      setNewSubject('')
    } catch (err) {
      console.error('Failed to create correspondence:', err)
      // Optimistically reload anyway — backend may have saved despite error
      await loadCorrespondence()
      setShowNewForm(false)
      setNewSubject('')
    } finally {
      setNewSubmitting(false)
    }
  }

  const byDir = useMemo(() => correspondence.filter(c =>
    tab === 'inbox'  ? c.direction === 'inbound'
    : tab === 'sent' ? c.direction === 'outbound'
    : true,
  ), [correspondence, tab])

  const list = useMemo(() => byDir.filter(c => {
    if (active.state    && c.state    !== active.state)    return false
    if (active.priority && c.priority !== active.priority) return false
    if (active.category && c.category !== active.category) return false
    if (search && !`${c.number} ${c.subject} ${c.preview}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [byDir, active, search])

  const [active2, setActive2] = useState<string | null>(null)

  useEffect(() => {
    if (list.length > 0 && !active2) {
      setActive2(list[0].id)
    }
  }, [list, active2])

  const current = useMemo(() => {
    return correspondence.find(c => c.id === active2) ?? list[0] ?? null
  }, [correspondence, active2, list])

  const currentId = current?.id ?? null

  return (
    <div data-testid="view-correspondence" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        crumbs={[{ label: 'Workspace', onClick: () => setActiveView('home') }, { label: 'HA Correspondence' }]}
        title="Health Authority Correspondence"
        subtitle="CDSCO · DCGI · State FDA"
        icon="ti-mail"
        actions={
          <>
            <button className="rc-btn" onClick={() => exportCSV(timestampedName('regcheck_ha_correspondence'),
              list.map(c => ({ number: c.number, subject: c.subject, direction: c.direction, authority: c.authority, category: c.category, priority: c.priority, state: c.state, received: c.receivedAt, due: c.dueAt ?? '', submission: c.submissionId ?? '' }))
            )} data-testid="corr-export-btn"><i className="ti ti-download"/> Export</button>
            <button className="rc-btn rc-btn-primary" onClick={() => setShowNewForm(true)} data-testid="corr-new-btn">
              <i className="ti ti-edit"/> New Response
            </button>
          </>
        }
        tabs={[
          { id: 'inbox',  label: 'Inbox',  count: correspondence.filter(c => c.direction === 'inbound').length },
          { id: 'sent',   label: 'Sent',   count: correspondence.filter(c => c.direction === 'outbound').length },
          { id: 'all',    label: 'All',    count: correspondence.length },
        ]}
        activeTab={tab}
        onTabChange={setTab}
      />

      <FilterBar
        active={active}
        onChange={setActive}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search subject, number, preview…"
        filters={[
          { key: 'state',    label: 'State',    chips: [
            { id: 'open',             label: 'Open',             count: byDir.filter(c => c.state === 'open').length },
            { id: 'response-drafted', label: 'Response drafted', count: byDir.filter(c => c.state === 'response-drafted').length },
            { id: 'closed',           label: 'Closed',           count: byDir.filter(c => c.state === 'closed').length },
          ] },
          { key: 'priority', label: 'Priority', chips: [
            { id: 'critical', label: 'Critical', count: byDir.filter(c => c.priority === 'critical').length },
            { id: 'high',     label: 'High',     count: byDir.filter(c => c.priority === 'high').length },
            { id: 'standard', label: 'Standard', count: byDir.filter(c => c.priority === 'standard').length },
          ] },
        ]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', flex: 1, overflow: 'hidden' }}>
          {/* List */}
          <div className="rc-scroll" style={{ overflow: 'auto', borderRight: '1px solid var(--rc-border)', background: 'var(--rc-surface)' }}>
            {list.map(c => {
              const sb = STATE_BADGE[c.state]
              return (
                <div key={c.id}
                  onClick={() => setActive2(c.id)}
                  data-testid={`corrrow-${c.id}`}
                  style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--rc-divider)',
                    borderLeft: `3px solid ${currentId === c.id ? 'var(--rc-primary)' : 'transparent'}`,
                    background: currentId === c.id ? 'var(--rc-surface-selected)' : undefined,
                    cursor: 'pointer',
                  }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontFamily: 'var(--rc-font-mono)', color: 'var(--rc-text-muted)' }}>{c.number}</span>
                    <span className="rc-pill" style={{ background: sb.bg, color: sb.color, fontSize: 10 }}>{sb.label}</span>
                    {c.priority === 'critical' && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--rc-rejected)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Critical</span>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--rc-text-primary)' }}>{c.subject}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--rc-text-muted)', marginTop: 4, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>{c.preview}</div>
                  <div style={{ fontSize: 11, color: 'var(--rc-text-muted)', marginTop: 6 }}>
                    {c.authority} · {c.receivedAt}{c.dueAt ? ` · Due ${c.dueAt}` : ''}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Detail */}
          <div className="rc-scroll" style={{ overflow: 'auto', padding: 24 }}>
            {current ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontFamily: 'var(--rc-font-mono)', color: 'var(--rc-text-muted)' }}>{current.number}</span>
                  <span className="rc-pill" style={{ background: STATE_BADGE[current.state].bg, color: STATE_BADGE[current.state].color }}>{STATE_BADGE[current.state].label}</span>
                  <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, background: 'var(--rc-surface-tertiary)', color: 'var(--rc-text-secondary)' }}>{current.category}</span>
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 6px' }}>{current.subject}</h2>
                <div style={{ fontSize: 12, color: 'var(--rc-text-muted)', marginBottom: 18 }}>
                  From {current.authority} · Received {current.receivedAt}{current.dueAt ? ` · Response due ${current.dueAt}` : ''}
                </div>

                <div className="rc-card">
                  <div className="rc-card-body" style={{ fontSize: 13, color: 'var(--rc-text-secondary)', lineHeight: 1.7 }}>
                    <p style={{ margin: 0 }}>{current.preview}</p>
                    <p style={{ marginTop: 14 }}>
                      [Excerpt — full correspondence is mocked for the UI rewire.] The Authority requests a comprehensive response within the stipulated timeframe, addressing the deficiencies enumerated above. Failure to respond may result in suspension of the application per NDCTR 2019 Rule 24.
                    </p>
                  </div>
                </div>

                {/* State-based action buttons */}
                <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                  {current.state === 'open' && (
                    <button
                      className="rc-btn rc-btn-sm"
                      onClick={async () => {
                        await transitionCorrespondenceState(current.id, 'response-drafted')
                        await loadCorrespondence()
                      }}
                      data-testid="corr-draft-btn"
                    >
                      <i className="ti ti-edit"/> Draft Response
                    </button>
                  )}

                  {current.state === 'response-drafted' && (
                    <button
                      className="rc-btn rc-btn-sm rc-btn-primary"
                      onClick={async () => {
                        await transitionCorrespondenceState(current.id, 'closed')
                        await loadCorrespondence()
                      }}
                      data-testid="corr-mark-sent-btn"
                    >
                      <i className="ti ti-check"/> Mark Sent
                    </button>
                  )}

                  {current.state !== 'closed' && (
                    <button
                      className="rc-btn rc-btn-sm"
                      onClick={() => {
                        setPrefilledInput(
                          `CDSCO correspondence: ${current.subject}\n\n${current.preview}`
                        )
                        setActiveView('m6-qa')
                      }}
                      data-testid="corr-genai-btn"
                    >
                      <i className="ti ti-robot"/> Draft with AI
                    </button>
                  )}

                  <button className="rc-btn rc-btn-sm" onClick={() => exportCSV(timestampedName(`correspondence_${current.number}`), [{
                    number: current.number, subject: current.subject, direction: current.direction,
                    authority: current.authority, category: current.category, state: current.state,
                    priority: current.priority, received: current.receivedAt, due: current.dueAt ?? '',
                    content: current.preview,
                  }])} data-testid="corr-detail-export-btn"><i className="ti ti-file-export"/> Export</button>

                  {current.state !== 'closed' && (
                    <button className="rc-btn rc-btn-sm rc-btn-ghost" onClick={async () => {
                      await transitionCorrespondenceState(current.id, 'closed')
                      await loadCorrespondence()
                    }}><i className="ti ti-archive"/> Archive</button>
                  )}
                </div>
              </>
            ) : (
              <div className="rc-empty"><i className="ti ti-mail-off"/><div>Select an item to view details.</div></div>
            )}
          </div>
        </div>

      {/* New Correspondence modal */}
      {showNewForm && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{
            background: 'var(--rc-surface)',
            border: '1px solid var(--rc-border)',
            borderRadius: 'var(--rc-radius-lg)',
            padding: 28, minWidth: 440,
            boxShadow: 'var(--rc-shadow-xl)',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
            }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                New Correspondence
              </h3>
              <button
                className="rc-btn rc-btn-ghost rc-btn-sm"
                onClick={() => setShowNewForm(false)}
              >
                <i className="ti ti-x"/>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>
                  Subject *
                </label>
                <input
                  className="rc-input"
                  style={{ width: '100%' }}
                  placeholder="e.g. Response to CDSCO deficiency letter"
                  value={newSubject}
                  onChange={e => setNewSubject(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleNewResponse()}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>
                    Authority
                  </label>
                  <select
                    className="rc-input"
                    style={{ width: '100%' }}
                    value={newAuthority}
                    onChange={e => setNewAuthority(e.target.value)}
                  >
                    <option>CDSCO</option>
                    <option>DCGI</option>
                    <option>State FDA</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>
                    Category
                  </label>
                  <select
                    className="rc-input"
                    style={{ width: '100%' }}
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                  >
                    <option>Query</option>
                    <option>Deficiency Letter</option>
                    <option>CAPA Request</option>
                    <option>Acknowledgement</option>
                    <option>Approval</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>
                  Priority
                </label>
                <select
                  className="rc-input"
                  style={{ width: '100%' }}
                  value={newPriority}
                  onChange={e => setNewPriority(e.target.value)}
                >
                  <option value="standard">Standard</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="rc-btn" onClick={() => setShowNewForm(false)}>
                Cancel
              </button>
              <button
                className="rc-btn rc-btn-primary"
                onClick={handleNewResponse}
                disabled={!newSubject.trim() || newSubmitting}
              >
                {newSubmitting ? (
                  <><i className="ti ti-loader-2" style={{ animation: 'spin 1s linear infinite' }}/> Creating...</>
                ) : (
                  <><i className="ti ti-plus"/> Create</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
