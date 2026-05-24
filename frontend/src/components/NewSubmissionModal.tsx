'use client'

import { useState } from 'react'
import { useWorkspace } from '@/lib/workspaceStore'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function NewSubmissionModal({ isOpen, onClose }: Props) {
  const { addSubmission } = useWorkspace()
  const [product, setProduct] = useState('')
  const [type, setType] = useState('IND')
  const [phase, setPhase] = useState('Phase II')
  const [indication, setIndication] = useState('')
  const [sponsor, setSponsor] = useState('')
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!product.trim() || !indication.trim() || !sponsor.trim()) {
      setError('All fields are required.')
      return
    }
    setError('')
    addSubmission({
      product,
      type,
      phase,
      indication,
      sponsor,
    })
    onClose()
    // Reset state
    setProduct('')
    setIndication('')
    setSponsor('')
  }

  return (
    <div
      className="fixed inset-0 z-[999] flex items-start justify-center px-4 pt-16"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      aria-modal="true"
      role="dialog"
      aria-label="New Submission"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-8" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors text-xl leading-none"
        >
          ✕
        </button>

        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Create New Submission</h2>
          <p className="text-sm text-gray-500 mt-1">
            Create a new regulatory submission record. It will initialize in Draft state.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="sub-product">
              Drug / Product Name *
            </label>
            <input
              id="sub-product"
              type="text"
              placeholder="e.g. ZP-101"
              value={product}
              onChange={e => setProduct(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="sub-type">
              Submission Type *
            </label>
            <select
              id="sub-type"
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="IND">IND (Investigational New Drug)</option>
              <option value="NDA">NDA (New Drug Application)</option>
              <option value="CT-04">CT-04 (Clinical Trial Application)</option>
              <option value="Schedule M">Schedule M (GMP Compliance)</option>
              <option value="Pre-IND Meeting">Pre-IND Meeting Briefing</option>
              <option value="Annual Update">Annual Update</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="sub-phase">
              Development Phase *
            </label>
            <select
              id="sub-phase"
              value={phase}
              onChange={e => setPhase(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="Pre-IND">Pre-IND</option>
              <option value="Phase I">Phase I</option>
              <option value="Phase II">Phase II</option>
              <option value="Phase III">Phase III</option>
              <option value="Post-Marketing">Post-Marketing</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="sub-indication">
              Indication *
            </label>
            <input
              id="sub-indication"
              type="text"
              placeholder="e.g. Type 2 Diabetes Mellitus"
              value={indication}
              onChange={e => setIndication(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="sub-sponsor">
              Sponsor Name *
            </label>
            <input
              id="sub-sponsor"
              type="text"
              placeholder="e.g. Zephyr Pharma Pvt Ltd"
              value={sponsor}
              onChange={e => setSponsor(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg py-2.5 font-semibold text-sm transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
