'use client'

import { useState, useMemo } from 'react'
import { SUBMISSIONS, LifecycleState, SubmissionRecord } from '@/lib/mockData'
import { useWorkspace } from '@/lib/workspaceStore'
import StatusBadge from '@/components/veeva/StatusBadge'
import PageHeader from '@/components/veeva/PageHeader'

const STATE_FACETS: { id: LifecycleState; label: string }[] = [
  { id: 'draft',     label: 'Draft' },
  { id: 'review',    label: 'In Review' },
  { id: 'approved',  label: 'Approved' },
  { id: 'effective', label: 'Submitted' },
  { id: 'rejected',  label: 'Deficiency' },
]

const TYPE_FACETS = ['IND', 'NDA', 'CT-04', 'Schedule M', 'Pre-IND Meeting', 'Annual Update']
const PHASE_FACETS = ['Pre-IND', 'Phase I', 'Phase II', 'Phase III', 'Post-Marketing']

export default function SubmissionsView() {
  const { setActiveView, setSelectedSubmissionId, openInspector } = useWorkspace()
  const [stateFilter, setStateFilter] = useState<Set<string>>(new Set())
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set())
  const [phaseFilter, setPhaseFilter] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<{ k: keyof SubmissionRecord; dir: 'asc' | 'desc' }>({ k: 'updatedAt', dir: 'asc' })

  const filtered = useMemo(() => {
    return SUBMISSIONS.filter(s => {
      if (stateFilter.size && !stateFilter.has(s.state)) return false
      if (typeFilter.size  && !typeFilter.has(s.type))   return false
      if (phaseFilter.size && !phaseFilter.has(s.phase)) return false
      if (search && !`${s.name} ${s.number} ${s.product}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [stateFilter, typeFilter, phaseFilter, search])

  const toggleSet = (s: Set<string>, val: string, fn: (n: Set<string>) => void) => {
    const ns = new Set(s)
    if (ns.has(val)) ns.delete(val); else ns.add(val)
    fn(ns)
  }

  const countByState = (st: string) => SUBMISSIONS.filter(s => s.state === st).length
  const countByType  = (st: string) => SUBMISSIONS.filter(s => s.type === st).length
  const countByPhase = (st: string) => SUBMISSIONS.filter(s => s.phase === st).length

  const open = (s: SubmissionRecord) => {
    setSelectedSubmissionId(s.id)
    setActiveView('submission-detail')
  }

  return (
    <div data-testid="view-submissions" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        crumbs={[{ label: 'Workspace', onClick: () => setActiveView('home') }, { label: 'Submissions' }]}
        title="Submissions"
        subtitle={`${filtered.length} of ${SUBMISSIONS.length} submissions`}
        icon="ti-folder-open"
        actions={
          <>
            <button className="rc-btn"><i className="ti ti-filter"/> Saved Views</button>
            <button className="rc-btn"><i className="ti ti-download"/> Export</button>
            <button className="rc-btn rc-btn-primary" data-testid="submissions-new-btn"><i className="ti ti-plus"/> New submission</button>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '232px 1fr', flex: 1, overflow: 'hidden' }}>
        {/* Facets */}
        <div className="rc-facets rc-scroll" data-testid="facets">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--rc-text-primary)' }}>Filter</span>
            {(stateFilter.size + typeFilter.size + phaseFilter.size) > 0 && (
              <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => { setStateFilter(new Set()); setTypeFilter(new Set()); setPhaseFilter(new Set()); }}>Clear all</button>
            )}
          </div>

          <div style={{ position: 'relative', marginBottom: 16 }}>
            <i className="ti ti-search" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--rc-text-muted)', fontSize: 13 }}/>
            <input
              className="rc-input"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 28 }}
              data-testid="facets-search"
            />
          </div>

          <FacetGroup title="State">
            {STATE_FACETS.map(f => (
              <label key={f.id} className="rc-facet-opt" data-testid={`facet-state-${f.id}`}>
                <input type="checkbox" checked={stateFilter.has(f.id)} onChange={() => toggleSet(stateFilter, f.id, setStateFilter)}/>
                <span>{f.label}</span>
                <span className="rc-facet-count">{countByState(f.id)}</span>
              </label>
            ))}
          </FacetGroup>

          <FacetGroup title="Type">
            {TYPE_FACETS.map(f => (
              <label key={f} className="rc-facet-opt">
                <input type="checkbox" checked={typeFilter.has(f)} onChange={() => toggleSet(typeFilter, f, setTypeFilter)}/>
                <span>{f}</span>
                <span className="rc-facet-count">{countByType(f)}</span>
              </label>
            ))}
          </FacetGroup>

          <FacetGroup title="Phase">
            {PHASE_FACETS.map(f => (
              <label key={f} className="rc-facet-opt">
                <input type="checkbox" checked={phaseFilter.has(f)} onChange={() => toggleSet(phaseFilter, f, setPhaseFilter)}/>
                <span>{f}</span>
                <span className="rc-facet-count">{countByPhase(f)}</span>
              </label>
            ))}
          </FacetGroup>
        </div>

        {/* Table */}
        <div className="rc-scroll" style={{ overflow: 'auto', background: 'var(--rc-surface)' }}>
          <table className="rc-table" data-testid="submissions-table">
            <thead>
              <tr>
                <th style={{ width: 26 }}><input type="checkbox" aria-label="Select all"/></th>
                <th>Submission</th>
                <th>Type</th>
                <th>Phase</th>
                <th>Authority</th>
                <th>State</th>
                <th style={{ textAlign: 'right' }}>Docs</th>
                <th style={{ textAlign: 'right' }}>Gaps</th>
                <th style={{ width: 130 }}>Compliance</th>
                <th>Owner</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}
                  className={selected === s.id ? 'is-selected' : ''}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelected(s.id)
                    setSelectedSubmissionId(s.id)
                    openInspector('details')
                  }}
                  onDoubleClick={() => open(s)}
                  data-testid={`subrow-${s.id}`}
                >
                  <td onClick={e => e.stopPropagation()}><input type="checkbox"/></td>
                  <td>
                    <button className="rc-table-link" onClick={(e) => { e.stopPropagation(); open(s); }} style={{ background: 'none', border: 0, padding: 0, fontFamily: 'inherit', fontSize: 'inherit', cursor: 'pointer' }}>
                      {s.name}
                    </button>
                    <div style={{ fontSize: 11, color: 'var(--rc-text-muted)', fontFamily: 'var(--rc-font-mono)' }}>{s.number}</div>
                  </td>
                  <td><span style={{ fontSize: 11.5, color: 'var(--rc-text-secondary)' }}>{s.type}</span></td>
                  <td><span style={{ fontSize: 11.5 }}>{s.phase}</span></td>
                  <td><span style={{ fontSize: 11.5 }}>{s.haAuthority}</span></td>
                  <td><StatusBadge state={s.state} label={s.stateLabel} size="sm"/></td>
                  <td style={{ textAlign: 'right' }}>{s.documents}</td>
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
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="rc-avatar" style={{ width: 22, height: 22, fontSize: 9.5, background: 'linear-gradient(135deg,#93C5FD,#1A56DB)' }}>{s.owner.initials}</div>
                      <span style={{ fontSize: 11.5 }}>{s.owner.name.split(' ')[0]}</span>
                    </div>
                  </td>
                  <td><span style={{ fontSize: 11.5, color: 'var(--rc-text-secondary)' }}>{s.targetSubmitDate}</span></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={11}><div className="rc-empty"><i className="ti ti-search-off"/><div>No submissions match the current filters.</div></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function FacetGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rc-facet-group">
      <div className="rc-facet-title">{title}</div>
      {children}
    </div>
  )
}
