'use client'

import { useState, useEffect } from 'react'
import { getHistory, clearHistory, deleteHistoryEntry, HistoryEntry } from '@/services/history'

interface HistoryPanelProps {
  onRestore: (entry: HistoryEntry) => void
  currentModuleId: string
}

export default function HistoryPanel({ onRestore, currentModuleId }: HistoryPanelProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)

  useEffect(() => {
    // Count history items for this module on mount
    const h = getHistory().filter(e => e.moduleId === currentModuleId)
    setCount(h.length)
  }, [currentModuleId])

  useEffect(() => {
    if (open) {
      const h = getHistory().filter(e => e.moduleId === currentModuleId)
      setHistory(h)
      setCount(h.length)
    }
  }, [open, currentModuleId])

  if (count === 0 && !open) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-400 transition-colors px-2 py-1 rounded-lg hover:bg-teal-400/10"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        History ({count})
      </button>

      {open && (
        <div className="absolute top-8 right-0 w-80 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl z-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-300">Recent Results</span>
            <button
              onClick={() => { clearHistory(); setHistory([]); setCount(0) }}
              className="text-xs text-red-400 hover:underline"
            >
              Clear all
            </button>
          </div>

          {history.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">No history yet</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {history.map((entry) => (
                <div key={entry.id} className="bg-white/5 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-teal-400 font-medium">{entry.module}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        {new Date(entry.timestamp).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => {
                          deleteHistoryEntry(entry.id)
                          const updated = history.filter(e => e.id !== entry.id)
                          setHistory(updated)
                          setCount(updated.length)
                        }}
                        className="text-xs text-red-400/60 hover:text-red-400"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mb-2 line-clamp-2">
                    {entry.inputSnippet}
                  </p>
                  <button
                    onClick={() => { onRestore(entry); setOpen(false) }}
                    className="text-xs text-teal-400 hover:underline"
                  >
                    Restore result →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
