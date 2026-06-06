'use client'

import { useState, useMemo, useEffect } from 'react'
import { useWorkspace } from '@/lib/workspaceStore'
import PageHeader from '@/components/veeva/PageHeader'
import FilterBar from '@/components/veeva/FilterBar'
import { exportCSV, timestampedName } from '@/lib/csv'
import { useApplications } from '@/hooks/useWorkspaceData'

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  'Active':         { bg: 'var(--rc-effective-bg)', color: 'var(--rc-effective)' },
  'Pending CDSCO':  { bg: 'var(--rc-review-bg)',    color: 'var(--rc-review)' },
  'Approved':       { bg: 'var(--rc-approved-bg)',  color: 'var(--rc-approved)' },
  'On Hold':        { bg: 'var(--rc-rejected-bg)',  color: 'var(--rc-rejected)' },
}

export default function ApplicationsView() {
  const { setActiveView } = useWorkspace()
  const [active, setActive] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')

  const { data: applications, loading } = useApplications()

  const STATUS_OPTS = ['Active', 'Pending CDSCO', 'Approved', 'On Hold']
  const TYPE_OPTS = ['Clinical Trial', 'New Drug', 'Subsequent New Drug']

  const filtered = useMemo(() => applications.filter(a => {
    if (active.status && a.status !== active.status) return false
    if (active.type && a.type !== active.type) return false
    if (search && !`${a.number} ${a.product} ${a.sponsor}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [applications, active, search])

  return (
    <div data-testid="view-applications">
      <PageHeader
        crumbs={[{ label: 'Workspace', onClick: () => setActiveView('home') }, { label: 'Applications' }]}
        title="Applications"
        subtitle={`${filtered.length} of ${applications.length} applications`}
        icon="ti-stack-2"
        actions={
          <>
            <button className="rc-btn" onClick={() => exportCSV(timestampedName('regcheck_applications'),
              filtered.map(a => ({ number: a.number, product: a.product, sponsor: a.sponsor, type: a.type, status: a.status, submissions: a.submissions, registrations: a.registrations, owner: a.owner.name, opened: a.openedAt }))
            )} data-testid="apps-export-btn"><i className="ti ti-download"/> Export</button>
            <button className="rc-btn rc-btn-primary"><i className="ti ti-plus"/> New application</button>
          </>
        }
      />
      <FilterBar
        active={active}
        onChange={setActive}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search number, product, sponsor…"
        filters={[
          { key: 'status', label: 'Status', chips: STATUS_OPTS.map(s => ({ id: s, label: s, count: applications.filter(a => a.status === s).length })) },
          { key: 'type',   label: 'Type',   chips: TYPE_OPTS.map(t => ({ id: t, label: t, count: applications.filter(a => a.type === t).length })) },
        ]}
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
                {filtered.map(a => {
                  const st = STATUS_COLOR[a.status] || { bg: 'var(--rc-surface-tertiary)', color: 'var(--rc-text-secondary)' }
                  return (
                    <tr key={a.id} data-testid={`approw-${a.id}`}>
                      <td><div className="rc-table-link" style={{ fontWeight: 500 }}>{a.number}</div></td>
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
                {filtered.length === 0 && (
                  <tr><td colSpan={9}><div className="rc-empty"><i className="ti ti-search-off"/><div>No applications match the current filters.</div></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
      </div>
    </div>
  )
}
