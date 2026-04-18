'use client';

import React, { useState } from 'react';
import ModelAttributionBadge from './ModelAttributionBadge';
import { runICHGCPChecker } from '@/services/api';

export default function ICHGCPChecker() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runCheck = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await runICHGCPChecker(text);
      setResult(response.result);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'ICH GCP check failed');
    } finally {
      setLoading(false);
    }
  };

  const readinessColor = (readiness: string) => {
    const r = (readiness || '').toLowerCase();
    if (r.includes('ready') || r.includes('high')) return 'text-emerald-300';
    if (r.includes('moderate') || r.includes('partial')) return 'text-amber-300';
    return 'text-rose-300';
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="section-kicker">GCP lane</div>
            <h3 className="mt-3 text-2xl font-semibold">ICH E6(R3) GCP compliance</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Assess documents against ICH E6(R3) Good Clinical Practice. Identifies R3-specific
              gaps, inspection risks, strengths, and overall inspection readiness.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="status-chip">ICH E6(R3)</span>
            <span className="status-chip">GCP</span>
            <span className="status-chip">Inspection-ready</span>
          </div>
        </div>

        <textarea
          className="textarea-shell"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the document text for ICH E6(R3) GCP compliance assessment."
        />

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-400">
            Returns GCP compliance status, R3-specific gaps, strengths, and inspection readiness.
          </p>
          <button type="button" className="primary-button" onClick={runCheck} disabled={loading || !text.trim()}>
            {loading ? 'Assessing...' : 'Run GCP compliance check'}
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

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {result.gcp_compliance && (
              <div className="metric-card">
                <div className="metric-label">GCP compliance</div>
                <div className="metric-value text-lg">
                  {typeof result.gcp_compliance === 'string' ? result.gcp_compliance : 'See details'}
                </div>
              </div>
            )}
            {result.inspection_readiness && (
              <div className="metric-card">
                <div className="metric-label">Inspection readiness</div>
                <div className={`metric-value text-lg ${readinessColor(
                  typeof result.inspection_readiness === 'string' ? result.inspection_readiness : ''
                )}`}>
                  {typeof result.inspection_readiness === 'string'
                    ? result.inspection_readiness
                    : JSON.stringify(result.inspection_readiness)}
                </div>
              </div>
            )}
          </div>

          {Array.isArray(result.strengths) && result.strengths.length > 0 && (
            <div className="mt-5">
              <div className="metric-label mb-3">Strengths</div>
              <div className="flex flex-wrap gap-2">
                {result.strengths.map((s: string, i: number) => (
                  <span key={i} className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(result.r3_gaps) && result.r3_gaps.length > 0 && (
            <div className="mt-5">
              <div className="metric-label mb-3">R3-specific gaps ({result.r3_gaps.length})</div>
              <div className="space-y-3">
                {result.r3_gaps.map((gap: any, i: number) => (
                  <div key={i} className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-200">
                    <div className="font-semibold text-rose-100">
                      {gap.section || gap.title || `Gap ${i + 1}`}
                    </div>
                    <div className="mt-1 text-rose-300">
                      {gap.description || gap.detail || (typeof gap === 'string' ? gap : JSON.stringify(gap))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(result.findings) && result.findings.length > 0 && (
            <div className="mt-5">
              <div className="metric-label mb-3">Findings ({result.findings.length})</div>
              <div className="space-y-3">
                {result.findings.map((f: any, i: number) => (
                  <div key={i} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-slate-300">
                    <div className="font-semibold text-slate-100">{f.section || f.title || `Finding ${i + 1}`}</div>
                    <div className="mt-1 text-slate-400">{f.description || f.detail || JSON.stringify(f)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(result.inspection_risk_areas) && result.inspection_risk_areas.length > 0 && (
            <div className="mt-5">
              <div className="metric-label mb-3">Inspection risk areas</div>
              <div className="space-y-2">
                {result.inspection_risk_areas.map((risk: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/30 text-xs font-bold">
                      !
                    </span>
                    <span>{typeof risk === 'string' ? risk : risk.description || JSON.stringify(risk)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
