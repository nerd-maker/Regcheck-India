'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { HOME_KPIS, COMPLIANCE_SCORES, AUDIT_EVENTS, SubmissionRecord } from '@/lib/mockData'
import { useWorkspace } from '@/lib/workspaceStore'
import StatusBadge from '@/components/veeva/StatusBadge'
import PageHeader from '@/components/veeva/PageHeader'
import NewSubmissionModal from '@/components/NewSubmissionModal'

export default function HomeView() {
  const router = useRouter()
  const { submissions, setSelectedSubmissionId, setActiveView } = useWorkspace()
  const [newSubOpen, setNewSubOpen] = useState(false)

  const pinned = submissions.slice(0, 3)
  const myQueue = submissions.filter(s => s.state === 'review' || s.state === 'rejected' || s.openGaps > 0).slice(0, 4)

  const handleExportCSV = () => {
    const headers = ['Submission ID', 'Drug', 'Type', 'State', 'Gaps', 'Compliance %']
    const rows = myQueue.map(s => [
      s.number,
      s.product,
      s.type,
      s.stateLabel ?? s.state,
      s.openGaps,
      `${s.complianceScore}%`
    ])
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `regcheck_queue_export_${new Date().toISOString().slice(0,10)}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div data-testid="view-home">
      <PageHeader
        crumbs={[{ label: 'Workspace' }, { label: 'Home' }]}
        title="Good afternoon, Anika"
        subtitle="India Regulatory Vault · 12 active submissions · 3 awaiting your review"
        icon="ti-home-2"
        actions={
          <>
            <button className="rc-btn" onClick={handleExportCSV} data-testid="home-export-btn">
              <i className="ti ti-download"/> Export
            </button>
            <button className="rc-btn rc-btn-primary" onClick={() => setNewSubOpen(true)} data-testid="home-new-submission">
              <i className="ti ti-plus"/> New submission
            </button>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {HOME_KPIS.map((k, i) => (
            <div key={i} className="rc-kpi" data-testid={`home-kpi-${i}`}>
              <div className="rc-kpi-label">{k.label}</div>
              <div className="rc-kpi-value">{k.value}</div>
              <div className={`rc-kpi-delta ${k.trend}`}>
                <i className={`ti ${k.trend === 'up' ? 'ti-trending-up' : k.trend === 'down' ? 'ti-trending-down' : 'ti-minus'}`}/>
                {k.delta} <span style={{ color: 'var(--rc-text-muted)' }}>· {k.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Two-column body */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
          {/* Left: My queue */}
          <div className="rc-card" data-testid="my-queue-card">
            <div className="rc-card-header">
              <span>My Queue · Needs Action</span>
              <Link href="/app/submissions" className="rc-btn rc-btn-ghost rc-btn-sm" style={{ textDecoration: 'none' }}>
                View all <i className="ti ti-arrow-right" style={{ fontSize: 13 }}/>
              </Link>
            </div>
            <table className="rc-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }}></th>
                  <th>Submission</th>
                  <th>Type</th>
                  <th>State</th>
                  <th style={{ textAlign: 'right' }}>Gaps</th>
                  <th style={{ width: 120 }}>Compliance</th>
                </tr>
              </thead>
              <tbody>
                {myQueue.map(s => (
                  <tr key={s.id} onClick={() => {
                    setSelectedSubmissionId(s.id)
                    router.push(`/app/submissions/${s.id}`)
                  }} data-testid={`queue-row-${s.id}`} style={{ cursor: 'pointer' }}>
                    <td>
                      <div style={{
                        width: 18, height: 18, borderRadius: 4,
                        background: s.riskLevel === 'high' ? 'var(--rc-rejected-bg)' : s.riskLevel === 'medium' ? 'var(--rc-review-bg)' : 'var(--rc-approved-bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <i className="ti ti-flag" style={{ fontSize: 11, color: s.riskLevel === 'high' ? 'var(--rc-rejected)' : s.riskLevel === 'medium' ? 'var(--rc-review)' : 'var(--rc-approved)' }}/>
                      </div>
                    </td>
                    <td>
                      <div className="rc-table-link" style={{ fontWeight: 500 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--rc-text-muted)' }}>{s.number} · {s.product}</div>
                    </td>
                    <td><span style={{ fontSize: 11.5, color: 'var(--rc-text-secondary)' }}>{s.type}</span></td>
                    <td><StatusBadge state={s.state} label={s.stateLabel} size="sm"/></td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: s.openGaps > 0 ? 'var(--rc-rejected)' : 'var(--rc-approved)' }}>{s.openGaps}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="rc-scorebar" style={{ flex: 1 }}>
                          <div className="rc-scorebar-fill" style={{
                            width: `${s.complianceScore}%`,
                            background: s.complianceScore >= 85 ? 'var(--rc-approved)' : s.complianceScore >= 65 ? 'var(--rc-review)' : 'var(--rc-rejected)',
                          }}/>
                        </div>
                        <span style={{ fontSize: 11.5, fontWeight: 600, minWidth: 30, textAlign: 'right' }}>{s.complianceScore}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Right: Compliance & Recent */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="rc-card">
              <div className="rc-card-header">
                <span>Vault-wide compliance</span>
                <i className="ti ti-info-circle" style={{ fontSize: 13, color: 'var(--rc-text-muted)' }} title="Aggregate score across active submissions"/>
              </div>
              <div className="rc-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {COMPLIANCE_SCORES.map((c, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--rc-text-secondary)' }}>{c.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: c.color }}>{c.score}%</span>
                    </div>
                    <div className="rc-scorebar"><div className="rc-scorebar-fill" style={{ width: `${c.score}%`, background: c.color }}/></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rc-card">
              <div className="rc-card-header">
                <span>Recent activity</span>
                <Link href="/app/audit-trail" className="rc-btn rc-btn-ghost rc-btn-sm" style={{ textDecoration: 'none' }}>
                  Audit trail
                </Link>
              </div>
              <div>
                {AUDIT_EVENTS.slice(0, 5).map(e => (
                  <div key={e.id} style={{
                    display: 'flex', gap: 10, padding: '10px 14px',
                    borderBottom: '1px solid var(--rc-divider)',
                  }}>
                    <div className="rc-avatar" style={{ width: 22, height: 22, fontSize: 9.5, background: 'linear-gradient(135deg,#93C5FD,#1A56DB)', flexShrink: 0 }}>{e.initials}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, color: 'var(--rc-text-primary)', fontWeight: 500 }}>{e.action}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--rc-text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.target}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--rc-text-muted)', marginTop: 2 }}>{e.user} · {e.ts}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Pinned submissions */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--rc-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
            Pinned submissions
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {pinned.map(s => (
              <div key={s.id} className="rc-card" style={{ padding: 14, cursor: 'pointer' }}
                onClick={() => {
                  setSelectedSubmissionId(s.id)
                  router.push(`/app/submissions/${s.id}`)
                }}
                data-testid={`pinned-${s.id}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11.5, fontFamily: 'var(--rc-font-mono)', color: 'var(--rc-text-muted)' }}>{s.number}</span>
                  <StatusBadge state={s.state} label={s.stateLabel} size="sm"/>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--rc-text-primary)', marginBottom: 4 }}>{s.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--rc-text-muted)', marginBottom: 10 }}>{s.type} · {s.phase} · {s.indication}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="rc-scorebar" style={{ flex: 1 }}>
                    <div className="rc-scorebar-fill" style={{
                      width: `${s.complianceScore}%`,
                      background: s.complianceScore >= 85 ? 'var(--rc-approved)' : s.complianceScore >= 65 ? 'var(--rc-review)' : 'var(--rc-rejected)',
                    }}/>
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 600 }}>{s.complianceScore}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <NewSubmissionModal isOpen={newSubOpen} onClose={() => setNewSubOpen(false)} />
    </div>
  )
}

