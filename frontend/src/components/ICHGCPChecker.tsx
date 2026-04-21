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
  const [error, setError] = useState<string | null>(null);

  const runCheck = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await runICHGCPChecker(text);
      setResult(response.result);
    } catch (err: unknown) {
      console.error('ICH GCP check failed:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
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
              ICH E6(R3) Compliance
              <div className="flex items-center gap-2">
                <span className={`status-chip text-sm normal-case font-medium ${statusColor(result.overall_gcp_status || result.overall_status || 'UNKNOWN')}`} style={{ padding: '4px 12px' }}>
                  Status: {safeRender(result.overall_gcp_status || result.overall_status || 'Unknown')}
                </span>
                <span className="status-chip text-sm font-normal normal-case">
                  Score: {safeRender(result.gcp_score)} ({safeRender(result.gcp_percentage)})
                </span>
              </div>
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col justify-center items-center text-center">
              <div className="text-xs text-slate-400 uppercase font-bold mb-1">Principles Assessed</div>
              <div className="text-2xl font-bold text-slate-100">{result.gcp_principles?.length ?? 0}</div>
            </div>
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex flex-col justify-center items-center text-center">
              <div className="text-xs text-red-400 uppercase font-bold mb-1">Critical Deviations</div>
              <div className="text-2xl font-bold text-red-300">{result.critical_deviations?.length ?? 0}</div>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col justify-center items-center text-center">
              <div className="text-xs text-amber-400 uppercase font-bold mb-1">Major Deviations</div>
              <div className="text-2xl font-bold text-amber-300">{result.major_deviations?.length ?? 0}</div>
            </div>
            <div className="rounded-xl border border-yellow-300/30 bg-yellow-300/10 p-4 flex flex-col justify-center items-center text-center">
              <div className="text-xs text-yellow-500 uppercase font-bold mb-1">Minor Deviations</div>
              <div className="text-2xl font-bold text-yellow-400">{result.minor_deviations?.length ?? 0}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {result.quality_tolerance_limits && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Quality Tolerance Limits</div>
                <div className="space-y-2 text-sm text-slate-300">
                  {Object.entries(result.quality_tolerance_limits).map(([key, value]) => (
                    <div key={key} className="flex gap-2 w-full">
                      <span className="capitalize w-32 text-slate-400">{key.replace(/_/g, ' ')}:</span>
                      <span className={typeof value === 'boolean' ? (value ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium') : ''}>{safeRender(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {result.risk_based_monitoring && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Risk Based Monitoring</div>
                <div className="space-y-2 text-sm text-slate-300">
                  {Object.entries(result.risk_based_monitoring).map(([key, value]) => (
                    <div key={key} className="flex gap-2 w-full">
                      <span className="capitalize w-32 text-slate-400">{key.replace(/_/g, ' ')}:</span>
                      <span className={typeof value === 'boolean' ? (value ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium') : ''}>{safeRender(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {result.essential_documents && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Essential Documents</div>
                <div className="space-y-2 text-sm text-slate-300">
                  {Object.entries(result.essential_documents).map(([key, value]) => (
                    <div key={key} className="flex gap-2 w-full">
                      <span className="capitalize w-32 text-slate-400">{key.replace(/_/g, ' ')}:</span>
                      <span className={key === 'status' ? statusColor(String(value)) : ''}>{safeRender(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {(Array.isArray(result.critical_deviations) && result.critical_deviations.length > 0 || Array.isArray(result.major_deviations) && result.major_deviations.length > 0 || Array.isArray(result.minor_deviations) && result.minor_deviations.length > 0) && (
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Identified Deviations</div>
              <div className="space-y-3">
                {Array.isArray(result.critical_deviations) && result.critical_deviations.map((item: string, i: number) => (
                  <div key={`crit-${i}`} className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex gap-3 items-start">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase text-red-300 bg-red-500/20 mt-0.5 whitespace-nowrap">CRITICAL</span>
                    <span>{safeRender(item)}</span>
                  </div>
                ))}
                {Array.isArray(result.major_deviations) && result.major_deviations.map((item: string, i: number) => (
                  <div key={`maj-${i}`} className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex gap-3 items-start">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase text-amber-300 bg-amber-500/20 mt-0.5 whitespace-nowrap">MAJOR</span>
                    <span>{safeRender(item)}</span>
                  </div>
                ))}
                {Array.isArray(result.minor_deviations) && result.minor_deviations.map((item: string, i: number) => (
                  <div key={`min-${i}`} className="rounded-xl border border-yellow-300/30 bg-yellow-300/10 px-4 py-3 text-sm text-yellow-200 flex gap-3 items-start">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase text-yellow-200 bg-yellow-300/20 mt-0.5 whitespace-nowrap">MINOR</span>
                    <span>{safeRender(item)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(result.gcp_principles) && result.gcp_principles.length > 0 && (
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">GCP Principles Checked</div>
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="border-b border-white/10 bg-slate-900/50 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold w-1/4">Principle</th>
                      <th className="px-4 py-3 font-semibold">ICH Reference</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Observation / Corrective Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {result.gcp_principles.map((item: any, i: number) => (
                      <tr key={i} className="hover:bg-white/5">
                        <td className="px-4 py-3 font-medium text-slate-200">{safeRender(item.principle)}</td>
                        <td className="px-4 py-3 text-xs">{safeRender(item.ich_reference)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${statusColor(item.status)}`}>{safeRender(item.status)}</span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="mb-1">{safeRender(item.observation)}</div>
                          {item.corrective_action && (
                            <div className="text-amber-300/80 mt-1 flex gap-1 items-start">
                              <span className="font-bold">CAPA:</span><span>{safeRender(item.corrective_action)}</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {Array.isArray(result.recommendations) && result.recommendations.length > 0 && (
            <div className="mb-6 rounded-2xl border border-blue-400/20 bg-blue-400/10 px-5 py-4">
              <div className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-3">Recommendations</div>
              <div className="space-y-1 text-sm text-blue-300">
                {result.recommendations.map((item: string, i: number) => (
                  <div key={i}>• {safeRender(item)}</div>
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
