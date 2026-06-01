'use client'

import { useState } from 'react'
import { COMPLIANCE_SCORES, SUBMISSIONS } from '@/lib/mockData'
import { useWorkspace } from '@/lib/workspaceStore'
import PageHeader from '@/components/veeva/PageHeader'

const RANGES = [
  { id: '7',   label: 'Last 7 days' },
  { id: '30',  label: 'Last 30 days' },
  { id: '90',  label: 'Last 90 days' },
  { id: 'ytd', label: 'Year to date' },
  { id: 'all', label: 'All time' },
]

export default function ReportsView() {
  const { setActiveView } = useWorkspace()
  const [range, setRange] = useState('30')
  const [showRange, setShowRange] = useState(false)
  const rangeLabel = RANGES.find(r => r.id === range)?.label ?? 'Last 30 days'

  const factor = range === '7' ? 0.30 : range === '30' ? 1 : range === '90' ? 2.4 : range === 'ytd' ? 4.2 : 6.0
  const throughput = {
    Submitted: Math.round(14 * factor),
    Approved:  Math.round(9 * factor),
    Deficiency:Math.round(3 * factor),
    'In Review':Math.round(6 * factor),
  }

  return (
    <div data-testid="view-reports">
      <PageHeader
        crumbs={[{ label: 'Workspace', onClick: () => setActiveView('home') }, { label: 'Reports' }]}
        title="Reports"
        subtitle={`Vault-wide regulatory analytics · ${rangeLabel}`}
        icon="ti-chart-line"
        actions={
          <>
            <div style={{ position: 'relative' }}>
              <button className="rc-btn" onClick={() => setShowRange(s => !s)} data-testid="reports-range-btn">
                <i className="ti ti-calendar"/> {rangeLabel} <i className="ti ti-chevron-down" style={{ fontSize: 12 }}/>
              </button>
              {showRange && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: 'var(--rc-surface)', border: '1px solid var(--rc-border)', borderRadius: 'var(--rc-radius-md)', boxShadow: 'var(--rc-shadow-md)', minWidth: 180, zIndex: 30 }}>
                  {RANGES.map(r => (
                    <button key={r.id}
                      className={`rc-nav-item${range === r.id ? ' is-active' : ''}`}
                      onClick={() => { setRange(r.id); setShowRange(false); }}
                      data-testid={`range-${r.id}`}
                    >{r.label}</button>
                  ))}
                </div>
              )}
            </div>
            <button className="rc-btn rc-btn-primary" onClick={() => window.print()} data-testid="reports-pdf-btn">
              <i className="ti ti-printer"/> Print / PDF
            </button>
          </>
        }
      />

      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="rc-card">
          <div className="rc-card-header"><span>Compliance across frameworks</span></div>
          <div className="rc-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {COMPLIANCE_SCORES.map((c, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--rc-text-secondary)' }}>{c.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: c.color }}>{c.score}%</span>
                </div>
                <div className="rc-scorebar" style={{ height: 6 }}><div className="rc-scorebar-fill" style={{ width: `${c.score}%`, background: c.color }}/></div>
              </div>
            ))}
          </div>
        </div>

        <div className="rc-card">
          <div className="rc-card-header"><span>Submission throughput · {rangeLabel}</span></div>
          <div className="rc-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {([
                { l: 'Submitted',  v: throughput.Submitted,    c: 'var(--rc-effective)' },
                { l: 'Approved',   v: throughput.Approved,     c: 'var(--rc-approved)' },
                { l: 'Deficiency', v: throughput.Deficiency,   c: 'var(--rc-rejected)' },
                { l: 'In Review',  v: throughput['In Review'], c: 'var(--rc-review)' },
              ]).map((t, i) => (
                <div key={i} style={{ textAlign: 'center', padding: 12, background: 'var(--rc-surface-secondary)', borderRadius: 6 }}>
                  <div style={{ fontSize: 24, fontWeight: 600, color: t.c }}>{t.v}</div>
                  <div style={{ fontSize: 11, color: 'var(--rc-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4, fontWeight: 600 }}>{t.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rc-card" style={{ gridColumn: 'span 2' }}>
          <div className="rc-card-header"><span>Top submissions by gap count</span></div>
          <table className="rc-table">
            <thead><tr><th>Submission</th><th>Product</th><th>Phase</th><th style={{ textAlign: 'right' }}>Open Gaps</th><th style={{ width: 140 }}>Compliance</th></tr></thead>
            <tbody>
              {[...SUBMISSIONS].sort((a, b) => b.openGaps - a.openGaps).slice(0, 5).map(s => (
                <tr key={s.id}>
                  <td><span className="rc-table-link">{s.name}</span><div style={{ fontSize: 11, color: 'var(--rc-text-muted)', fontFamily: 'var(--rc-font-mono)' }}>{s.number}</div></td>
                  <td>{s.product}</td>
                  <td>{s.phase}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: s.openGaps > 0 ? 'var(--rc-rejected)' : 'var(--rc-approved)' }}>{s.openGaps}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="rc-scorebar" style={{ flex: 1 }}>
                        <div className="rc-scorebar-fill" style={{ width: `${s.complianceScore}%`, background: s.complianceScore >= 85 ? 'var(--rc-approved)' : s.complianceScore >= 65 ? 'var(--rc-review)' : 'var(--rc-rejected)' }}/>
                      </div>
                      <span style={{ fontSize: 11.5, fontWeight: 600 }}>{s.complianceScore}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
