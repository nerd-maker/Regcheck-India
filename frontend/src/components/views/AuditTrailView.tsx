'use client'

import { AUDIT_EVENTS } from '@/lib/mockData'
import { useWorkspace } from '@/lib/workspaceStore'
import PageHeader from '@/components/veeva/PageHeader'

export default function AuditTrailView() {
  const { setActiveView } = useWorkspace()
  return (
    <div data-testid="view-audit">
      <PageHeader
        crumbs={[{ label: 'Workspace', onClick: () => setActiveView('home') }, { label: 'Audit Trail' }]}
        title="Audit Trail"
        subtitle="21 CFR Part 11 · DPDP Act 2023 · Immutable log"
        icon="ti-clock-history"
        actions={
          <>
            <button className="rc-btn"><i className="ti ti-filter"/> Filter</button>
            <button className="rc-btn"><i className="ti ti-download"/> Export (CSV)</button>
            <button className="rc-btn"><i className="ti ti-shield-lock"/> e-Sign verify</button>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        <div className="rc-card">
          <table className="rc-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {AUDIT_EVENTS.map(e => (
                <tr key={e.id} data-testid={`auditrow-${e.id}`}>
                  <td style={{ fontFamily: 'var(--rc-font-mono)', fontSize: 11.5, color: 'var(--rc-text-secondary)', whiteSpace: 'nowrap' }}>{e.ts}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="rc-avatar" style={{ width: 22, height: 22, fontSize: 9.5, background: 'linear-gradient(135deg,#93C5FD,#1A56DB)' }}>{e.initials}</div>
                      <span style={{ fontSize: 12 }}>{e.user}</span>
                    </div>
                  </td>
                  <td><span style={{ fontSize: 12, fontWeight: 500 }}>{e.action}</span></td>
                  <td><span style={{ fontSize: 12, color: 'var(--rc-text-secondary)' }}>{e.target}</span></td>
                  <td><span style={{ fontSize: 11.5, color: 'var(--rc-text-muted)' }}>{e.meta}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
