'use client';

import React, { useState, useEffect, useMemo } from 'react';
import FileUpload from '@/components/FileUpload';
import ModelAttributionBadge from './ModelAttributionBadge';
import OutputActions from '@/components/OutputActions';
import FeedbackWidget from '@/components/FeedbackWidget';
import AIDisclaimer from '@/components/AIDisclaimer';
import HistoryPanel from '@/components/HistoryPanel';
import { saveToHistory, HistoryEntry } from '@/services/history';
import { useServerStatus } from '@/hooks/useServerStatus';
import { moduleTransferStore } from '@/store/moduleTransfer';
import { RegulationCitation } from '@/utils/regulatoryLinks';
import { runRegulatoryQA } from '@/services/api';

const MODULE_ID = 'm6-reg-qa';
const MODULE_NAME = 'Regulatory Q&A';

const M6_SAMPLE = `What are the SAE reporting timelines under NDCTR 2019 and what is the difference between a Serious Adverse Event (SAE) and a Suspected Unexpected Serious Adverse Reaction (SUSAR)? When is expedited reporting required to CDSCO?`;

const validateInput = (text: string, minWords: number = 5): string | null => {
  if (!text || !text.trim()) {
    return 'Please enter or upload a document before running.'
  }
  const wordCount = text.trim().split(/\s+/).length
  if (wordCount < minWords) {
    return `Please provide more content - minimum ${minWords} words required (currently ${wordCount} words).`
  }
  if (wordCount > 8000) {
    return 'Document too long - please limit to 8,000 words for best results.'
  }
  return null
}

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
  if (['COMPLIANT','COMPLETE','READY','PASSED','LOW','COMPLETED','PROBABLE','HIGH'].includes(upper)) return 'text-green-400 bg-green-400/10'
  if (['PARTIAL','NEEDS_REVISION','MEDIUM','POSSIBLE'].includes(upper)) return 'text-amber-400 bg-amber-400/10'
  return 'text-red-400 bg-red-400/10'
}

