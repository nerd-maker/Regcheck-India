'use client'

import { useState, useEffect, useMemo } from 'react'
import { crossDocumentCheck } from '@/services/api'
import { saveToHistory } from '@/services/history'
import OutputActions from '@/components/OutputActions'
import FeedbackWidget from '@/components/FeedbackWidget'
import AIDisclaimer from '@/components/AIDisclaimer'

const MODULE_ID = 'm9-crossdoc'
const MODULE_NAME = 'Cross-Document Consistency'
const MAX_FILES = 5

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  'Clinical Trial Protocol': 'Protocol',
  'Informed Consent Form': 'ICF',
  'Investigator Brochure': 'IB',
  'SAE Report': 'SAE',
  'Statistical Analysis Plan': 'SAP',
  'Case Report Form': 'CRF',
  'Regulatory Document': 'Doc',
}

const safeRender = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(safeRender).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const statusColor = (status: string) => {
  const s = status?.toUpperCase() || ''
  if (['CONSISTENT', 'COMPLETED', 'LOW'].includes(s)) return 'text-green-400 bg-green-400/10 border-green-400/20'
  if (['MINOR_ISSUES', 'MEDIUM', 'MINOR'].includes(s)) return 'text-amber-400 bg-amber-400/10 border-amber-400/20'
  return 'text-red-400 bg-red-400/10 border-red-400/20'
}

const severityColor = (severity: string) => {
  const s = severity?.toUpperCase() || ''
  if (s === 'CRITICAL') return 'text-red-400 bg-red-400/10 border border-red-400/30'
  if (s === 'MAJOR') return 'text-amber-400 bg-amber-400/10 border border-amber-400/30'
  return 'text-yellow-400 bg-yellow-400/10 border border-yellow-400/30'
}

