'use client';

import React, { useState } from 'react';
import ModelAttributionBadge from './ModelAttributionBadge';
import { runScheduleYCompliance } from '@/services/api';

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
  if (['PARTIAL','NEEDS_REVISION','MEDIUM','POSSIBLE','MINOR NON-COMPLIANCE'].includes(upper)) return 'text-amber-400 bg-amber-400/10'
  return 'text-red-400 bg-red-400/10'
}

export default function ScheduleYChecker() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCheck = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await runScheduleYCompliance(text);
      setResult(response?.data?.result || response?.result);
    } catch (err: unknown) {
      console.error('Schedule Y check failed:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="section-kicker">Schedule Y lane</div>
            <h3 className="mt-3 text-2xl font-semibold">Schedule Y / CDSCO compliance check</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Perform a deep compliance review against Schedule Y and NDCTR 2019, identifying
              compliant areas, findings, and priority actions with estimated remediation effort.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="status-chip">Schedule Y</span>
            <span className="status-chip">NDCTR 2019</span>
            <span className="status-chip">CDSCO</span>
          </div>
        </div>

        <textarea
          className="textarea-shell"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the document text to check against Schedule Y and CDSCO requirements."
        />

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-400">
            Returns compliance evaluation, findings, compliant areas, and priority actions.
          </p>
          <button type="button" className="primary-button" onClick={runCheck} disabled={loading || !text.trim()}>
            {loading ? 'Checking...' : 'Run Schedule Y check'}
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
              Schedule Y Compliance Report
              <div className="flex items-center gap-2">
                <span className={`status-chip text-sm normal-case font-medium ${statusColor(result.submission_readiness)}`} style={{ padding: '4px 12px' }}>
                  Readiness: {safeRender(result.submission_readiness)}
                </span>
                <span className={`status-chip text-sm normal-case font-medium ${statusColor(result.overall_compliance_status)}`} style={{ padding: '4px 12px' }}>
                  Status: {safeRender(result.overall_compliance_status)}
                </span>
              </div>
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 flex flex-col justify-center items-center text-center">
              <div className="text-xs text-indigo-400 uppercase font-bold mb-1">Score</div>
              <div className="text-2xl font-bold text-indigo-300">
                {safeRender(result.compliance_score)}<span className="text-base text-indigo-400/70 ml-1">/ {safeRender(result.compliance_percentage)}%</span>
              </div>
            </div>
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex flex-col justify-center items-center text-center">
              <div className="text-xs text-red-400 uppercase font-bold mb-1">Critical Gaps</div>
              <div className="text-2xl font-bold text-red-300">
                {Array.isArray(result.critical_non_compliances) ? result.critical_non_compliances.length : 0}
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col justify-center items-center text-center">
              <div className="text-xs text-amber-400 uppercase font-bold mb-1">Major Gaps</div>
              <div className="text-2xl font-bold text-amber-300">
                {Array.isArray(result.major_non_compliances) ? result.major_non_compliances.length : 0}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col justify-center items-center text-center">
              <div className="text-xs text-slate-400 uppercase font-bold mb-1">Regulatory Risk</div>
              <div className={`text-xl font-bold ${statusColor(result.regulatory_risk)}`} style={{ background: 'transparent' }}>
                {safeRender(result.regulatory_risk)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {Array.isArray(result.strengths) && result.strengths.length > 0 && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Strengths</div>
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <ul className="space-y-2 text-sm text-emerald-200/90">
                    {result.strengths.map((item: string, i: number) => (
                      <li key={i} className="flex gap-2 items-start"><span className="text-emerald-500">✓</span>{safeRender(item)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {Array.isArray(result.recommendations) && result.recommendations.length > 0 && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Recommendations</div>
                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                  <ul className="space-y-2 text-sm text-blue-200/90">
                    {result.recommendations.map((item: string, i: number) => (
                      <li key={i} className="flex gap-2 items-start"><span className="text-blue-500">→</span>{safeRender(item)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {(Array.isArray(result.critical_non_compliances) && result.critical_non_compliances.length > 0 || Array.isArray(result.major_non_compliances) && result.major_non_compliances.length > 0 || Array.isArray(result.minor_non_compliances) && result.minor_non_compliances.length > 0) && (
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Identified Gaps</div>
              <div className="space-y-3">
                {Array.isArray(result.critical_non_compliances) && result.critical_non_compliances.map((item: string, i: number) => (
                  <div key={`crit-${i}`} className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex gap-3 items-start">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase text-red-300 bg-red-500/20 mt-0.5 whitespace-nowrap">CRITICAL</span>
                    <span>{safeRender(item)}</span>
                  </div>
                ))}
                {Array.isArray(result.major_non_compliances) && result.major_non_compliances.map((item: string, i: number) => (
                  <div key={`maj-${i}`} className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex gap-3 items-start">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase text-amber-300 bg-amber-500/20 mt-0.5 whitespace-nowrap">MAJOR</span>
                    <span>{safeRender(item)}</span>
                  </div>
                ))}
                {Array.isArray(result.minor_non_compliances) && result.minor_non_compliances.map((item: string, i: number) => (
                  <div key={`min-${i}`} className="rounded-xl border border-yellow-300/30 bg-yellow-300/10 px-4 py-3 text-sm text-yellow-200 flex gap-3 items-start">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase text-yellow-200 bg-yellow-300/20 mt-0.5 whitespace-nowrap">MINOR</span>
                    <span>{safeRender(item)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(result.compliance_checklist) && result.compliance_checklist.length > 0 && (
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Detailed Checklist</div>
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="border-b border-white/10 bg-slate-900/50 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold w-24">Section</th>
                      <th className="px-4 py-3 font-semibold">Requirement</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Finding / Corrective Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {result.compliance_checklist.map((item: any, i: number) => (
                      <tr key={i} className="hover:bg-white/5">
                        <td className="px-4 py-3 font-medium text-slate-200 whitespace-nowrap">{safeRender(item.section)}</td>
                        <td className="px-4 py-3 text-xs leading-relaxed max-w-xs">{safeRender(item.requirement)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${statusColor(item.status)}`}>{safeRender(item.status)}</span>
                        </td>
                        <td className="px-4 py-3 text-xs max-w-sm">
                          <div className="mb-1">{safeRender(item.finding)}</div>
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
