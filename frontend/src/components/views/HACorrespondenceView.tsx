'use client'

import { useState, useMemo } from 'react'
import { HA_CORRESPONDENCE } from '@/lib/mockData'
import { useWorkspace } from '@/lib/workspaceStore'
import PageHeader from '@/components/veeva/PageHeader'
import FilterBar from '@/components/veeva/FilterBar'
import { exportCSV, timestampedName } from '@/lib/csv'

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

  const byDir = useMemo(() => HA_CORRESPONDENCE.filter(c =>
    tab === 'inbox'  ? c.direction === 'inbound'
    : tab === 'sent' ? c.direction === 'outbound'
    : true,
  ), [tab])

  const list = useMemo(() => byDir.filter(c => {
    if (active.state    && c.state    !== active.state)    return false
    if (active.priority && c.priority !== active.priority) return false
    if (active.category && c.category !== active.category) return false
    if (search && !`${c.number} ${c.subject} ${c.preview}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [byDir, active, search])

  const [active2, setActive2] = useState<string | null>(list[0]?.id ?? null)
  const current = HA_CORRESPONDENCE.find(c => c.id === active2) ?? list[0]
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
            <button className="rc-btn rc-btn-primary" data-testid="corr-new-btn"><i className="ti ti-edit"/> New Response</button>
          </>
        }
        tabs={[
          { id: 'inbox',  label: 'Inbox',  count: HA_CORRESPONDENCE.filter(c => c.direction === 'inbound').length },
          { id: 'sent',   label: 'Sent',   count: HA_CORRESPONDENCE.filter(c => c.direction === 'outbound').length },
          { id: 'all',    label: 'All',    count: HA_CORRESPONDENCE.length },
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

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="rc-btn rc-btn-primary" data-testid="corr-draft-btn"><i className="ti ti-edit"/> Draft response</button>
                <button className="rc-btn" onClick={() => {
                  setPrefilledInput(`Draft a CDSCO response to the following correspondence:\n\nNumber: ${current.number}\nSubject: ${current.subject}\nCategory: ${current.category}\nAuthority: ${current.authority}\nReceived: ${current.receivedAt}\n${current.dueAt ? `Due: ${current.dueAt}\n` : ''}\nContent:\n${current.preview}\n\nGenerate a response that addresses the deficiencies, cites the relevant NDCTR 2019 / Schedule Y / ICH provisions, and includes a CAPA plan.`)
                  setActiveView('m6-qa')
                }} data-testid="corr-genai-btn"><i className="ti ti-sparkles"/> Generate with AI</button>
                <button className="rc-btn" onClick={() => exportCSV(timestampedName(`correspondence_${current.number}`), [{
                  number: current.number, subject: current.subject, direction: current.direction,
                  authority: current.authority, category: current.category, state: current.state,
                  priority: current.priority, received: current.receivedAt, due: current.dueAt ?? '',
                  content: current.preview,
                }])} data-testid="corr-detail-export-btn"><i className="ti ti-file-export"/> Export</button>
                <button className="rc-btn rc-btn-ghost"><i className="ti ti-archive"/> Archive</button>
              </div>
            </>
          ) : (
            <div className="rc-empty"><i className="ti ti-mail-off"/><div>Select an item to view details.</div></div>
          )}
        </div>
      </div>
    </div>
  )
}