export default function CrossDocumentChecker() {
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading) { setElapsed(0); return }
    const timer = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(timer)
  }, [loading])

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || [])
    const validFiles = newFiles.filter(f =>
      f.name.endsWith('.pdf') || f.name.endsWith('.docx')
    )
    const invalid = newFiles.length - validFiles.length
    if (invalid > 0) {
      setError(`${invalid} file(s) skipped — only PDF and DOCX supported`)
    } else {
      setError(null)
    }
    setFiles(prev => {
      const combined = [...prev, ...validFiles]
      if (combined.length > MAX_FILES) {
        setError(`Maximum ${MAX_FILES} documents allowed`)
        return combined.slice(0, MAX_FILES)
      }
      return combined
    })
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const runAnalysis = async () => {
    if (files.length < 2) {
      setError('Please upload at least 2 documents to compare')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await crossDocumentCheck(files) as { result: Record<string, unknown> }
      setResult(data.result)
      saveToHistory(
        MODULE_NAME,
        MODULE_ID,
        files.map(f => f.name).join(', '),
        data.result
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const resultHash = useMemo(() => {
    if (!result) return ''
    const str = JSON.stringify(result).substring(0, 200)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i)
      hash = hash & hash
    }
    return Math.abs(hash).toString(16)
  }, [result])

  const textContent = result ? [
    `RegCheck-India — Cross-Document Consistency Report`,
    `Generated: ${new Date().toLocaleString('en-IN')}`,
    `Status: ${safeRender(result.overall_consistency_status)}`,
    `Score: ${safeRender(result.consistency_score)}`,
    `Critical Issues: ${safeRender(result.critical_count)}`,
    `Major Issues: ${safeRender(result.major_count)}`,
    `Minor Issues: ${safeRender(result.minor_count)}`,
    `Submission Risk: ${safeRender(result.submission_risk)}`,
  ].join('\n') : ''

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="glass-panel p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/>
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Cross-Document Consistency</h2>
              <p className="text-sm text-slate-400 mt-0.5">
                Check Protocol, ICF, IB, and SAE reports for contradictions and mismatches
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/20 text-violet-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400"/>
            M9
          </span>
        </div>

        {/* Document Upload Area */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Upload Documents ({files.length}/{MAX_FILES})
            </label>
            {files.length >= 2 && (
              <span className="text-xs text-green-400">
                Ready to analyze
              </span>
            )}
          </div>

          {/* File drop zone */}
          <div className="border-2 border-dashed border-white/10 rounded-2xl p-6 text-center hover:border-violet-500/40 transition-colors">
            <input
              type="file"
              multiple
              accept=".pdf,.docx"
              onChange={handleFileAdd}
              className="hidden"
              id="cross-doc-upload"
              disabled={files.length >= MAX_FILES || loading}
            />
            <label
              htmlFor="cross-doc-upload"
              className="cursor-pointer flex flex-col items-center gap-3"
            >
              <svg className="w-10 h-10 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
              </svg>
              <div>
                <div className="text-sm font-medium text-slate-300">
                  {files.length >= MAX_FILES
                    ? 'Maximum files reached'
                    : 'Click to upload or drag documents here'
                  }
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  PDF or DOCX — upload 2 to 5 documents (Protocol, ICF, IB, SAE, SAP)
                </div>
              </div>
            </label>
          </div>

          {/* Uploaded files list */}
          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              {files.map((file, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-white/5 rounded-xl border border-white/10">
                  <svg className="w-4 h-4 text-violet-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{file.name}</div>
                    <div className="text-xs text-slate-500">
                      {(file.size / 1024).toFixed(0)} KB
                    </div>
                  </div>
                  <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full shrink-0">
                    Doc {i + 1}
                  </span>
                  <button
                    onClick={() => removeFile(i)}
                    disabled={loading}
                    className="text-slate-500 hover:text-red-400 transition-colors shrink-0 disabled:opacity-40"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Minimum files warning */}
          {files.length === 1 && (
            <div className="mt-2 text-xs text-amber-400 flex items-center gap-1.5">
              <span>⚠</span> Upload at least one more document to enable analysis
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3">
            <div className="text-red-400 font-medium text-sm">⚠ {error}</div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 px-6 py-5">
            <div className="flex items-center gap-3 mb-2">
              <svg className="animate-spin h-5 w-5 text-violet-400 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              <div>
                <div className="text-sm font-semibold text-violet-400">
                  Analyzing {files.length} documents... {elapsed}s
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {elapsed < 15 && 'Extracting text from all documents...'}
                  {elapsed >= 15 && elapsed < 45 && 'Cross-referencing document content...'}
                  {elapsed >= 45 && elapsed < 90 && 'Identifying inconsistencies and regulatory impact...'}
                  {elapsed >= 90 && 'Generating detailed consistency report...'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Run button */}
        <button
          onClick={runAnalysis}
          disabled={loading || files.length < 2}
          className="mt-4 w-full bg-violet-600 text-white py-4 rounded-xl font-semibold hover:bg-violet-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? 'Analyzing...' : `Run Cross-Document Analysis (${files.length} documents)`}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">

          {/* Overall status header */}
          <div className="glass-panel p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Consistency Report</h3>
              <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${statusColor(safeRender(result.overall_consistency_status))}`}>
                {safeRender(result.overall_consistency_status).replace(/_/g, ' ')}
              </span>
            </div>

            {/* Documents analyzed */}
            {Array.isArray(result.documents_analyzed) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {result.documents_analyzed.map((doc: Record<string, unknown>, i: number) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-xs font-bold text-violet-400">
                      {DOCUMENT_TYPE_LABELS[safeRender(doc.document_type)] || 'Doc'}
                    </span>
                    <span className="text-xs text-slate-400 truncate max-w-32">
                      {safeRender(doc.document_name)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {safeRender(doc.word_count)}w
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Score + Risk row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-white mb-1">
                  {typeof result.consistency_score === 'number'
                    ? `${Math.round((result.consistency_score as number) * 100)}%`
                    : safeRender(result.consistency_score)}
                </div>
                <div className="text-xs text-slate-400">Consistency Score</div>
              </div>
              <div className="bg-red-500/10 rounded-xl p-4 text-center border border-red-500/20">
                <div className="text-2xl font-black text-red-400 mb-1">{safeRender(result.critical_count)}</div>
                <div className="text-xs text-slate-400">Critical</div>
              </div>
              <div className="bg-amber-500/10 rounded-xl p-4 text-center border border-amber-500/20">
                <div className="text-2xl font-black text-amber-400 mb-1">{safeRender(result.major_count)}</div>
                <div className="text-xs text-slate-400">Major</div>
              </div>
              <div className="bg-yellow-500/10 rounded-xl p-4 text-center border border-yellow-500/20">
                <div className="text-2xl font-black text-yellow-400 mb-1">{safeRender(result.minor_count)}</div>
                <div className="text-xs text-slate-400">Minor</div>
              </div>
            </div>
          </div>

          {/* Consistency Matrix */}
          {Array.isArray(result.consistency_matrix) && result.consistency_matrix.length > 0 && (
            <div className="glass-panel p-6">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Document Pair Analysis
              </div>
              <div className="space-y-2">
                {result.consistency_matrix.map((pair: Record<string, unknown>, i: number) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-xl">
                    <span className="text-sm text-slate-300">{safeRender(pair.doc_pair)}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">
                        {safeRender(pair.issue_count)} issues
                      </span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full border ${statusColor(safeRender(pair.status))}`}>
                        {safeRender(pair.status).replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inconsistencies */}
          {Array.isArray(result.inconsistencies) && result.inconsistencies.length > 0 && (
            <div className="glass-panel p-6">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Inconsistencies Found ({result.inconsistencies.length})
              </div>
              <div className="space-y-4">
                {result.inconsistencies.map((inc: Record<string, unknown>, i: number) => (
                  <div key={i} className={`rounded-2xl p-5 border ${
                    safeRender(inc.severity) === 'CRITICAL' ? 'border-red-500/30 bg-red-500/5' :
                    safeRender(inc.severity) === 'MAJOR' ? 'border-amber-500/30 bg-amber-500/5' :
                    'border-yellow-500/30 bg-yellow-500/5'
                  }`}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${severityColor(safeRender(inc.severity))}`}>
                        {safeRender(inc.severity)}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {safeRender(inc.inconsistency_id)}
                      </span>
                      <span className="text-xs bg-white/10 text-slate-300 px-2 py-0.5 rounded-full">
                        {safeRender(inc.category)}
                      </span>
                    </div>

                    <p className="text-sm text-white font-medium mb-3">
                      {safeRender(inc.description)}
                    </p>

                    {/* Side by side comparison */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-white/5 rounded-xl p-3">
                        <div className="text-xs font-semibold text-slate-400 mb-1">
                          {safeRender(inc.document_a)}
                        </div>
                        <p className="text-xs text-slate-300 italic">
                          &quot;{safeRender(inc.document_a_text)}&quot;
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3">
                        <div className="text-xs font-semibold text-slate-400 mb-1">
                          {safeRender(inc.document_b)}
                        </div>
                        <p className="text-xs text-slate-300 italic">
                          &quot;{safeRender(inc.document_b_text)}&quot;
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="text-xs text-slate-400">
                        <span className="font-semibold text-slate-300">Regulatory impact: </span>
                        {safeRender(inc.regulatory_impact)}
                      </div>
                      <div className="text-xs text-teal-400">
                        <span className="font-semibold">Recommendation: </span>
                        {safeRender(inc.recommendation)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Priority Actions */}
          {Array.isArray(result.priority_actions) && result.priority_actions.length > 0 && (
            <div className="glass-panel p-6">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Priority Actions
              </div>
              <div className="space-y-2">
                {result.priority_actions.map((action: Record<string, unknown>, i: number) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 bg-white/5 rounded-xl">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${
                      safeRender(action.urgency) === 'IMMEDIATE' ? 'bg-red-500/20 text-red-400' :
                      safeRender(action.urgency) === 'HIGH' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-slate-500/20 text-slate-400'
                    }`}>
                      {safeRender(action.urgency)}
                    </span>
                    <div>
                      <div className="text-sm text-white">{safeRender(action.action)}</div>
                      {Array.isArray(action.documents_affected) && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {action.documents_affected.map((doc: unknown, j: number) => (
                            <span key={j} className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded">
                              {safeRender(doc)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strengths */}
          {Array.isArray(result.cross_document_strengths) && result.cross_document_strengths.length > 0 && (
            <div className="glass-panel p-6">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Cross-Document Strengths
              </div>
              <div className="space-y-2">
                {result.cross_document_strengths.map((strength: unknown, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                    <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                    </svg>
                    {safeRender(strength)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submission Risk + Audit Log */}
          <div className="glass-panel p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Submission Risk
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-bold border ${statusColor(safeRender(result.submission_risk))}`}>
                {safeRender(result.submission_risk)} RISK
              </span>
            </div>
            {(() => {
              const log = result.audit_log as Record<string, unknown> | null | undefined
              if (!log || typeof log !== 'object') return null
              return (
                <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-2">
                  <span>Docs: {safeRender(log.documents_processed)}</span>
                  <span>•</span>
                  <span>Words: {safeRender(log.total_words_analyzed)}</span>
                  <span>•</span>
                  <span>{safeRender(log.timestamp)}</span>
                  <span>•</span>
                  <span className="text-green-400">{safeRender(log.status)}</span>
                </div>
              )
            })()}
          </div>

          <AIDisclaimer />
          <OutputActions
            result={result}
            moduleName={MODULE_NAME}
            moduleId={MODULE_ID}
            textContent={textContent}
            inputSnippet={files.map(f => f.name).join(', ')}
          />
          <FeedbackWidget moduleName={MODULE_NAME} resultHash={resultHash} />
        </div>
      )}
    </div>
  )
}
