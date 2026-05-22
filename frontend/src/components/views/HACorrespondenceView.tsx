'use client'

import { useState } from 'react'
import { HA_CORRESPONDENCE } from '@/lib/mockData'
import { useWorkspace } from '@/lib/workspaceStore'
import PageHeader from '@/components/veeva/PageHeader'

const STATE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  'open':              { bg: 'var(--rc-rejected-bg)',  color: 'var(--rc-rejected)',  label: 'Open' },
  'response-drafted':  { bg: 'var(--rc-review-bg)',    color: 'var(--rc-review)',    label: 'Response Drafted' },
  'closed':            { bg: 'var(--rc-approved-bg)',  color: 'var(--rc-approved)',  label: 'Closed' },
}

export default function HACorrespondenceView() {
  const { setActiveView } = useWorkspace()
  const [tab, setTab] = useState('inbox')
  const list = HA_CORRESPONDENCE.filter(c =>
    tab === 'inbox'  ? c.direction === 'inbound'
    : tab === 'sent' ? c.direction === 'outbound'
    : true,
  )
  const [active, setActive] = useState<string | null>(list[0]?.id ?? null)
  const current = HA_CORRESPONDENCE.find(c => c.id === active)

  return (
    <div data-testid="view-correspondence" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        crumbs={[{ label: 'Workspace', onClick: () => setActiveView('home') }, { label: 'HA Correspondence' }]}
        title="Health Authority Correspondence"
        subtitle="CDSCO · DCGI · State FDA"
        icon="ti-mail"
        actions={
          <>
            <button className="rc-btn"><i className="ti ti-filter"/> Filter</button>
            <button className="rc-btn rc-btn-primary"><i className="ti ti-edit"/> New Response</button>
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

      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', flex: 1, overflow: 'hidden' }}>
        {/* List */}
        <div className="rc-scroll" style={{ overflow: 'auto', borderRight: '1px solid var(--rc-border)', background: 'var(--rc-surface)' }}>
          {list.map(c => {
            const sb = STATE_BADGE[c.state]
            return (
              <div key={c.id}
                onClick={() => setActive(c.id)}
                data-testid={`corrrow-${c.id}`}
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--rc-divider)',
                  borderLeft: `3px solid ${active === c.id ? 'var(--rc-primary)' : 'transparent'}`,
                  background: active === c.id ? 'var(--rc-surface-selected)' : undefined,
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
                <button className="rc-btn rc-btn-primary"><i className="ti ti-edit"/> Draft response</button>
                <button className="rc-btn"><i className="ti ti-sparkles"/> Generate with AI</button>
                <button className="rc-btn"><i className="ti ti-file-export"/> Export</button>
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
