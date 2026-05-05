'use client'

import { useState } from 'react'

interface FeedbackWidgetProps {
  moduleName: string
  resultHash: string  // hash of result for tracking without storing sensitive data
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://regcheck-india.onrender.com'

export default function FeedbackWidget({ moduleName, resultHash }: FeedbackWidgetProps) {
  const [submitted, setSubmitted] = useState(false)
  const [selected, setSelected] = useState<'positive' | 'negative' | null>(null)
  const [comment, setComment] = useState('')
  const [showComment, setShowComment] = useState(false)

  const submitFeedback = async (type: 'positive' | 'negative') => {
    setSelected(type)
    if (type === 'negative') {
      setShowComment(true)
      return
    }
    await sendFeedback(type, '')
  }

  const sendFeedback = async (type: string, commentText: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/v1/agents/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: moduleName,
          type,
          comment: commentText,
          result_hash: resultHash,
          timestamp: new Date().toISOString()
        })
      })
    } catch {
      // Fail silently — feedback is non-critical
    }
    setSubmitted(true)
    setShowComment(false)
  }

  if (submitted) {
    return (
      <div className="flex items-center gap-2 pt-3 mt-3 border-t border-white/10">
        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-xs text-green-400">Thanks for the feedback!</span>
      </div>
    )
  }

  return (
    <div className="pt-3 mt-3 border-t border-white/10">
      {!showComment ? (
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Was this output accurate?</span>
          <button
            onClick={() => submitFeedback('positive')}
            className="p-1.5 rounded-lg hover:bg-green-500/20 text-slate-400 hover:text-green-400 transition-colors"
            title="Yes, accurate"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
          </button>
          <button
            onClick={() => submitFeedback('negative')}
            className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
            title="No, inaccurate"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">What was wrong? (optional)</p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Missing regulation reference, wrong classification, etc."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-red-500 resize-none h-16"
          />
          <div className="flex gap-2">
            <button
              onClick={() => sendFeedback('negative', comment)}
              className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/30 transition-colors"
            >
              Submit Feedback
            </button>
            <button
              onClick={() => { setShowComment(false); setSelected(null) }}
              className="px-3 py-1.5 bg-white/5 text-slate-400 rounded-lg text-xs hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
