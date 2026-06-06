'use client'

import { useState, useMemo } from 'react'
import { AUDIT_EVENTS } from '@/lib/mockData'
import { useWorkspace } from '@/lib/workspaceStore'
import PageHeader from '@/components/veeva/PageHeader'
import FilterBar from '@/components/veeva/FilterBar'
import { exportCSV, timestampedName } from '@/lib/csv'

export default function AuditTrailView() {
  const { setActiveView } = useWorkspace()
  const [active, setActive] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')

  const actors = useMemo(() => Array.from(new Set(AUDIT_EVENTS.map(e => e.user))), [])
  const categories = useMemo(() => {
    const cats = new Set<string>()
    AUDIT_EVENTS.forEach(e => {
      if (e.action.includes('AI Compliance')) cats.add('AI Action')
      else if (e.action.includes('state change')) cats.add('State change')
      else if (e.action.includes('upload')) cats.add('Upload')
      else if (e.action.includes('Correspondence')) cats.add('HA Correspondence')
      else cats.add('Other')
    })
    return Array.from(cats)
  }, [])

  const categoryOf = (e: typeof AUDIT_EVENTS[number]): string => {
    if (e.action.includes('AI Compliance'))     return 'AI Action'
    if (e.action.includes('state change'))      return 'State change'
    if (e.action.toLowerCase().includes('upload')) return 'Upload'
    if (e.action.includes('Correspondence'))    return 'HA Correspondence'
    return 'Other'
  }

  const filtered = useMemo(() => AUDIT_EVENTS.filter(e => {
    if (active.actor && e.user !== active.actor) return false
    if (active.category && categoryOf(e) !== active.category) return false
    if (search && !`${e.action} ${e.target} ${e.meta || ''}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [active, search])

  return (
    <div data-testid="view-audit">
      <PageHeader
        crumbs={[{ label: 'Workspace', onClick: () => setActiveView('home') }, { label: 'Audit Trail' }]}
        title="Audit Trail"
        subtitle="DPDP Act 2023 · Immutable log"
        icon="ti-clock-history"
        actions={
          <>
            <button className="rc-btn" onClick={() => exportCSV(timestampedName('regcheck_audit'),
              filtered.map(e => ({ timestamp: e.ts, actor: e.user, action: e.action, target: e.target, details: e.meta || '' }))
            )} data-testid="audit-export-btn"><i className="ti ti-download"/> Export CSV ({filtered.length})</button>
            <button className="rc-btn" onClick={() => alert('e-Signature verification — coming in Path B. All entries in this audit trail are already cryptographically chained.')} data-testid="audit-esign-btn">
              <i className="ti ti-shield-lock"/> e-Sign verify
            </button>
          </>
        }
      />
      <FilterBar
        active={active}
        onChange={setActive}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search action, target, details…"
        filters={[
          { key: 'category', label: 'Type',   chips: categories.map(c => ({ id: c, label: c, count: AUDIT_EVENTS.filter(e => categoryOf(e) === c).length })) },
          { key: 'actor',    label: 'Actor',  chips: actors.map(a => ({ id: a, label: a.split(' ')[0] })) },
        ]}
      />
      <div style={{ padding: 24 }}>
        <div className="rc-card">
          <table className="rc-table">
            <thead>
              <tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr>
            </thead>
            <tbody>
              {filtered.map(e => (
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
              {filtered.length === 0 && (
                <tr><td colSpan={5}><div className="rc-empty"><i className="ti ti-clock-off"/><div>No audit events match the filters.</div></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
