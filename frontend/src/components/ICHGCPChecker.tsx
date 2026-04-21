'use client';

import React, { useState } from 'react';
import ModelAttributionBadge from './ModelAttributionBadge';
import { runICHGCPChecker } from '@/services/api';

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
  if (['COMPLIANT','COMPLETE','READY','PASSED','LOW','COMPLETED','PROBABLE','HIGH','STRONG','YES'].includes(upper)) return 'text-green-400 bg-green-400/10'
  if (['PARTIAL','NEEDS_REVISION','MEDIUM','POSSIBLE','MINOR'].includes(upper)) return 'text-amber-400 bg-amber-400/10'
  return 'text-red-400 bg-red-400/10'
}

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

          <div className="border-b border-white/10 pb-4 mb-6 mt-4">
            <h2 className="text-xl font-bold uppercase tracking-wider text-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
              ICH E6(R3) Compliance
              <div className="flex items-center gap-2">
                <span className={`status-chip text-sm normal-case font-medium ${statusColor(result.inspection_readiness)}`} style={{ padding: '4px 12px' }}>
                  Readiness: {safeRender(result.inspection_readiness)}
                </span>
              </div>
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 flex flex-col justify-center items-center text-center">
              <div className="text-xs text-indigo-400 uppercase font-bold mb-1">GCP Compliance</div>
              <div className={`text-lg font-bold mt-1 ${statusColor(result.gcp_compliance)}`} style={{ background: 'transparent' }}>
                {safeRender(result.gcp_compliance)}
              </div>
            </div>
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 flex flex-col justify-center items-center text-center">
              <div className="text-xs text-violet-400 uppercase font-bold mb-1">R3 Specific Gaps</div>
              <div className="text-2xl font-bold text-violet-300">
                {Array.isArray(result.r3_gaps) ? result.r3_gaps.length : 0}
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col justify-center items-center text-center">
              <div className="text-xs text-amber-400 uppercase font-bold mb-1">Findings</div>
              <div className="text-2xl font-bold text-amber-300">
                {Array.isArray(result.findings) ? result.findings.length : 0}
              </div>
            </div>
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex flex-col justify-center items-center text-center">
              <div className="text-xs text-red-400 uppercase font-bold mb-1">Risk Areas</div>
              <div className="text-2xl font-bold text-red-300">
                {Array.isArray(result.inspection_risk_areas) ? result.inspection_risk_areas.length : 0}
              </div>
            </div>
          </div>

          {Array.isArray(result.strengths) && result.strengths.length > 0 && (
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Process Strengths</div>
              <div className="flex flex-wrap gap-2">
                {result.strengths.map((s: string, i: number) => (
                  <span key={i} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 flex items-center gap-1.5">
                    <span className="text-emerald-500">✓</span>
                    {safeRender(s)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(result.r3_gaps) && result.r3_gaps.length > 0 && (
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">R3 Specific Gaps</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.r3_gaps.map((gap: any, i: number) => (
                  <div key={i} className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 flex flex-col justify-between">
                    <div>
                      <div className="text-sm font-bold text-violet-300 mb-1">{safeRender(gap.section || gap.title || `Gap ${i + 1}`)}</div>
                      <div className="text-xs text-slate-300 leading-relaxed">{safeRender(gap.description || gap.detail || gap)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {Array.isArray(result.findings) && result.findings.length > 0 && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">General Findings</div>
                <div className="space-y-3">
                  {result.findings.map((f: any, i: number) => (
                    <div key={i} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex gap-3 items-start text-sm">
                      <div className="text-amber-500 mt-0.5">•</div>
                      <div>
                        <div className="font-semibold text-amber-200">{safeRender(f.section || f.title || `Finding ${i + 1}`)}</div>
                        <div className="text-slate-300 text-xs mt-0.5">{safeRender(f.description || f.detail || f)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(result.inspection_risk_areas) && result.inspection_risk_areas.length > 0 && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Inspection Risk Areas</div>
                <div className="space-y-3">
                  {result.inspection_risk_areas.map((risk: any, i: number) => (
                    <div key={i} className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 flex gap-3 items-start text-sm">
                      <div className="text-red-500 mt-0.5 font-bold">!</div>
                      <div className="text-red-200/90">{safeRender(risk.description || risk.title || risk)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {result.audit_log && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wider">Audit Log:</span>
                <span>{safeRender(result.audit_log.timestamp)}</span>
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
