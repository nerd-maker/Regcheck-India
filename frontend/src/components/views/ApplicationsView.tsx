'use client'

import { APPLICATIONS } from '@/lib/mockData'
import { useWorkspace } from '@/lib/workspaceStore'
import PageHeader from '@/components/veeva/PageHeader'

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  'Active':         { bg: 'var(--rc-effective-bg)', color: 'var(--rc-effective)' },
  'Pending CDSCO':  { bg: 'var(--rc-review-bg)',    color: 'var(--rc-review)' },
  'Approved':       { bg: 'var(--rc-approved-bg)',  color: 'var(--rc-approved)' },
  'On Hold':        { bg: 'var(--rc-rejected-bg)',  color: 'var(--rc-rejected)' },
}

export default function ApplicationsView() {
  const { setActiveView } = useWorkspace()
  return (
    <div data-testid="view-applications">
      <PageHeader
        crumbs={[{ label: 'Workspace', onClick: () => setActiveView('home') }, { label: 'Applications' }]}
        title="Applications"
        subtitle={`${APPLICATIONS.length} applications across all products`}
        icon="ti-stack-2"
        actions={
          <>
            <button className="rc-btn"><i className="ti ti-filter"/> Filter</button>
            <button className="rc-btn rc-btn-primary"><i className="ti ti-plus"/> New application</button>
          </>
        }
      />
      <div style={{ padding: 24 }}>
        <div className="rc-card">
          <table className="rc-table">
            <thead>
              <tr>
                <th>Application</th>
                <th>Product</th>
                <th>Sponsor</th>
                <th>Type</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Submissions</th>
                <th style={{ textAlign: 'right' }}>Registrations</th>
                <th>Owner</th>
                <th>Opened</th>
              </tr>
            </thead>
            <tbody>
              {APPLICATIONS.map(a => {
                const st = STATUS_COLOR[a.status]
                return (
                  <tr key={a.id} data-testid={`approw-${a.id}`}>
                    <td>
                      <div className="rc-table-link" style={{ fontWeight: 500 }}>{a.number}</div>
                    </td>
                    <td><strong>{a.product}</strong></td>
                    <td><span style={{ fontSize: 12, color: 'var(--rc-text-secondary)' }}>{a.sponsor}</span></td>
                    <td>{a.type}</td>
                    <td><span className="rc-pill" style={{ background: st.bg, color: st.color }}>{a.status}</span></td>
                    <td style={{ textAlign: 'right' }}>{a.submissions}</td>
                    <td style={{ textAlign: 'right' }}>{a.registrations}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="rc-avatar" style={{ width: 22, height: 22, fontSize: 9.5, background: 'linear-gradient(135deg,#93C5FD,#1A56DB)' }}>{a.owner.initials}</div>
                        <span style={{ fontSize: 12 }}>{a.owner.name.split(' ')[0]}</span>
                      </div>
                    </td>
                    <td><span style={{ fontSize: 12, color: 'var(--rc-text-secondary)' }}>{a.openedAt}</span></td>
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
