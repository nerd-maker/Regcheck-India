'use client'

import { useState, useEffect, useMemo } from 'react'
// SPRINT4: removed mockup
// import { COMPLIANCE_SCORES } from '@/lib/mockData'
import { useSubmissions } from '@/hooks/useWorkspaceData'
import { useWorkspace } from '@/lib/workspaceStore'
import PageHeader from '@/components/veeva/PageHeader'
import { fetchComplianceByAgent, fetchSubmissionThroughput } from '@/services/api'


const RANGES = [
  { id: '7',   label: 'Last 7 days' },
  { id: '30',  label: 'Last 30 days' },
  { id: '90',  label: 'Last 90 days' },
  { id: 'ytd', label: 'Year to date' },
  { id: 'all', label: 'All time' },
]

export default function ReportsView() {
  const { setActiveView, setSelectedSubmissionId } = useWorkspace()
  const [range, setRange] = useState('30')
  const [showRange, setShowRange] = useState(false)
  const rangeLabel = RANGES.find(r => r.id === range)?.label ?? 'Last 30 days'

  const handlePrint = () => {
    document.body.classList.add('rc-printing')
    window.print()
    setTimeout(() => {
      document.body.classList.remove('rc-printing')
    }, 1000)
  }

  const { data: submissions, loading } = useSubmissions()

  const [frameworks, setFrameworks] = useState<any[]>([])
  const [throughputData, setThroughputData] = useState<any>(null)
  const [reportsLoading, setReportsLoading] = useState(true)

  useEffect(() => {
    setReportsLoading(true)
    Promise.all([
      fetchComplianceByAgent().catch(() => ({ frameworks: [] })),
      fetchSubmissionThroughput().catch(() => ({ monthly_data: [] }))
    ]).then(([complianceRes, throughputRes]) => {
      setFrameworks(complianceRes.frameworks || [])
      
      const monthly = throughputRes.monthly_data || []
      let totalSubmitted = 0
      let totalApproved = 0
      let totalInProgress = 0
      
      monthly.forEach((m: any) => {
        totalSubmitted += m.total || 0
        totalApproved += m.approved || 0
        totalInProgress += m.in_progress || 0
      })
      
      setThroughputData({
        submitted: totalSubmitted,
        approved: totalApproved,
        deficiency: 0,
        inReview: totalInProgress
      })
    }).finally(() => {
      setReportsLoading(false)
    })
  }, [])

  const throughput = useMemo(() => {
    if (!throughputData) {
      return {
        Submitted: 0,
        Approved: 0,
        Deficiency: 0,
        'In Review': 0,
      }
    }
    const factor = range === '7' ? 0.25 : range === '30' ? 1.0 : range === '90' ? 3.0 : range === 'ytd' ? 6.0 : 6.0
    return {
      Submitted: Math.round((throughputData.submitted / 6) * factor) || 0,
      Approved: Math.round((throughputData.approved / 6) * factor) || 0,
      Deficiency: Math.round((throughputData.deficiency / 6) * factor) || 0,
      'In Review': Math.round((throughputData.inReview / 6) * factor) || 0,
    }
  }, [throughputData, range])

  const frameworkScores = useMemo(() => {
    return frameworks.map(f => {
      const colors = {
        "schedule_y":     "#B45309",
        "ich_e6r3":       "#10B981",
        "completeness":   "#3B82F6",
        "pii_anonymiser": "#8B5CF6",
        "sae_classifier": "#EC4899",
        "cross_doc":      "#F59E0B",
      } as Record<string, string>
      return {
        name: f.display_name,
        score: f.avg_score || 0,
        color: colors[f.agent_type] || "#6B7280"
      }
    })
  }, [frameworks])

  const sortedSubmissions = useMemo(() => {
    return [...submissions].sort((a, b) => b.openGaps - a.openGaps).slice(0, 5)
  }, [submissions])

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
            <button className="rc-btn rc-btn-primary" onClick={handlePrint} data-testid="reports-pdf-btn">
              <i className="ti ti-printer"/> Print / PDF
            </button>
          </>
        }
      />

      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="rc-card">
          <div className="rc-card-header"><span>Compliance across frameworks</span></div>
          <div className="rc-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {reportsLoading ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--rc-text-muted)' }}>
                <i className="ti ti-loader animate-spin" style={{ marginRight: 8, display: 'inline-block', animation: 'spin 1s linear infinite' }} />
                Loading framework scores...
              </div>
            ) : frameworkScores.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--rc-text-muted)' }}>
                No completed compliance scans found.
              </div>
            ) : (
              frameworkScores.map((c, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--rc-text-secondary)' }}>{c.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: c.color }}>{c.score}%</span>
                  </div>
                  <div className="rc-scorebar" style={{ height: 6 }}><div className="rc-scorebar-fill" style={{ width: `${c.score}%`, background: c.color }}/></div>
                </div>
              ))
            )}
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
                {sortedSubmissions.map(s => (
                  <tr key={s.id}>
                    <td>
                      <button
                        className="rc-table-link"
                        onClick={() => {
                          setSelectedSubmissionId(s.id)
                          setActiveView('submission-detail')
                        }}
                        style={{ background: 'none', border: 0, padding: 0, fontFamily: 'inherit', fontSize: 'inherit', cursor: 'pointer', textAlign: 'left' }}
                      >
                        {s.name}
                      </button>
                      <div style={{ fontSize: 11, color: 'var(--rc-text-muted)', fontFamily: 'var(--rc-font-mono)' }}>{s.number}</div>
                    </td>
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
