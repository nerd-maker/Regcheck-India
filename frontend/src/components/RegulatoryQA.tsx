'use client';

import React, { useState } from 'react';
import ModelAttributionBadge from './ModelAttributionBadge';
import { runRegulatoryQA } from '@/services/api';

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

  const runQA = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await runRegulatoryQA(question);
      setResult(response.result);
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
          </div>
        </div>

        <div className="mb-5">
          <label className="metric-label mb-2 block">Regulatory question *</label>
          <input
            type="text"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-400/50 focus:outline-none"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What are the sample size requirements for Phase III trials under NDCTR 2019?"
          />
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

      {error && (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-red-400 text-lg">⚠</span>
            <div>
              <div className="text-red-400 font-medium text-sm">Request Failed</div>
              <div className="text-red-300 text-sm mt-1">{error}</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            If the server is starting up, wait 30 seconds and try again. 
            Free tier servers sleep after 15 minutes of inactivity.
          </div>
        </div>
      )}

      {result && (
        <div className="glass-panel p-6">
          <ModelAttributionBadge attribution={result?.model_attribution} />

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
                  <span key={i} className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-xs font-medium text-blue-300 shadow-sm flex items-center gap-1.5">
                    <svg className="w-3 h-3 opacity-70" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>
                    {safeRender(cite)}
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
        </div>
      )}
    </div>
  );
}
