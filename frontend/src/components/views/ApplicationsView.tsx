'use client'

import { useState, useMemo } from 'react'
import { useWorkspace } from '@/lib/workspaceStore'
import PageHeader from '@/components/veeva/PageHeader'
import FilterBar from '@/components/veeva/FilterBar'
import { exportCSV, timestampedName } from '@/lib/csv'
import { useApplications, useSubmissions } from '@/hooks/useWorkspaceData'
import { createApplication } from '@/services/api'
import type { ApplicationRecord } from '@/lib/mockData'

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  'Active':         { bg: 'var(--rc-effective-bg)', color: 'var(--rc-effective)' },
  'Pending CDSCO':  { bg: 'var(--rc-review-bg)',    color: 'var(--rc-review)' },
  'Approved':       { bg: 'var(--rc-approved-bg)',  color: 'var(--rc-approved)' },
  'On Hold':        { bg: 'var(--rc-rejected-bg)',  color: 'var(--rc-rejected)' },
}

export default function ApplicationsView() {
  const { setActiveView, setSelectedSubmissionId, openInspector } = useWorkspace()
  const [active, setActive] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data: applications, loading, reload } = useApplications()
  const { data: submissions } = useSubmissions()

  const STATUS_OPTS = ['Active', 'Pending CDSCO', 'Approved', 'On Hold']
  const TYPE_OPTS = ['Clinical Trial', 'New Drug', 'Subsequent New Drug']

  const handleCreate = async (payload: any) => {
    await createApplication(payload)
    await reload()
  }

  const handleRowClick = (app: ApplicationRecord) => {
    const linkedSub = submissions.find(s => s.applicationId === app.id || s.product === app.product)
    if (linkedSub) {
      setSelectedSubmissionId(linkedSub.id)
      openInspector('details')
    } else {
      openInspector('details')
    }
  }

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
            <button className="rc-btn rc-btn-primary" onClick={() => setShowCreateModal(true)} data-testid="apps-new-btn"><i className="ti ti-plus"/> New application</button>
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
          {loading && (
            <div className="rc-card" style={{ marginBottom: 12 }}>
              <div className="rc-empty"><i className="ti ti-loader-2 animate-spin"/><div>Loading applications...</div></div>
            </div>
          )}
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
                    <tr key={a.id} data-testid={`approw-${a.id}`} onClick={() => handleRowClick(a)} style={{ cursor: 'pointer' }}>
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
      <NewApplicationModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onCreate={handleCreate} />
    </div>
  )
}

function NewApplicationModal({ isOpen, onClose, onCreate }: {
  isOpen: boolean
  onClose: () => void
  onCreate: (payload: { product: string; sponsor: string; type: string; owner_name: string; owner_initials: string }) => Promise<void>
}) {
  const [product, setProduct] = useState('')
  const [sponsor, setSponsor] = useState('')
  const [type, setType] = useState('NDA')
  const [ownerName, setOwnerName] = useState('')
  const [ownerInitials, setOwnerInitials] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product.trim() || !sponsor.trim() || !ownerName.trim() || !ownerInitials.trim()) {
      setError('All fields are required.')
      return
    }
    if (ownerInitials.length > 5) {
      setError('Owner Initials must be 5 characters or less.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await onCreate({
        product: product.trim(),
        sponsor: sponsor.trim(),
        type,
        owner_name: ownerName.trim(),
        owner_initials: ownerInitials.trim().toUpperCase(),
      })
      onClose()
      setProduct('')
      setSponsor('')
      setOwnerName('')
      setOwnerInitials('')
    } catch (err: any) {
      setError(err.message || 'Failed to create application.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[999] flex items-start justify-center px-4 pt-16 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-8 my-8" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Create New Application</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 text-gray-800">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
            <input className="rc-input w-full text-black" value={product} onChange={e => setProduct(e.target.value)} required placeholder="e.g. Zalpifylline 400mg Tablets" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sponsor *</label>
            <input className="rc-input w-full text-black" value={sponsor} onChange={e => setSponsor(e.target.value)} required placeholder="e.g. ZP Pharma Pvt Ltd" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Application Type *</label>
            <select className="rc-input w-full text-black" value={type} onChange={e => setType(e.target.value)}>
              <option value="NDA">NDA</option>
              <option value="IND">IND</option>
              <option value="ANDA">ANDA</option>
              <option value="NDA-505b2">NDA-505b2</option>
              <option value="CT-04">CT-04</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name *</label>
            <input className="rc-input w-full text-black" value={ownerName} onChange={e => setOwnerName(e.target.value)} required placeholder="e.g. Anika Sharma" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Owner Initials * (max 5)</label>
            <input className="rc-input w-full text-black" value={ownerInitials} onChange={e => setOwnerInitials(e.target.value)} required placeholder="e.g. AS" maxLength={5} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="rc-btn">Cancel</button>
            <button type="submit" disabled={submitting} className="rc-btn rc-btn-primary">
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
