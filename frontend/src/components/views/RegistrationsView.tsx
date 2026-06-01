'use client'

import { useState, useMemo } from 'react'
import { REGISTRATIONS } from '@/lib/mockData'
import { useWorkspace } from '@/lib/workspaceStore'
import PageHeader from '@/components/veeva/PageHeader'
import FilterBar from '@/components/veeva/FilterBar'
import { exportCSV, timestampedName } from '@/lib/csv'

const STATE_COLOR: Record<string, { bg: string; color: string }> = {
  'Effective':       { bg: 'var(--rc-approved-bg)',   color: 'var(--rc-approved)' },
  'Expiring Soon':   { bg: 'var(--rc-review-bg)',     color: 'var(--rc-review)' },
  'Expired':         { bg: 'var(--rc-rejected-bg)',   color: 'var(--rc-rejected)' },
  'Withdrawn':       { bg: 'var(--rc-superseded-bg)', color: 'var(--rc-superseded)' },
}

export default function RegistrationsView() {
  const { setActiveView } = useWorkspace()
  const [active, setActive] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')

  const STATE_OPTS = ['Effective', 'Expiring Soon', 'Expired', 'Withdrawn']

  const filtered = useMemo(() => REGISTRATIONS.filter(r => {
    if (active.state && r.state !== active.state) return false
    if (search && !`${r.number} ${r.product} ${r.certificate}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [active, search])

  return (
    <div data-testid="view-registrations">
      <PageHeader
        crumbs={[{ label: 'Workspace', onClick: () => setActiveView('home') }, { label: 'Registrations' }]}
        title="Registrations"
        subtitle={`${filtered.length} of ${REGISTRATIONS.length} active product registrations · India`}
        icon="ti-certificate"
        actions={
          <>
            <button className="rc-btn" onClick={() => exportCSV(timestampedName('regcheck_registrations'),
              filtered.map(r => ({ number: r.number, product: r.product, certificate: r.certificate, market: r.market, state: r.state, approved: r.approvedDate, expires: r.expiryDate }))
            )} data-testid="regs-export-btn"><i className="ti ti-download"/> Export</button>
            <button className="rc-btn rc-btn-primary"><i className="ti ti-plus"/> New registration</button>
          </>
        }
      />
      <FilterBar
        active={active}
        onChange={setActive}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search number, product, certificate…"
        filters={[
          { key: 'state', label: 'State', chips: STATE_OPTS.map(s => ({ id: s, label: s, count: REGISTRATIONS.filter(r => r.state === s).length })) },
        ]}
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
              {filtered.map(r => {
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
              {filtered.length === 0 && (
                <tr><td colSpan={7}><div className="rc-empty"><i className="ti ti-search-off"/><div>No registrations match the filters.</div></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
