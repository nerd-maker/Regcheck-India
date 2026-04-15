'use client';

import React, { useState } from 'react';
import ModelAttributionBadge from './ModelAttributionBadge';
import { api } from '@/services/api';

export default function RegulatoryQA() {
  const [question, setQuestion] = useState('');
  const [context, setContext] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runQA = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.regulatoryQA(question, context);
      setResult(response);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Q&A failed');
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

        <div className="mb-5">
          <label className="metric-label mb-2 block">Retrieved context *</label>
          <textarea
            className="textarea-shell"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Paste the retrieved regulatory context from ChromaDB / knowledge base here. The agent will answer ONLY from this context."
          />
        </div>

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-400">
            The agent will state when context is insufficient. Answers include regulatory citations.
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={runQA}
            disabled={loading || !question.trim() || !context.trim()}
          >
            {loading ? 'Answering...' : 'Ask question'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-3xl border border-rose-300/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">
          {error}
        </div>
      )}

      {result && (
        <div className="glass-panel p-6">
          <ModelAttributionBadge attribution={result?.model_attribution} />

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="metric-card">
              <div className="metric-label">Confidence</div>
              <div className={`metric-value ${confidenceColor(result.confidence)}`}>
                {result.confidence ?? '—'}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Citations</div>
              <div className="metric-value">
                {Array.isArray(result.regulatory_citations) ? result.regulatory_citations.length : 0}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Follow-up suggested</div>
              <div className={`metric-value text-lg ${result.follow_up_suggested ? 'text-amber-300' : 'text-emerald-300'}`}>
                {result.follow_up_suggested ? 'Yes' : 'No'}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="metric-label mb-3">Answer</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm leading-7 text-slate-200">
              {result.answer ?? 'No answer generated.'}
            </div>
          </div>

          {result.confidence_reason && (
            <div className="mt-4">
              <div className="metric-label mb-2">Confidence reason</div>
              <p className="text-sm text-slate-400">{result.confidence_reason}</p>
            </div>
          )}

          {Array.isArray(result.regulatory_citations) && result.regulatory_citations.length > 0 && (
            <div className="mt-5">
              <div className="metric-label mb-3">Regulatory citations</div>
              <div className="flex flex-wrap gap-2">
                {result.regulatory_citations.map((cite: string, i: number) => (
                  <span key={i} className="rounded-full bg-blue-400/15 px-3 py-1 text-xs font-semibold text-blue-300">
                    {cite}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.disclaimer && (
            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-5 py-3 text-sm text-amber-200">
              ⚠ {result.disclaimer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
