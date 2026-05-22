'use client'

import { COMPLIANCE_SCORES, SUBMISSIONS } from '@/lib/mockData'
import { useWorkspace } from '@/lib/workspaceStore'
import PageHeader from '@/components/veeva/PageHeader'

export default function ReportsView() {
  const { setActiveView } = useWorkspace()
  return (
    <div data-testid="view-reports">
      <PageHeader
        crumbs={[{ label: 'Workspace', onClick: () => setActiveView('home') }, { label: 'Reports' }]}
        title="Reports"
        subtitle="Vault-wide regulatory analytics"
        icon="ti-chart-line"
        actions={<><button className="rc-btn"><i className="ti ti-calendar"/> Last 30 days</button><button className="rc-btn rc-btn-primary"><i className="ti ti-download"/> Export PDF</button></>}
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
          <div className="rc-card-header"><span>Submission throughput</span></div>
          <div className="rc-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { l: 'Submitted',      v: 14, c: 'var(--rc-effective)' },
                { l: 'Approved',       v: 9,  c: 'var(--rc-approved)' },
                { l: 'Deficiency',     v: 3,  c: 'var(--rc-rejected)' },
                { l: 'In Review',      v: 6,  c: 'var(--rc-review)' },
              ].map((t, i) => (
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
