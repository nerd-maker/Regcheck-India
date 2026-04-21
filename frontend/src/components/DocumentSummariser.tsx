'use client';

import React, { useState } from 'react';
import ModelAttributionBadge from './ModelAttributionBadge';
import { runDocumentSummariser } from '@/services/api';

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

type Tab = 'sugam' | 'sae' | 'meeting';

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
};

export default function DocumentSummariser() {
  const [tab, setTab] = useState<Tab>('sugam');
  const [text, setText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await runDocumentSummariser(text, {
        document_type: tab === 'sugam' ? 'sugam_application' : tab === 'sae' ? 'sae_case' : 'meeting_transcript',
        checklist_type: tab === 'sugam' ? 'ct04' : undefined,
      });
      setResult(response.result);
    } catch (err: unknown) {
      console.error('Summarisation failed:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
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

        <div className="grid gap-3 md:grid-cols-3">
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
              <div className="mt-2 text-sm leading-6 text-slate-400">{tabMeta[key].note}</div>
            </button>
          ))}
        </div>

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
              DOCUMENT SUMMARY
              <div className="flex items-center gap-2">
                <span className="status-chip text-sm normal-case font-medium">
                  {safeRender(result.document_type || 'General')}
                </span>
                <span className={`status-chip text-sm normal-case font-medium ${statusColor(result.risk_level)}`} style={{ padding: '4px 12px' }}>
                  Risk: {safeRender(result.risk_level)}
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

          {result.audit_log && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wider">Audit Log:</span>
                <span>{safeRender(result.audit_log.timestamp)}</span>
                <span>•</span>
                <span>{safeRender(result.audit_log.document_pages)} pages processed</span>
                <span>•</span>
                <span>Time: {safeRender(result.audit_log.processing_time)}</span>
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
