'use client'

import { useState, useMemo } from 'react'
import { DOCUMENTS, LifecycleState, DocumentRecord } from '@/lib/mockData'
import { useWorkspace } from '@/lib/workspaceStore'
import PageHeader from '@/components/veeva/PageHeader'
import StatusBadge from '@/components/veeva/StatusBadge'
import { exportCSV, timestampedName } from '@/lib/csv'

const STATES: LifecycleState[] = ['draft', 'review', 'approved', 'effective', 'superseded']

export default function DocumentsView() {
  const { setActiveView, setSelectedDocumentId, openInspector } = useWorkspace()
  const [filter, setFilter] = useState<string>('')
  const [view, setView] = useState<'flat' | 'folder'>('flat')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => DOCUMENTS.filter(d => {
    if (filter && d.state !== filter) return false
    if (search && !`${d.name} ${d.number} ${d.classification}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [filter, search])

  // Group by classification root (everything before the first " / ")
  const grouped = useMemo(() => {
    const map: Record<string, DocumentRecord[]> = {}
    filtered.forEach(d => {
      const root = d.classification.split('/')[0].trim()
      if (!map[root]) map[root] = []
      map[root].push(d)
    })
    return map
  }, [filtered])

  return (
    <div data-testid="view-documents">
      <PageHeader
        crumbs={[{ label: 'Workspace', onClick: () => setActiveView('home') }, { label: 'Documents' }]}
        title="Documents"
        subtitle={`${filtered.length} of ${DOCUMENTS.length} documents · India Regulatory Vault`}
        icon="ti-file-text"
        actions={
          <>
            <div style={{ display: 'flex', border: '1px solid var(--rc-border-strong)', borderRadius: 'var(--rc-radius)', overflow: 'hidden' }}>
              <button
                className={`rc-btn ${view === 'flat' ? 'rc-btn-primary' : ''}`}
                style={{ borderRadius: 0, border: 'none' }}
                onClick={() => setView('flat')}
                data-testid="docview-flat"
              ><i className="ti ti-list"/> List</button>
              <button
                className={`rc-btn ${view === 'folder' ? 'rc-btn-primary' : ''}`}
                style={{ borderRadius: 0, border: 'none', borderLeft: '1px solid var(--rc-border-strong)' }}
                onClick={() => setView('folder')}
                data-testid="docview-folder"
              ><i className="ti ti-folder"/> Folders</button>
            </div>
            <button className="rc-btn" onClick={() => exportCSV(timestampedName('regcheck_documents'),
              filtered.map(d => ({ number: d.number, name: d.name, type: d.type, classification: d.classification, version: d.version, state: d.state, owner: d.owner.name, size: d.size, updated: d.updatedAt, compliance: d.complianceScore ?? '', submission: d.submissionId ?? '' }))
            )} data-testid="docs-export-btn"><i className="ti ti-download"/> Export</button>
            <button className="rc-btn"><i className="ti ti-upload"/> Upload</button>
            <button className="rc-btn rc-btn-primary"><i className="ti ti-plus"/> New document</button>
          </>
        }
      />

      <div style={{ padding: '12px 24px 0', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className={`rc-btn rc-btn-sm ${filter === '' ? 'rc-btn-primary' : ''}`}
          onClick={() => setFilter('')} data-testid="docfilter-all"
        >All <span style={{ opacity: 0.7, marginLeft: 4 }}>{DOCUMENTS.length}</span></button>
        {STATES.map(s => (
          <button key={s}
            className={`rc-btn rc-btn-sm ${filter === s ? 'rc-btn-primary' : ''}`}
            onClick={() => setFilter(s)} data-testid={`docfilter-${s}`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            <span style={{ opacity: 0.7, marginLeft: 4 }}>{DOCUMENTS.filter(d => d.state === s).length}</span>
          </button>
        ))}
        <div style={{ position: 'relative', minWidth: 240, marginLeft: 'auto' }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--rc-text-muted)', fontSize: 13 }}/>
          <input className="rc-input" placeholder="Search documents…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 28 }} data-testid="docs-search"/>
        </div>
      </div>

      <div style={{ padding: 24 }}>
        {view === 'flat' ? (
          <div className="rc-card">
            <DocTable docs={filtered} onSelect={(d) => { setSelectedDocumentId(d.id); openInspector('details') }}/>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Object.entries(grouped).map(([group, docs]) => (
              <div key={group} className="rc-card" data-testid={`folder-${group}`}>
                <div className="rc-card-header">
                  <span><i className="ti ti-folder-open" style={{ marginRight: 6, color: 'var(--rc-primary)' }}/>{group}</span>
                  <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--rc-text-muted)' }}>{docs.length} document{docs.length !== 1 ? 's' : ''}</span>
                </div>
                <DocTable docs={docs} onSelect={(d) => { setSelectedDocumentId(d.id); openInspector('details') }}/>
              </div>
            ))}
            {Object.keys(grouped).length === 0 && (
              <div className="rc-card"><div className="rc-empty"><i className="ti ti-folder-off"/><div>No documents match the filters.</div></div></div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function DocTable({ docs, onSelect }: { docs: DocumentRecord[]; onSelect: (d: DocumentRecord) => void }) {
  return (
    <table className="rc-table">
      <thead>
        <tr>
          <th>Document</th>
          <th>Type</th>
          <th>Classification</th>
          <th>Version</th>
          <th>State</th>
          <th>Owner</th>
          <th>Updated</th>
        </tr>
      </thead>
      <tbody>
        {docs.map(d => (
          <tr key={d.id} onClick={() => onSelect(d)} data-testid={`docrow-${d.id}`}>
            <td>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="ti ti-file-text" style={{ fontSize: 14, color: 'var(--rc-primary)' }}/>
                <div>
                  <div className="rc-table-link" style={{ fontWeight: 500 }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--rc-text-muted)', fontFamily: 'var(--rc-font-mono)' }}>{d.number}</div>
                </div>
              </div>
            </td>
            <td>{d.type}</td>
            <td><span style={{ fontSize: 12, color: 'var(--rc-text-secondary)' }}>{d.classification}</span></td>
            <td>{d.version}</td>
            <td><StatusBadge state={d.state} size="sm"/></td>
            <td>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div className="rc-avatar" style={{ width: 22, height: 22, fontSize: 9.5, background: 'linear-gradient(135deg,#93C5FD,#1A56DB)' }}>{d.owner.initials}</div>
                <span style={{ fontSize: 12 }}>{d.owner.name.split(' ')[0]}</span>
              </div>
            </td>
            <td><span style={{ fontSize: 12, color: 'var(--rc-text-secondary)' }}>{d.updatedAt}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
