'use client'

import { useState, useEffect, useMemo } from 'react'
// SPRINT4: removed mockup
// import { HOME_KPIS, COMPLIANCE_SCORES, AUDIT_EVENTS } from '@/lib/mockData'
import { useWorkspace } from '@/lib/workspaceStore'
import StatusBadge from '@/components/veeva/StatusBadge'
import PageHeader from '@/components/veeva/PageHeader'
import { exportCSV, timestampedName } from '@/lib/csv'
import { useSubmissions } from '@/hooks/useWorkspaceData'
import NewSubmissionModal from '@/components/NewSubmissionModal'
import { createSubmission } from '@/services/workspaceData'
import { fetchDashboardKPIs, fetchRecentActivity } from '@/services/api'

export default function HomeView() {
  const { setActiveView, setSelectedSubmissionId, openInspector } = useWorkspace()

  const { data: submissions, loading, reload } = useSubmissions()
  const [showNewModal, setShowNewModal] = useState(false)

  const [kpis, setKpis] = useState<any>(null)
  const [activities, setActivities] = useState<any[]>([])
  const [homeLoading, setHomeLoading] = useState(true)

  useEffect(() => {
    setHomeLoading(true)
    Promise.all([
      fetchDashboardKPIs().catch(() => null),
      fetchRecentActivity(5).catch(() => ({ activities: [] }))
    ]).then(([kpiData, activityData]) => {
      if (kpiData) setKpis(kpiData)
      setActivities(activityData.activities || [])
    }).finally(() => {
      setHomeLoading(false)
    })
  }, [])

  const handleCreate = async (formData: any) => {
    await createSubmission(formData)
    await reload()
    setShowNewModal(false)
  }

  const pinned = useMemo(() => submissions.slice(0, 3), [submissions])
  
  const myQueue = useMemo(() => {
    return submissions.filter(s => s.state === 'review' || s.state === 'rejected' || s.openGaps > 0).slice(0, 4)
  }, [submissions])

  const reviewCount = useMemo(() => {
    return submissions.filter(s => s.state === 'review').length
  }, [submissions])

  const documentStatesBreakdown = useMemo(() => {
    if (!kpis || !kpis.documents_by_state) return []
    const states = kpis.documents_by_state
    const stateColors = {
      "draft": "var(--rc-text-secondary)",
      "in_review": "var(--rc-review)",
      "approved": "var(--rc-approved)",
      "effective": "var(--rc-effective)",
      "rejected": "var(--rc-rejected)",
      "superseded": "var(--rc-text-muted)"
    } as Record<string, string>
    const stateLabels = {
      "draft": "Draft",
      "in_review": "In Review",
      "approved": "Approved",
      "effective": "Submitted",
      "rejected": "Rejected",
      "superseded": "Superseded"
    } as Record<string, string>
    
    const order = ["draft", "in_review", "approved", "effective", "rejected", "superseded"]
    return order.map(st => {
      const count = states[st] || 0
      return {
        name: stateLabels[st] || st,
        count: count,
        color: stateColors[st] || "var(--rc-primary)"
      }
    }).filter(item => item.count > 0)
  }, [kpis])

  const dynamicKPIs = useMemo(() => {
    return [
      {
        label: 'Active Submissions',
        value: kpis ? kpis.active_submissions : submissions.length,
        delta: '+2', trend: 'up' as const, sub: 'vs last week'
      },
      {
        label: 'Open Critical Gaps',
        value: kpis ? kpis.open_critical_gaps : submissions.reduce((acc, s) => acc + s.openGaps, 0),
        delta: '-3', trend: 'down' as const, sub: 'this sprint'
      },
      {
        label: 'Avg Compliance Score',
        value: kpis && kpis.avg_compliance_score !== null ? `${kpis.avg_compliance_score}%` : '—',
        delta: '+4%', trend: 'up' as const, sub: 'last 30 days'
      },
      {
        label: 'HA Queries Pending',
        value: kpis ? kpis.ha_queries_pending : 0,
        delta: '+1', trend: 'up' as const, sub: 'requires action'
      }
    ]
  }, [kpis, submissions])

  const handleExport = () => exportCSV(
    timestampedName('regcheck_home_kpis'),
    [
      ...dynamicKPIs.map(k => ({ section: 'KPI', name: k.label, value: String(k.value), delta: k.delta, trend: k.trend })),
      ...documentStatesBreakdown.map(c => ({ section: 'Document State', name: c.name, value: String(c.count), delta: '', trend: '' })),
    ],
    ['section', 'name', 'value', 'delta', 'trend'],
  )

  return (
    <div data-testid="view-home">
      <PageHeader
        crumbs={[{ label: 'Workspace' }, { label: 'Home' }]}
        title="Good afternoon, Anika"
        subtitle={`India Regulatory Vault · ${submissions.length || 12} active submissions · ${reviewCount || 3} awaiting your review`}
        icon="ti-home-2"
        actions={
          <>
            <button className="rc-btn" onClick={handleExport} data-testid="home-export-btn"><i className="ti ti-download"/> Export</button>
            <button className="rc-btn rc-btn-primary" onClick={() => setShowNewModal(true)} data-testid="home-new-submission">
              <i className="ti ti-plus"/> New submission
            </button>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {dynamicKPIs.map((k, i) => (
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
              <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setActiveView('submissions')}>View all <i className="ti ti-arrow-right" style={{ fontSize: 13 }}/></button>
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
                      setActiveView('submission-detail')
                    }} data-testid={`queue-row-${s.id}`}>
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
                  {myQueue.length === 0 && (
                    <tr><td colSpan={6}><div className="rc-empty"><i className="ti ti-circle-check"/><div>No pending tasks in your queue.</div></div></td></tr>
                  )}
                </tbody>
              </table>
          </div>

          {/* Right: Compliance & Recent */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="rc-card">
              <div className="rc-card-header">
                <span>Document lifecycle states</span>
                <i className="ti ti-info-circle" style={{ fontSize: 13, color: 'var(--rc-text-muted)' }} title="Documents in the vault grouped by current lifecycle state"/>
              </div>
              <div className="rc-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {homeLoading ? (
                  <div style={{ padding: '10px 0', textAlign: 'center', color: 'var(--rc-text-muted)' }}>
                    <i className="ti ti-loader animate-spin" style={{ marginRight: 8, display: 'inline-block', animation: 'spin 1s linear infinite' }} />
                    Loading breakdown...
                  </div>
                ) : documentStatesBreakdown.length === 0 ? (
                  <div style={{ padding: '10px 0', textAlign: 'center', color: 'var(--rc-text-muted)' }}>
                    No documents in the vault.
                  </div>
                ) : (
                  (() => {
                    const total = documentStatesBreakdown.reduce((acc, curr) => acc + curr.count, 0)
                    return documentStatesBreakdown.map((c, i) => {
                      const percentage = total > 0 ? (c.count / total) * 100 : 0
                      return (
                        <div key={i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: 'var(--rc-text-secondary)' }}>{c.name}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: c.color }}>{c.count} ({Math.round(percentage)}%)</span>
                          </div>
                          <div className="rc-scorebar" style={{ height: 6 }}><div className="rc-scorebar-fill" style={{ width: `${percentage}%`, background: c.color }}/></div>
                        </div>
                      )
                    })
                  })()
                )}
              </div>
            </div>

            <div className="rc-card">
              <div className="rc-card-header">
                <span>Recent activity</span>
                <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setActiveView('audit-trail')}>Audit trail</button>
              </div>
              <div>
                {activities.slice(0, 5).map(e => {
                  const tsFormatted = e.timestamp ? new Date(e.timestamp).toLocaleString('en-IN') : ''
                  return (
                    <div key={e.id} style={{
                      display: 'flex', gap: 10, padding: '10px 14px',
                      borderBottom: '1px solid var(--rc-divider)',
                    }}>
                      <div className="rc-avatar" style={{ width: 22, height: 22, fontSize: 9.5, background: 'linear-gradient(135deg,#93C5FD,#1A56DB)', flexShrink: 0 }}>
                        {e.user_initials}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, color: 'var(--rc-text-primary)', fontWeight: 500 }}>{e.label}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--rc-text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.sublabel}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--rc-text-muted)', marginTop: 2 }}>{e.user_name} · {tsFormatted}</div>
                      </div>
                    </div>
                  )
                })}
                {activities.length === 0 && (
                  <div className="rc-empty" style={{ padding: 20 }}>
                    {homeLoading ? (
                      <>
                        <i className="ti ti-loader animate-spin" style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }} />
                        <div>Loading recent activity...</div>
                      </>
                    ) : (
                      <>
                        <i className="ti ti-bell-off" />
                        <div>No recent activity.</div>
                      </>
                    )}
                  </div>
                )}
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
                  onClick={() => { setSelectedSubmissionId(s.id); setActiveView('submission-detail'); }}
                  data-testid={`pinned-${s.id}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
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
              {pinned.length === 0 && (
                <div className="rc-empty" style={{ gridColumn: 'span 3' }}><i className="ti ti-folder-off"/><div>No pinned submissions.</div></div>
              )}
            </div>
        </div>
      </div>
      <NewSubmissionModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreate={handleCreate}
      />
    </div>
  )
}
