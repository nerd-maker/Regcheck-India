'use client'

import { useState } from 'react'
import { DOCUMENTS, LifecycleState } from '@/lib/mockData'
import { useWorkspace } from '@/lib/workspaceStore'
import PageHeader from '@/components/veeva/PageHeader'
import StatusBadge from '@/components/veeva/StatusBadge'

const STATES: LifecycleState[] = ['draft', 'review', 'approved', 'effective', 'superseded']

export default function DocumentsView() {
  const { setActiveView, setSelectedDocumentId, openInspector } = useWorkspace()
  const [filter, setFilter] = useState<string>('')
  const filtered = DOCUMENTS.filter(d => !filter || d.state === filter)

  return (
    <div data-testid="view-documents">
      <PageHeader
        crumbs={[{ label: 'Workspace', onClick: () => setActiveView('home') }, { label: 'Documents' }]}
        title="Documents"
        subtitle={`${filtered.length} of ${DOCUMENTS.length} documents · India Regulatory Vault`}
        icon="ti-file-text"
        actions={
          <>
            <button className="rc-btn"><i className="ti ti-folder"/> Folder view</button>
            <button className="rc-btn"><i className="ti ti-upload"/> Upload</button>
            <button className="rc-btn rc-btn-primary"><i className="ti ti-plus"/> New document</button>
          </>
        }
      />

      <div style={{ padding: '12px 24px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          className={`rc-btn ${filter === '' ? 'rc-btn-primary' : ''}`}
          onClick={() => setFilter('')} data-testid="docfilter-all"
        >All <span style={{ opacity: 0.7, marginLeft: 4 }}>{DOCUMENTS.length}</span></button>
        {STATES.map(s => (
          <button key={s}
            className={`rc-btn ${filter === s ? 'rc-btn-primary' : ''}`}
            onClick={() => setFilter(s)} data-testid={`docfilter-${s}`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            <span style={{ opacity: 0.7, marginLeft: 4 }}>{DOCUMENTS.filter(d => d.state === s).length}</span>
          </button>
        ))}
      </div>

      <div style={{ padding: 24 }}>
        <div className="rc-card">
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
              {filtered.map(d => (
                <tr key={d.id} onClick={() => { setSelectedDocumentId(d.id); openInspector('details'); }} data-testid={`docrow-${d.id}`}>
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
        </div>
      </div>
    </div>
  )
}
