'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { LifecycleState, DocumentRecord } from '@/lib/mockData'
import { useWorkspace } from '@/lib/workspaceStore'
import PageHeader from '@/components/veeva/PageHeader'
import StatusBadge from '@/components/veeva/StatusBadge'
import { fetchVaultDocuments, uploadVaultDocument } from '@/services/api'
import { exportCSV, timestampedName } from '@/lib/csv'
import type { DocumentListItem } from '@/types/vault'


const STATES: LifecycleState[] = ['draft', 'review', 'approved', 'effective', 'superseded']

export default function DocumentsView() {
  const { selectedSubmissionId, setActiveView, setSelectedDocumentId, openInspector } = useWorkspace()
  const [filter, setFilter] = useState<string>('')
  const [view, setView] = useState<'flat' | 'folder'>('flat')
  const [search, setSearch] = useState('')
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const workspaceId = "india-regulatory-vault"

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetchVaultDocuments(workspaceId)
      setDocuments(response.documents.map(toDocumentRecord))
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    reload()
  }, [reload])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!workspaceId) {
      alert('Select a submission before uploading to the vault.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setUploading(true)
    try {
      await uploadVaultDocument(file, {
        workspace_id: workspaceId,
        title: file.name,
        owner_name: 'Anika Sharma',
        owner_initials: 'AS',
      })
      await reload()
    } catch (err: any) {
      alert(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const filtered = useMemo(() => documents.filter(d => {
    if (filter && d.state !== filter) return false
    if (search && !`${d.name} ${d.number} ${d.classification}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [documents, filter, search])

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
        subtitle={`${filtered.length} of ${documents.length} documents · India Regulatory Vault`}
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
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleUpload}
            />
            <button
              className="rc-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              data-testid="docs-upload-btn"
            >
              <i className={uploading ? "ti ti-loader-2" : "ti ti-upload"} style={uploading ? { animation: 'spin 1s linear infinite', marginRight: 4, display: 'inline-block' } : {}}/>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            <button className="rc-btn rc-btn-primary"><i className="ti ti-plus"/> New document</button>
          </>
        }
      />

      <div style={{ padding: '12px 24px 0', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className={`rc-btn rc-btn-sm ${filter === '' ? 'rc-btn-primary' : ''}`}
          onClick={() => setFilter('')} data-testid="docfilter-all"
        >All <span style={{ opacity: 0.7, marginLeft: 4 }}>{documents.length}</span></button>
        {STATES.map(s => (
          <button key={s}
            className={`rc-btn rc-btn-sm ${filter === s ? 'rc-btn-primary' : ''}`}
            onClick={() => setFilter(s)} data-testid={`docfilter-${s}`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            <span style={{ opacity: 0.7, marginLeft: 4 }}>{documents.filter(d => d.state === s).length}</span>
          </button>
        ))}
        <div style={{ position: 'relative', minWidth: 240, marginLeft: 'auto' }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--rc-text-muted)', fontSize: 13 }}/>
          <input className="rc-input" placeholder="Search documents…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 28 }} data-testid="docs-search"/>
        </div>
      </div>

      <div style={{ padding: 24 }}>
        {loading && (
          <div className="rc-card" style={{ marginBottom: 12 }}>
            <div className="rc-empty"><i className="ti ti-loader-2" style={{ animation: 'spin 1s linear infinite' }}/><div>Loading vault documents...</div></div>
          </div>
        )}
        {error && (
          <div className="rc-card" style={{ marginBottom: 12 }}>
            <div className="rc-empty"><i className="ti ti-alert-circle"/><div>{error}</div></div>
          </div>
        )}
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

function toDocumentRecord(item: DocumentListItem): DocumentRecord {
  return {
    id: item.id,
    number: item.doc_number,
    name: item.title,
    type: toDocumentType(item.doc_type),
    classification: item.classification || 'Regulatory / General',
    state: toWorkspaceState(item.lifecycle_state),
    version: item.current_version,
    owner: {
      id: item.owner_initials || item.owner_name || 'vault-owner',
      name: item.owner_name || 'Unassigned',
      initials: item.owner_initials || 'NA',
      role: 'Regulatory Lead',
    },
    country: 'India',
    language: 'en',
    size: formatFileSize(item.file_size_bytes),
    updatedAt: formatUpdatedAt(item.updated_at),
    updatedBy: item.owner_name || 'System',
    submissionId: item.workspace_id,
    flags: [],
    excerpt: undefined,
  }
}

function toWorkspaceState(state: DocumentListItem['lifecycle_state']): LifecycleState {
  return state === 'in_review' ? 'review' : state
}

function toDocumentType(value: string): DocumentRecord['type'] {
  const allowed: DocumentRecord['type'][] = ['Protocol', 'ICF', 'IB', 'CSR', 'SAE Narrative', 'CTRI', 'CT-04', 'Cover Letter', 'Inspection Report']
  return allowed.includes(value as DocumentRecord['type']) ? value as DocumentRecord['type'] : 'Protocol'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value || 'just now'
  return date.toLocaleString()
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