export default function RegulatoryQA() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { status } = useServerStatus();
  const [elapsed, setElapsed] = useState(0);
  const wordCount = question.trim() ? question.trim().split(/\s+/).filter(Boolean).length : 0;

  useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [loading]);

  useEffect(() => {
    // Check for piped content from another module
    const transfer = moduleTransferStore.receive(MODULE_ID);
    if (transfer) {
      setQuestion(transfer.content);
      setError(null);
    }

    // Subscribe to live transfers
    const unsub = moduleTransferStore.subscribe(MODULE_ID, (payload) => {
      setQuestion(payload.content);
    });
    return () => { unsub(); };
  }, []);

  const resultHash = useMemo(() => {
    if (!result) return '';
    const str = JSON.stringify(result).substring(0, 200);
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h = h & h; }
    return Math.abs(h).toString(16);
  }, [result]);

  const handleTextExtracted = (extractedText: string, _filename: string) => {
    setQuestion(extractedText);
    setUploadError(null);
  };
  const handleUploadError = (uploadMessage: string) => setUploadError(uploadMessage);
  const handleRestore = (entry: HistoryEntry) => setResult(entry.result);

  const runQA = async () => {
    const validationError = validateInput(question, 5);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const response = await runRegulatoryQA(question);
      const res = response.result;
      setResult(res);
      saveToHistory(MODULE_NAME, MODULE_ID, question, res);
    } catch (err: unknown) {
      console.error('Q&A failed:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const confidenceColor = (conf: string) => {
    const c = (conf || '').toLowerCase();
    if (c === 'high') return 'text-emerald-300';
    if (c === 'medium') return 'text-amber-300';
    return 'text-rose-300';
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="section-kicker">Q&A lane</div>
            <h3 className="mt-3 text-2xl font-semibold">Regulatory Q&A (RAG)</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Ask regulatory questions grounded in retrieved context from the knowledge base. The
              agent answers only from the provided context and cites specific regulatory basis.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="status-chip">RAG</span>
            <span className="status-chip">Citations</span>
            <span className="status-chip">Context-bound</span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${status === 'online' ? 'bg-green-500/20 text-green-400' : status === 'slow' ? 'bg-amber-500/20 text-amber-400' : status === 'offline' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'}`}><span className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-green-400' : status === 'slow' ? 'bg-amber-400 animate-pulse' : status === 'offline' ? 'bg-red-400' : 'bg-slate-400 animate-pulse'}`}/>{status === 'online' && 'Ready'}{status === 'slow' && 'Waking up...'}{status === 'offline' && 'Offline'}{status === 'checking' && 'Connecting...'}</span>
            {status === 'slow' && <span className="text-xs text-amber-400/70">First request may take 30-60s</span>}
            <HistoryPanel onRestore={handleRestore} currentModuleId={MODULE_ID} />
          </div>
        </div>

        <div className="mb-5">
          <label className="metric-label mb-2 block">Regulatory question *</label>
          <FileUpload onTextExtracted={handleTextExtracted} onError={handleUploadError} disabled={loading} />
          {uploadError && (
            <div className="mb-2 flex items-center gap-1 text-xs text-red-400">
              <span>⚠</span> {uploadError}
            </div>
          )}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">Ask anything about NDCTR 2019, Schedule Y, or ICH guidelines</span>
            <button onClick={() => { setQuestion(M6_SAMPLE); setError(null); }} className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors px-2 py-1 rounded-lg hover:bg-teal-400/10">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              Load sample
            </button>
          </div>
          <input
            type="text"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-400/50 focus:outline-none"
            value={question}
            onChange={(e) => { setQuestion(e.target.value); setError(null); }}
            placeholder="e.g. What are the sample size requirements for Phase III trials under NDCTR 2019?"
          />
          {question && (
            <div className="flex items-center justify-between mt-1.5 px-1">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${
                  wordCount === 0 ? 'text-slate-500' :
                  wordCount < 20 ? 'text-red-400' :
                  wordCount < 50 ? 'text-amber-400' :
                  wordCount <= 3000 ? 'text-green-400' :
                  wordCount <= 6000 ? 'text-amber-400' :
                  'text-red-400'
                }`}>{wordCount} words</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  wordCount === 0 ? 'hidden' :
                  wordCount < 5 ? 'bg-red-500/10 text-red-400' :
                  wordCount < 20 ? 'bg-amber-500/10 text-amber-400' :
                  'bg-green-500/10 text-green-400'
                }`}>
                  {wordCount < 5 ? 'Too short' : wordCount < 20 ? 'Add more context' : 'Good question'}
                </span>
              </div>
            </div>
          )}
        </div>



        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-400">
            Answers are grounded in the NDCTR 2019, Schedule Y, and ICH regulatory knowledge base.
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={runQA}
            disabled={loading || !question.trim()}
          >
            {loading ? 'Answering...' : 'Ask question'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="mt-6 rounded-2xl border border-teal-500/20 bg-teal-500/5 px-6 py-5">
          <div className="flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
            <div>
              <div className="text-sm font-semibold text-teal-400">Processing... {elapsed}s</div>
              <div className="text-xs text-slate-400 mt-0.5">{elapsed < 10 ? 'Sending question to AI...' : elapsed < 30 ? 'Searching regulatory knowledge base...' : 'Generating citation-grounded answer...'}</div>
            </div>
          </div>
          {elapsed > 20 && <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-white/5">If server was inactive, first request takes 30-60 seconds to wake up</div>}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-red-400 text-lg">⚠</span>
            <div>
              <div className="text-red-400 font-medium text-sm">Request Failed</div>
              <div className="text-red-300 text-sm mt-1">{error}</div>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="glass-panel p-6">
          <ModelAttributionBadge attribution={result?.model_attribution} />
          {result._metadata && (
            <div className={`flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl border text-xs font-medium ${result._metadata.confidence_level === 'HIGH' ? 'border-green-500/30 bg-green-500/10 text-green-400' : result._metadata.confidence_level === 'MEDIUM' ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
              <span>{result._metadata.confidence_level} CONFIDENCE — {result._metadata.confidence_reason}</span>
            </div>
          )}

          <div className="border-b border-white/10 pb-4 mb-6 mt-4">
            <h2 className="text-xl font-bold uppercase tracking-wider text-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
              Regulatory Answer
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400 font-normal">{safeRender(result.query_type || 'General')}</span>
                <span className={`status-chip text-sm normal-case font-medium ${statusColor(result.confidence)}`} style={{ padding: '4px 12px' }}>
                  Confidence: {safeRender(result.confidence ?? '—')}
                </span>
              </div>
            </h2>
          </div>

          {/* Sources Retrieved Panel */}
          {result.retrieved_sources && result.retrieved_sources.length > 0 && (
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 px-5 py-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                  Answer Sourced From {result.source_count} Document{result.source_count !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-2">
                {result.retrieved_sources.map((source: {
                  title: string; short_name: string; authority: string;
                  relevance_score: number; snippet: string;
                }, i: number) => (
                  <div key={i} className="bg-white/5 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-400">{safeRender(source.short_name || source.title)}</span>
                        <span className="text-xs text-slate-500">{safeRender(source.authority)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${source.relevance_score >= 80 ? 'bg-green-400' : source.relevance_score >= 60 ? 'bg-amber-400' : 'bg-red-400'}`} />
                        <span className="text-xs text-slate-400">{safeRender(source.relevance_score)}% match</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 italic line-clamp-2">&quot;{safeRender(source.snippet)}&quot;</p>
                  </div>
                ))}
              </div>
              {!result.answer_grounded_in_documents && (
                <div className="mt-2 text-xs text-amber-400 flex items-center gap-1.5">
                  <span>⚠</span> Answer based on Claude training knowledge — not retrieved from documents
                </div>
              )}
            </div>
          )}

          <div className="mb-6">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Answer</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-inner">
              <p className="text-base text-slate-200 leading-relaxed font-medium whitespace-pre-wrap">
                {safeRender(result.answer ?? 'No answer generated.')}
              </p>
              {result.confidence_reason && (
                <p className="text-sm text-slate-400 mt-4 pt-4 border-t border-white/5 italic">
                  {safeRender(result.confidence_reason)}
                </p>
              )}
            </div>
          </div>

          {Array.isArray(result.regulatory_citations) && result.regulatory_citations.length > 0 && (
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Regulatory Basis & Citations</div>
              <div className="flex flex-wrap gap-2">
                {result.regulatory_citations.map((cite: string, i: number) => (
                  <span key={i} className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-xs font-medium text-blue-300 shadow-sm">
                    <RegulationCitation citation={safeRender(cite)} className="text-blue-300 hover:text-blue-200" />
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.follow_up_suggested && (
            <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/10 px-5 py-4 flex gap-3 items-start">
              <div className="text-amber-400 mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <div className="text-sm font-bold text-amber-300 uppercase tracking-wider mb-1">Follow-up Suggested</div>
                <div className="text-sm text-amber-200/80">Additional context or clarification may be required for a complete assessment.</div>
              </div>
            </div>
          )}

          {result.disclaimer && (
            <div className="mt-6 mb-2 text-xs italic text-slate-500 border-l-2 border-slate-700 pl-3">
              Disclaimer: {safeRender(result.disclaimer)}
            </div>
          )}

          {result.audit_log && (
            <div className="mt-4 border-t border-white/5 pt-4">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wider">Audit Log:</span>
                <span>{safeRender(result.audit_log.timestamp)}</span>
                {result.audit_log.sources_consulted && <span>• Sources: {safeRender(result.audit_log.sources_consulted)}</span>}
                <span>•</span>
                <span className={statusColor(result.audit_log.status)} style={{ padding: '2px 8px', borderRadius: '99px' }}>
                  {safeRender(result.audit_log.status)}
                </span>
              </div>
            </div>
          )}
          <AIDisclaimer />
          <OutputActions result={result} moduleName={MODULE_NAME}
            moduleId={MODULE_ID}
            inputSnippet={question.substring(0, 150)}
            pipeableContent={result.answer}
            pipeableLabel="answer text"
            textContent={`RegCheck-India - ${MODULE_NAME}\nGenerated: ${new Date().toLocaleString()}\n\nQ: ${question}\n\nA: ${result.answer || ''}\n\nCitations: ${(result.regulatory_citations || []).join('; ')}`} />
          <FeedbackWidget moduleName={MODULE_NAME} resultHash={resultHash} />
        </div>
      )}
    </div>
  );
}
