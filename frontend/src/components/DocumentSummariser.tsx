'use client';

import React, { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import ModelAttributionBadge from './ModelAttributionBadge';
import { runDocumentSummariser, extractTextFromFileOCR, transcribeMeetingAudio } from '@/services/api';

const safeRender = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(safeRender).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const statusColor = (status: string) => {
  const upper = String(status).toUpperCase();
  if (['COMPLIANT','COMPLETE','READY','PASSED','LOW','COMPLETED','PROBABLE'].includes(upper)) return 'text-green-400 bg-green-400/10'
  if (['PARTIAL','NEEDS_REVISION','MEDIUM','POSSIBLE'].includes(upper)) return 'text-amber-400 bg-amber-400/10'
  return 'text-red-400 bg-red-400/10'
}

type Tab = 'sugam' | 'sae' | 'meeting' | 'audio';

const tabMeta: Record<Tab, { title: string; note: string; accent: string }> = {
  sugam: {
    title: 'SUGAM application',
    note: 'Map submission content to checklist sections and surface completeness gaps.',
    accent: '#5bc0be',
  },
  sae: {
    title: 'SAE case narration',
    note: 'Condense adverse event narratives into a reviewer-first schema.',
    accent: '#ff8f5a',
  },
  meeting: {
    title: 'Meeting transcript',
    note: 'Extract decisions, actions, and regulatory references from long transcripts.',
    accent: '#ffd166',
  },
  audio: {
    title: 'Meeting Audio',
    note: 'Transcribe meeting recordings using Sarvam AI and generate summaries.',
    accent: '#3b82f6',
  },
};

export default function DocumentSummariser() {
  const [tab, setTab] = useState<Tab>('sugam');
  const [text, setText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'text' | 'scan' | 'handwritten'>('text');
  const [ocrResult, setOcrResult] = useState<{method: string, confidence: number, warnings: string[]} | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  
  // Audio specific state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [languageCode, setLanguageCode] = useState<string>('unknown');
  const [transcriptionMetadata, setTranscriptionMetadata] = useState<any>(null);

  const handleTextExtracted = (extractedText: string, _filename: string) => {
    setText(extractedText);
    setUploadError(null);
    setOcrResult(null);
  };

  const handleUploadError = (uploadMessage: string) => {
    setUploadError(uploadMessage);
  };

  const run = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await runDocumentSummariser(text, {
        document_type: tab === 'sugam' ? 'sugam_application' : tab === 'sae' ? 'sae_case' : 'meeting_transcript',
        checklist_type: tab === 'sugam' ? 'ct04' : undefined,
      });
      setResult(response.result);
      setTranscriptionMetadata(null);
    } catch (err: unknown) {
      console.error('Summarisation failed:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAudioTranscription = async () => {
    if (!audioFile) return;
    setError(null);
    setLoading(true);
    try {
      const data: any = await transcribeMeetingAudio(audioFile, languageCode);
      setResult(data.result);
      setTranscriptionMetadata(data.result.transcription);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="mb-5">
          <div className="section-kicker">Structured synthesis</div>
          <h3 className="mt-3 text-2xl font-semibold">Document summarisation engine</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Move from long-form narratives to concise reviewer packets with deterministic output shapes.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-4 mb-8">
          {(Object.keys(tabMeta) as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="rounded-[24px] border p-4 text-left transition-all"
              style={{
                borderColor: tab === key ? `${tabMeta[key].accent}55` : 'rgba(255,255,255,0.1)',
                backgroundColor: tab === key ? `${tabMeta[key].accent}18` : 'rgba(255,255,255,0.04)',
              }}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: tabMeta[key].accent }}>
                {key}
              </div>
              <div className="mt-2 text-lg font-semibold text-white">{tabMeta[key].title}</div>
              <div className="mt-2 text-sm leading-6 text-slate-400 line-clamp-2">{tabMeta[key].note}</div>
            </button>
          ))}
        </div>

        {tab !== 'audio' ? (
          <>
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                Input Method
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'text', label: '✏️ Type / Paste Text' },
                  { value: 'scan', label: '📄 Scanned Document (OCR)' },
                  { value: 'handwritten', label: '✍️ Handwritten Notes (AI Vision)' },
                ].map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => setInputMode(mode.value as 'text' | 'scan' | 'handwritten')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      inputMode === mode.value
                        ? 'bg-teal-600 text-white'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {(inputMode === 'scan' || inputMode === 'handwritten') && (
              <div className="mb-4">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setOcrLoading(true)
                    setError(null)
                    setOcrResult(null)
                    try {
                      const mode = inputMode === 'handwritten' ? 'vision' : 'auto'
                      const result = await extractTextFromFileOCR(file, mode)
                      setText(result.extracted_text)
                      setOcrResult({
                        method: result.ocr_method,
                        confidence: result.confidence,
                        warnings: result.warnings
                      })
                    } catch (err: unknown) {
                      setError(err instanceof Error ? err.message : 'OCR failed')
                    } finally {
                      setOcrLoading(false)
                    }
                  }}
                  className="hidden"
                  id="ocr-upload"
                />
                <label
                  htmlFor="ocr-upload"
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm cursor-pointer transition-all ${
                    ocrLoading
                      ? 'border-white/10 text-slate-500 cursor-wait'
                      : 'border-white/20 text-slate-300 hover:border-teal-400/50 hover:text-teal-400'
                  }`}
                >
                  {ocrLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                      {inputMode === 'handwritten' ? 'AI reading handwriting...' : 'Scanning document...'}
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                      </svg>
                      {inputMode === 'handwritten'
                        ? 'Upload handwritten notes (PNG, JPG, PDF)'
                        : 'Upload scanned document (PDF, PNG, JPG, TIFF)'
                      }
                    </>
                  )}
                </label>

                {ocrResult && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full font-medium">
                        {ocrResult.method}
                      </span>
                      <span className="text-slate-400">
                        Confidence: {Math.round(ocrResult.confidence * 100)}%
                      </span>
                    </div>
                    {ocrResult.warnings.length > 0 && (
                      <div className="space-y-1">
                        {ocrResult.warnings.map((w, i) => (
                          <div key={i} className="text-xs text-amber-400 flex items-center gap-1">
                            <span>⚠</span> {w}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {inputMode === 'text' && (
              <FileUpload onTextExtracted={handleTextExtracted} onError={handleUploadError} disabled={loading} />
            )}

            {uploadError && (
              <div className="mb-2 flex items-center gap-1 text-xs text-red-400">
                <span>⚠</span> {uploadError}
              </div>
            )}
            <textarea
              className="textarea-shell mt-5"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste filing text, SAE details, or meeting notes here."
            />

            <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-400">{tabMeta[tab].note}</div>
              <button type="button" className="primary-button" onClick={run} disabled={loading || !text.trim()}>
                {loading ? 'Summarising...' : 'Generate summary'}
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Language selector */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Meeting Language
                </label>
                <select
                  value={languageCode}
                  onChange={(e) => setLanguageCode(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="unknown">Auto-detect</option>
                  <option value="en-IN">English (Indian)</option>
                  <option value="hi-IN">Hindi</option>
                  <option value="mr-IN">Marathi</option>
                  <option value="gu-IN">Gujarati</option>
                  <option value="ta-IN">Tamil</option>
                  <option value="te-IN">Telugu</option>
                  <option value="kn-IN">Kannada</option>
                  <option value="bn-IN">Bengali</option>
                  <option value="ml-IN">Malayalam</option>
                </select>
              </div>

              {/* Audio file upload */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Audio File
                </label>
                <input
                  type="file"
                  accept=".mp3,.wav,.aac,.ogg,.flac,.m4a,.webm,.wma,.amr"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) setAudioFile(f)
                  }}
                  className="hidden"
                  id="audio-upload"
                />
                <label
                  htmlFor="audio-upload"
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:border-teal-400/50 hover:text-teal-400 cursor-pointer transition-all h-[42px]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <span className="text-sm truncate">
                    {audioFile ? audioFile.name : 'Upload meeting recording'}
                  </span>
                </label>
              </div>
            </div>

            <button
              onClick={handleAudioTranscription}
              disabled={loading || !audioFile}
              className="w-full bg-teal-600 text-white py-4 rounded-xl font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-teal-900/20"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Transcribing with Sarvam AI Saaras v3...
                </>
              ) : 'Transcribe & Summarise Meeting'}
            </button>
            <p className="text-center text-xs text-slate-500">
              Supports any duration (automatic chunking). Max file size 50MB.
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-red-400 text-lg">⚠</span>
            <div>
              <div className="text-red-400 font-medium text-sm">Action Failed</div>
              <div className="text-red-300 text-sm mt-1">{error}</div>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="glass-panel p-6">
          <ModelAttributionBadge attribution={result?.model_attribution} />

          {transcriptionMetadata && (
            <div className="rounded-2xl border border-teal-500/20 bg-teal-500/5 px-5 py-4 mb-6">
              <div className="text-xs font-semibold text-teal-400 uppercase tracking-wider mb-3 flex justify-between">
                Sarvam AI Transcription
                <span className="normal-case opacity-60">Saaras v3</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Duration', value: `${transcriptionMetadata.duration_seconds}s` },
                  { label: 'Language', value: transcriptionMetadata.language_detected },
                  { label: 'Words', value: transcriptionMetadata.word_count },
                  { label: 'Chunks', value: transcriptionMetadata.chunk_count },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="text-xs text-slate-400">{item.label}</div>
                    <div className="text-sm font-semibold text-teal-400 mt-0.5">{safeRender(item.value)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-b border-white/10 pb-4 mb-6 mt-4">
            <h2 className="text-xl font-bold uppercase tracking-wider text-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
              {transcriptionMetadata ? 'MEETING SUMMARY' : 'DOCUMENT SUMMARY'}
              <div className="flex items-center gap-2">
                <span className="status-chip text-sm normal-case font-medium">
                  {safeRender(result.meeting_type || result.document_type || 'General')}
                </span>
                <span className={`status-chip text-sm normal-case font-medium ${statusColor(result.risk_level || 'LOW')}`} style={{ padding: '4px 12px' }}>
                  {result.risk_level ? `Risk: ${result.risk_level}` : result.meeting_date}
                </span>
              </div>
            </h2>
          </div>

          <div className="mb-6">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">[EXECUTIVE SUMMARY]</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-slate-200 leading-relaxed">
                {safeRender(result.summary)}
              </p>
            </div>
          </div>

          {/* Meeting-specific results */}
          {transcriptionMetadata ? (
            <div className="space-y-8">
              {/* Decisions & Action Items */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                    Key Decisions
                  </div>
                  <div className="space-y-3">
                    {Array.isArray(result.key_decisions) && result.key_decisions.map((dec: any, i: number) => (
                      <div key={i} className="rounded-xl border border-white/5 bg-white/5 p-4 space-y-2">
                        <div className="text-sm font-semibold text-teal-100">{safeRender(dec.decision)}</div>
                        <div className="text-xs text-slate-400 leading-relaxed">
                          <span className="font-bold text-slate-500 uppercase mr-1">Rationale:</span>
                          {safeRender(dec.rationale)}
                        </div>
                        {dec.regulatory_reference && (
                          <div className="text-[10px] text-teal-400/80 italic">{safeRender(dec.regulatory_reference)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    Action Items
                  </div>
                  <div className="space-y-3">
                    {Array.isArray(result.action_items) && result.action_items.map((item: any, i: number) => (
                      <div key={i} className="rounded-xl border border-white/5 bg-white/5 p-4 flex gap-3">
                        <div className={`w-1 h-auto rounded-full ${item.priority === 'HIGH' ? 'bg-rose-500' : item.priority === 'MEDIUM' ? 'bg-amber-500' : 'bg-teal-500'}`} />
                        <div className="flex-1">
                          <div className="text-sm text-slate-200 mb-2">{safeRender(item.action)}</div>
                          <div className="flex flex-wrap gap-3">
                            <div className="text-[10px] text-slate-400 uppercase tracking-tighter">
                              <span className="text-slate-600 mr-1">Owner:</span> {safeRender(item.owner)}
                            </div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-tighter">
                              <span className="text-slate-600 mr-1">Due:</span> {safeRender(item.deadline)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Next Steps & Topics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Next Steps</div>
                  <div className="space-y-2">
                    {Array.isArray(result.next_steps) && result.next_steps.map((step: any, i: number) => (
                      <div key={i} className="flex gap-3 text-sm text-slate-300">
                        <span className="text-teal-500 font-bold">{i+1}.</span>
                        <span>{safeRender(step)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Regulatory Context</div>
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(result.regulatory_topics_discussed) && result.regulatory_topics_discussed.map((topic: any, i: number) => (
                      <span key={i} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-400">
                        {safeRender(topic)}
                      </span>
                    ))}
                  </div>
                  {Array.isArray(result.safety_signals) && result.safety_signals.length > 0 && (
                    <div className="mt-6">
                      <div className="text-xs font-bold uppercase tracking-wider text-rose-400/70 mb-3 flex items-center gap-2">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" /></svg>
                        Safety Signals
                      </div>
                      <div className="space-y-2">
                        {result.safety_signals.map((sig: any, i: number) => (
                          <div key={i} className="text-xs text-rose-300 bg-rose-500/10 px-3 py-2 rounded-lg border border-rose-500/20 italic">
                            {safeRender(sig)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col justify-center items-center text-center tracking-wide">
                  <div className="text-xs text-slate-400 uppercase font-semibold mb-1">Words (Original)</div>
                  <div className="text-2xl font-bold text-slate-100">{safeRender(result.word_count_original)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col justify-center items-center text-center tracking-wide">
                  <div className="text-xs text-slate-400 uppercase font-semibold mb-1">Readability Score</div>
                  <div className="text-xl font-bold text-slate-100">{safeRender(result.readability_score)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col justify-center items-center text-center tracking-wide">
                  <div className="text-xs text-slate-400 uppercase font-semibold mb-1">Risk Level</div>
                  <div className={`mt-1 font-bold ${statusColor(result.risk_level)} px-3 py-1 rounded-full text-sm`}>
                    {safeRender(result.risk_level)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {Array.isArray(result.key_sections) && result.key_sections.length > 0 && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">[KEY SECTIONS]</div>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300 ml-1">
                      {result.key_sections.map((item: any, i: number) => (
                        <li key={i} className="pl-1 leading-relaxed">{safeRender(item)}</li>
                      ))}
                    </ol>
                  </div>
                )}
                {Array.isArray(result.recommendations) && result.recommendations.length > 0 && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Recommendations</div>
                    <div className="space-y-2">
                      {result.recommendations.map((item: any, i: number) => (
                        <div key={i} className="flex gap-3 items-start border-l-2 border-amber-500/50 pl-3 bg-white/5 p-2 rounded-r-xl">
                          <span className="text-xs font-bold text-amber-500 mt-0.5">{i + 1}.</span>
                          <span className="text-sm text-slate-300 leading-relaxed">{safeRender(item)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {Array.isArray(result.compliance_gaps) && result.compliance_gaps.length > 0 && (
                <div className="mb-6">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Compliance Gaps</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {result.compliance_gaps.map((item: any, i: number) => (
                      <div key={i} className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200 flex items-start gap-3">
                        <svg className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>{safeRender(item)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(result.regulatory_references) && result.regulatory_references.length > 0 && (
                <div className="mb-6 border-t border-white/10 pt-6">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Regulatory References</div>
                  <div className="flex flex-wrap gap-2">
                    {result.regulatory_references.map((ref: any, i: number) => (
                      <span key={i} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                        {safeRender(ref)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {result.audit_log && (
            <div className="mt-8 border-t border-white/10 pt-4">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wider">Audit Log:</span>
                <span>{safeRender(result.audit_log.timestamp)}</span>
                <span>•</span>
                <span>{transcriptionMetadata ? `${result.audit_log.transcript_word_count} words` : `${result.audit_log.document_pages} pages`} processed</span>
                {result.audit_log.processing_time && (
                  <>
                    <span>•</span>
                    <span>Time: {safeRender(result.audit_log.processing_time)}</span>
                  </>
                )}
                <span>•</span>
                <span className={statusColor(result.audit_log.status)} style={{ padding: '2px 8px', borderRadius: '99px' }}>
                  {safeRender(result.audit_log.status)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
