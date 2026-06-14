'use client'

import { useState, useMemo, useEffect } from 'react'
import { LifecycleState, SubmissionRecord } from '@/lib/mockData'
import { useWorkspace } from '@/lib/workspaceStore'
import PageHeader from '@/components/veeva/PageHeader'
import StatusBadge from '@/components/veeva/StatusBadge'
import { createSubmission } from '@/services/workspaceData'
import { useSubmissions } from '@/hooks/useWorkspaceData'
import NewSubmissionModal from '@/components/NewSubmissionModal'
import { exportCSV, timestampedName } from '@/lib/csv'




const SAVED_VIEWS_KEY = 'rc_saved_views_submissions'

interface SavedView {
  id: string
  name: string
  state: string[]
  type: string[]
  phase: string[]
  search: string
}

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
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())

  const { data: submissions, loading, reload } = useSubmissions()
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)

  const handleCreateSubmission = async (formData: any) => {
    await createSubmission(formData)
    await reload()
  }

  // ── Saved Views ────────────────────────────────────────────────────────
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [showSaved, setShowSaved] = useState(false)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_VIEWS_KEY)
      if (raw) setSavedViews(JSON.parse(raw))
    } catch {}
  }, [])
  const persistSaved = (next: SavedView[]) => {
    setSavedViews(next)
    try { localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next)) } catch {}
  }
  const saveCurrent = () => {
    const name = prompt('Save this filter view as:')
    if (!name?.trim()) return
    const view: SavedView = {
      id: `v_${Date.now()}`,
      name: name.trim(),
      state: Array.from(stateFilter), type: Array.from(typeFilter), phase: Array.from(phaseFilter),
      search,
    }
    persistSaved([...savedViews, view])
  }
  const applyView = (v: SavedView) => {
    setStateFilter(new Set(v.state)); setTypeFilter(new Set(v.type)); setPhaseFilter(new Set(v.phase))
    setSearch(v.search); setShowSaved(false)
  }
  const deleteView = (id: string) => persistSaved(savedViews.filter(v => v.id !== id))

  const filtered = useMemo(() => {
    return submissions.filter(s => {
      if (stateFilter.size && !stateFilter.has(s.state)) return false
      if (typeFilter.size  && !typeFilter.has(s.type))   return false
      if (phaseFilter.size && !phaseFilter.has(s.phase)) return false
      if (search && !`${s.name} ${s.number} ${s.product}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [submissions, stateFilter, typeFilter, phaseFilter, search])

  const toggleSet = (s: Set<string>, val: string, fn: (n: Set<string>) => void) => {
    const ns = new Set(s)
    if (ns.has(val)) ns.delete(val); else ns.add(val)
    fn(ns)
  }

  const countByState = (st: string) => submissions.filter(s => s.state === st).length
  const countByType  = (st: string) => submissions.filter(s => s.type === st).length
  const countByPhase = (st: string) => submissions.filter(s => s.phase === st).length

  const open = (s: SubmissionRecord) => {
    setSelectedSubmissionId(s.id)
    setActiveView('submission-detail')
  }

  return (
    <div data-testid="view-submissions" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        crumbs={[{ label: 'Workspace', onClick: () => setActiveView('home') }, { label: 'Submissions' }]}
        title="Submissions"
        subtitle={`${filtered.length} of ${submissions.length} submissions`}
        icon="ti-folder-open"
        actions={
          <>
            <div style={{ position: 'relative' }}>
              <button className="rc-btn" onClick={() => setShowSaved(s => !s)} data-testid="submissions-saved-btn">
                <i className="ti ti-bookmark"/> Saved Views{savedViews.length > 0 ? ` (${savedViews.length})` : ''}
              </button>
              {showSaved && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: 'var(--rc-surface)', border: '1px solid var(--rc-border)', borderRadius: 'var(--rc-radius-md)', boxShadow: 'var(--rc-shadow-md)', minWidth: 240, zIndex: 30 }}>
                  <button className="rc-nav-item" style={{ borderBottom: '1px solid var(--rc-divider)' }} onClick={saveCurrent}>
                    <i className="ti ti-plus"/> Save current filters…
                  </button>
                  {savedViews.length === 0 ? (
                    <div style={{ padding: '12px 16px', fontSize: 11.5, color: 'var(--rc-text-muted)' }}>No saved views yet.</div>
                  ) : savedViews.map(v => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--rc-divider)' }}>
                       <button className="rc-nav-item" style={{ flex: 1, borderLeft: 'none' }} onClick={() => applyView(v)} data-testid={`apply-view-${v.id}`}>
                        <i className="ti ti-filter"/> {v.name}
                      </button>
                      <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => deleteView(v.id)} style={{ padding: '0 8px' }}>
                        <i className="ti ti-trash"/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className="rc-btn" onClick={() => exportCSV(
              timestampedName('regcheck_submissions'),
              filtered.map(s => ({
                number: s.number, name: s.name, type: s.type, phase: s.phase, authority: s.haAuthority,
                state: s.stateLabel ?? s.state, documents: s.documents, open_gaps: s.openGaps,
                compliance_pct: s.complianceScore, owner: s.owner.name, target_submit: s.targetSubmitDate,
                product: s.product, indication: s.indication, frameworks: s.frameworks.join(';'),
                updated: s.updatedAt,
              })),
            )} data-testid="submissions-export-btn"><i className="ti ti-download"/> Export ({filtered.length})</button>
            <button className="rc-btn rc-btn-primary" onClick={() => setIsNewModalOpen(true)} data-testid="submissions-new-btn"><i className="ti ti-plus"/> New submission</button>
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
          {/* Thin progress bar while refreshing — UI stays unblocked */}
          <div style={{ position: 'relative' }}>
            {loading && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                height: 2,
                background: 'var(--rc-primary)',
                animation: 'pulse 1.5s ease-in-out infinite',
                zIndex: 10,
                borderRadius: 1,
              }}/>
            )}
            <table className="rc-table" data-testid="submissions-table">
              <thead>
                <tr>
                  <th style={{ width: 26 }}>
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={filtered.length > 0 && selectedRowIds.size === filtered.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRowIds(new Set(filtered.map(s => s.id)))
                        } else {
                          setSelectedRowIds(new Set())
                        }
                      }}
                    />
                  </th>
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
                      setActiveView('submission-detail')
                    }}
                    data-testid={`subrow-${s.id}`}
                  >
                    <td onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedRowIds.has(s.id)}
                        onChange={(e) => {
                          const ns = new Set(selectedRowIds)
                          if (e.target.checked) {
                            ns.add(s.id)
                          } else {
                            ns.delete(s.id)
                          }
                          setSelectedRowIds(ns)
                        }}
                      />
                    </td>
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
      <NewSubmissionModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onCreate={handleCreateSubmission}
      />
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
