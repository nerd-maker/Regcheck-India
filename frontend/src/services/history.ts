// src/services/history.ts
// Upgraded: saves to Render PostgreSQL (primary) + localStorage (fallback).
// Reads from backend first, falls back to localStorage if unreachable.

import axios from 'axios'
import { getStoredKey } from './api'

export interface HistoryEntry {
  id: string
  module: string        // display name e.g. "Schedule Y Check"
  moduleId: string      // agent_id e.g. "m7-scheduley"
  timestamp: string
  inputSnippet: string
  result: unknown
  filename?: string
  complianceScore?: number
  gapCountCritical?: number
  gapCountMajor?: number
  gapCountMinor?: number
  submissionId?: string
  status?: string
}

const PROXY = '/api/regcheck/agent-runs'
const LS_KEY = 'regcheck_history'
const MAX_LS = 20

// ── Score extraction helper ────────────────────────────────────────
// Tries to extract a 0-100 compliance score from free-text agent output
export function extractComplianceScore(result: unknown): number | null {
  if (!result) return null
  const text = typeof result === 'string'
    ? result
    : JSON.stringify(result)

  // Patterns: "81%", "Overall: 74%", "compliance: 68%", "score: 72/100"
  const patterns = [
    /overall[:\s]+(\d{1,3})%/i,
    /compliance[:\s]+(\d{1,3})%/i,
    /score[:\s]+(\d{1,3})[%\/]/i,
    /(\d{1,3})%\s+compliant/i,
    /(\d{1,3})\/100/i,
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) {
      const score = parseInt(m[1])
      if (score >= 0 && score <= 100) return score
    }
  }
  return null
}

// ── Gap count extractor ────────────────────────────────────────────
export function extractGapCounts(result: unknown): {
  critical: number, major: number, minor: number
} {
  const text = typeof result === 'string'
    ? result
    : JSON.stringify(result)

  const extract = (label: string) => {
    const m = text.match(new RegExp(`${label}[:\\s(]+([0-9]+)`, 'i'))
    return m ? parseInt(m[1]) : 0
  }
  return {
    critical: extract('critical'),
    major: extract('major'),
    minor: extract('minor'),
  }
}

// ── Save ──────────────────────────────────────────────────────────
export const saveToHistory = async (
  module: string,
  moduleId: string,
  input: string,
  result: unknown,
  options?: {
    filename?: string
    submissionId?: string
    documentId?: string
  }
): Promise<void> => {
  const inputSnippet = input.substring(0, 200) +
    (input.length > 200 ? '...' : '')
  const complianceScore = extractComplianceScore(result) ?? undefined
  const gaps = extractGapCounts(result)
  const resultSummary = (typeof result === 'string'
    ? result
    : JSON.stringify(result)
  ).substring(0, 500)

  const entry: HistoryEntry = {
    id: Date.now().toString(),
    module,
    moduleId,
    timestamp: new Date().toISOString(),
    inputSnippet,
    result,
    filename: options?.filename,
    complianceScore,
    gapCountCritical: gaps.critical,
    gapCountMajor: gaps.major,
    gapCountMinor: gaps.minor,
    submissionId: options?.submissionId,
    status: 'completed',
  }

  // 1. Save to localStorage immediately (instant, no latency)
  try {
    const existing = JSON.parse(
      localStorage.getItem(LS_KEY) || '[]'
    ) as HistoryEntry[]
    const updated = [entry, ...existing].slice(0, MAX_LS)
    localStorage.setItem(LS_KEY, JSON.stringify(updated))
  } catch { /* localStorage full */ }

  // 2. Also save to backend (async, fire and forget — don't block UI)
  axios.post(PROXY, {
    submission_id: options?.submissionId || null,
    document_id: options?.documentId || null,
    agent_id: moduleId,
    agent_name: module,
    filename: options?.filename || null,
    input_snippet: inputSnippet,
    result_summary: resultSummary,
    compliance_score: complianceScore || null,
    gap_count_critical: gaps.critical || null,
    gap_count_major: gaps.major || null,
    gap_count_minor: gaps.minor || null,
    status: 'completed',
  }, {
    headers: { 'x-anthropic-api-key': getStoredKey() },
    timeout: 10000,
  }).catch(() => {
    // Backend save failed silently — localStorage still has it
  })
}

// ── Read from localStorage (sync, immediate) ──────────────────────
export const getHistory = (): HistoryEntry[] => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]')
  } catch {
    return []
  }
}

// ── Fetch from backend (async, for trend chart + history panel) ───
export const getHistoryFromServer = async (
  agentId?: string,
  submissionId?: string,
  limit = 50
): Promise<HistoryEntry[]> => {
  try {
    const params: Record<string, string | number> = { limit }
    if (agentId) params.agent_id = agentId
    if (submissionId) params.submission_id = submissionId

    const { data } = await axios.get(PROXY, {
      params,
      headers: { 'x-anthropic-api-key': getStoredKey() },
      timeout: 8000,
    })
    return (data as Record<string, unknown>[]).map(r => ({
      id: r.id as string,
      module: r.agent_name as string,
      moduleId: r.agent_id as string,
      timestamp: r.created_at as string,
      inputSnippet: (r.input_snippet as string) || '',
      result: r.result_summary,
      filename: r.filename as string | undefined,
      complianceScore: r.compliance_score as number | undefined,
      gapCountCritical: r.gap_count_critical as number | undefined,
      gapCountMajor: r.gap_count_major as number | undefined,
      gapCountMinor: r.gap_count_minor as number | undefined,
      submissionId: r.submission_id as string | undefined,
      status: r.status as string | undefined,
    }))
  } catch {
    // Backend unreachable — fall back to localStorage
    return getHistory().filter(e => {
      if (agentId && e.moduleId !== agentId) return false
      if (submissionId && e.submissionId !== submissionId) return false
      return true
    })
  }
}

// ── Score trend for chart ─────────────────────────────────────────
export const getScoreTrend = async (
  agentId: string,
  submissionId?: string
): Promise<{ date: string; score: number; filename?: string }[]> => {
  try {
    const params: Record<string, string> = {}
    if (submissionId) params.submission_id = submissionId
    const { data } = await axios.get(`${PROXY}/trend/${agentId}`, {
      params,
      headers: { 'x-anthropic-api-key': getStoredKey() },
      timeout: 8000,
    })
    return ((data as { trend?: Record<string, unknown>[] }).trend || []).map((p) => ({
      date: new Date(p.created_at as string).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short'
      }),
      score: p.compliance_score as number,
      filename: p.filename as string | undefined,
    }))
  } catch {
    // Fall back to localStorage data
    const history = getHistory()
      .filter(e => e.moduleId === agentId && e.complianceScore != null)
      .slice(0, 10)
      .reverse()
    return history.map(e => ({
      date: new Date(e.timestamp).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short'
      }),
      score: e.complianceScore!,
      filename: e.filename,
    }))
  }
}

// ── Local-only operations ─────────────────────────────────────────
export const clearHistory = (): void => {
  localStorage.removeItem(LS_KEY)
}

export const deleteHistoryEntry = (id: string): void => {
  const history = getHistory().filter(e => e.id !== id)
  localStorage.setItem(LS_KEY, JSON.stringify(history))
}

export const getLastTwoResults = (
  moduleId: string
): [HistoryEntry | null, HistoryEntry | null] => {
  const history = getHistory().filter(e => e.moduleId === moduleId)
  return [history[0] || null, history[1] || null]
}
