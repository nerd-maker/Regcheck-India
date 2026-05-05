'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://regcheck-india.onrender.com'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '', email: '', org: '', role: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.org || !form.role) {
      setError('All fields are required')
      return
    }
    if (!form.email.includes('@')) {
      setError('Enter a valid email address')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/agents/demo/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Registration failed')
      }

      const data = await res.json()

      // Store demo token and user info
      localStorage.setItem('demo_token', data.demo_token)
      localStorage.setItem('demo_name', data.name)
      localStorage.setItem('demo_requests_remaining', String(data.requests_remaining))
      localStorage.setItem('demo_registered', 'true')

      router.push('/app')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-lg">R</span>
          </div>
          <span className="text-xl font-bold text-white">
            RegCheck<span className="text-teal-400">-India</span>
          </span>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-white/10 rounded-2xl p-8">
          <h1 className="text-xl font-bold text-white mb-1">
            Get Free Demo Access
          </h1>
          <p className="text-sm text-gray-400 mb-6">
            5 free requests — no credit card required
          </p>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                Full Name *
              </label>
              <input
                type="text"
                placeholder="Dr. Priya Sharma"
                value={form.name}
                onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                Work Email *
              </label>
              <input
                type="email"
                placeholder="priya@pharmacompany.com"
                value={form.email}
                onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                Organisation *
              </label>
              <input
                type="text"
                placeholder="Sun Pharma / Quintiles India / etc."
                value={form.org}
                onChange={(e) => setForm(p => ({ ...p, org: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                Your Role *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'RA Professional',
                  'CRO',
                  'Pharma Company',
                  'Consultant',
                  'Academic / Research',
                  'Other'
                ].map((role) => (
                  <button
                    key={role}
                    onClick={() => setForm(p => ({ ...p, role }))}
                    className={`px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left ${
                      form.role === role
                        ? 'bg-teal-600 text-white'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full mt-6 bg-teal-600 text-white py-4 rounded-xl font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Setting up access...
              </>
            ) : 'Get Free Access →'}
          </button>

          <p className="text-center text-xs text-gray-600 mt-4">
            By registering you agree to receive occasional product updates.
            <br />No spam. Unsubscribe anytime.
          </p>
        </div>

        {/* Back to landing */}
        <p className="text-center text-sm text-gray-600 mt-4">
          <Link href="/" className="text-teal-400 hover:underline">
            ← Back to homepage
          </Link>
        </p>
      </div>
    </div>
  )
}
