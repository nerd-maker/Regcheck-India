'use client'

import { REGISTRATIONS } from '@/lib/mockData'
import { useWorkspace } from '@/lib/workspaceStore'
import PageHeader from '@/components/veeva/PageHeader'

const STATE_COLOR: Record<string, { bg: string; color: string }> = {
  'Effective':       { bg: 'var(--rc-approved-bg)', color: 'var(--rc-approved)' },
  'Expiring Soon':   { bg: 'var(--rc-review-bg)',   color: 'var(--rc-review)' },
  'Expired':         { bg: 'var(--rc-rejected-bg)', color: 'var(--rc-rejected)' },
  'Withdrawn':       { bg: 'var(--rc-superseded-bg)', color: 'var(--rc-superseded)' },
}

export default function RegistrationsView() {
  const { setActiveView } = useWorkspace()
  return (
    <div data-testid="view-registrations">
      <PageHeader
        crumbs={[{ label: 'Workspace', onClick: () => setActiveView('home') }, { label: 'Registrations' }]}
        title="Registrations"
        subtitle={`${REGISTRATIONS.length} active product registrations · India`}
        icon="ti-certificate"
        actions={
          <>
            <button className="rc-btn"><i className="ti ti-filter"/> Filter</button>
            <button className="rc-btn rc-btn-primary"><i className="ti ti-plus"/> New registration</button>
          </>
        }
      />
      <div style={{ padding: 24 }}>
        <div className="rc-card">
          <table className="rc-table">
            <thead>
              <tr>
                <th>Registration</th>
                <th>Product</th>
                <th>Certificate</th>
                <th>Market</th>
                <th>State</th>
                <th>Approved</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {REGISTRATIONS.map(r => {
                const st = STATE_COLOR[r.state]
                return (
                  <tr key={r.id} data-testid={`regrow-${r.id}`}>
                    <td><span className="rc-table-link" style={{ fontFamily: 'var(--rc-font-mono)', fontSize: 12 }}>{r.number}</span></td>
                    <td><strong>{r.product}</strong></td>
                    <td>{r.certificate}</td>
                    <td>{r.market}</td>
                    <td><span className="rc-pill" style={{ background: st.bg, color: st.color }}>{r.state}</span></td>
                    <td><span style={{ fontSize: 12, color: 'var(--rc-text-secondary)' }}>{r.approvedDate}</span></td>
                    <td><span style={{ fontSize: 12, color: 'var(--rc-text-secondary)' }}>{r.expiryDate}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
