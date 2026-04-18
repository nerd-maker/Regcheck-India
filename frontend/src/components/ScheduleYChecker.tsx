'use client';

import React, { useState } from 'react';
import ModelAttributionBadge from './ModelAttributionBadge';
import { runScheduleYCompliance } from '@/services/api';

export default function ScheduleYChecker() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runCheck = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await runScheduleYCompliance(text);
      setResult(response.result);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Schedule Y check failed');
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
        <div className="rounded-3xl border border-rose-300/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">
          {error}
        </div>
      )}

      {result && (
        <div className="glass-panel p-6">
          <ModelAttributionBadge attribution={result?.model_attribution} />

          {result.compliance_evaluation && (
            <div className="mt-5">
              <div className="metric-label mb-3">Compliance evaluation</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm leading-7 text-slate-200">
                {typeof result.compliance_evaluation === 'string'
                  ? result.compliance_evaluation
                  : JSON.stringify(result.compliance_evaluation, null, 2)}
              </div>
            </div>
          )}

          {Array.isArray(result.compliant_areas) && result.compliant_areas.length > 0 && (
            <div className="mt-5">
              <div className="metric-label mb-3">Compliant areas</div>
              <div className="flex flex-wrap gap-2">
                {result.compliant_areas.map((area: string, i: number) => (
                  <span key={i} className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                    {area}
                  </span>
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
                    {f.severity && (
                      <span className="mt-2 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                        {f.severity}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(result.priority_actions) && result.priority_actions.length > 0 && (
            <div className="mt-5">
              <div className="metric-label mb-3">Priority actions</div>
              <div className="space-y-2">
                {result.priority_actions.map((action: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/30 text-xs font-bold">
                      {i + 1}
                    </span>
                    <span>{typeof action === 'string' ? action : action.description || JSON.stringify(action)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.estimated_remediation_effort && (
            <div className="mt-5">
              <div className="metric-label mb-3">Estimated remediation effort</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm leading-7 text-slate-300">
                {typeof result.estimated_remediation_effort === 'string'
                  ? result.estimated_remediation_effort
                  : JSON.stringify(result.estimated_remediation_effort, null, 2)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
