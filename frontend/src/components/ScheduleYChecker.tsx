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
      setResult(response?.data?.result || response?.result);
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

          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="metric-card">
              <div className="metric-label">Status</div>
              <div className="metric-value font-semibold text-lg">{safeRender(result.overall_compliance_status)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Score</div>
              <div className="metric-value font-semibold text-lg">{safeRender(result.compliance_score)} / {safeRender(result.compliance_percentage)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Readiness</div>
              <div className="metric-value font-semibold text-lg">{safeRender(result.submission_readiness)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Regulatory Risk</div>
              <div className="metric-value font-semibold text-lg">{safeRender(result.regulatory_risk)}</div>
            </div>
          </div>

          {Array.isArray(result.compliance_checklist) && result.compliance_checklist.length > 0 && (
            <div className="mt-5">
              <div className="metric-label mb-3">Compliance Checklist</div>
              <div className="space-y-4">
                {result.compliance_checklist.map((item: any, i: number) => (
                  <div key={i} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-slate-300">
                    <div className="mb-2">
                      <span className="font-bold text-slate-100">Requirement: </span>
                      <span>{safeRender(item.requirement)}</span>
                    </div>
                    <div className="mb-2">
                      <span className="font-bold text-slate-100">Section: </span>
                      <span>{safeRender(item.section)}</span>
                    </div>
                    <div className="mb-2">
                      <span className="font-bold text-slate-100">Status: </span>
                      <span className="status-chip ml-2">{safeRender(item.status)}</span>
                    </div>
                    <div className="mb-2">
                      <span className="font-bold text-slate-100">Finding: </span>
                      <span>{safeRender(item.finding)}</span>
                    </div>
                    <div className="text-amber-300">
                      <span className="font-bold">Corrective Action: </span>
                      <span>{safeRender(item.corrective_action)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(result.critical_non_compliances) && result.critical_non_compliances.length > 0 && (
            <div className="mt-5 rounded-2xl border border-error/20 bg-error/10 px-5 py-4">
              <div className="metric-label text-error mb-3">Critical Non-Compliances</div>
              <div className="space-y-1 text-sm text-error">
                {result.critical_non_compliances.map((item: string, i: number) => (
                  <div key={i}>• {safeRender(item)}</div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(result.major_non_compliances) && result.major_non_compliances.length > 0 && (
            <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-4">
              <div className="metric-label text-amber-500 mb-3">Major Non-Compliances</div>
              <div className="space-y-1 text-sm text-amber-500">
                {result.major_non_compliances.map((item: string, i: number) => (
                  <div key={i}>• {safeRender(item)}</div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(result.minor_non_compliances) && result.minor_non_compliances.length > 0 && (
            <div className="mt-5 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-5 py-4">
              <div className="metric-label text-yellow-300 mb-3">Minor Non-Compliances</div>
              <div className="space-y-1 text-sm text-yellow-300">
                {result.minor_non_compliances.map((item: string, i: number) => (
                  <div key={i}>• {safeRender(item)}</div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(result.strengths) && result.strengths.length > 0 && (
            <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-4">
              <div className="metric-label text-emerald-400 mb-3">Strengths</div>
              <div className="space-y-1 text-sm text-emerald-400">
                {result.strengths.map((item: string, i: number) => (
                  <div key={i}>• {safeRender(item)}</div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(result.recommendations) && result.recommendations.length > 0 && (
            <div className="mt-5 rounded-2xl border border-blue-400/20 bg-blue-400/10 px-5 py-4">
              <div className="metric-label text-blue-400 mb-3">Recommendations</div>
              <div className="space-y-1 text-sm text-blue-400">
                {result.recommendations.map((item: string, i: number) => (
                  <div key={i}>• {safeRender(item)}</div>
                ))}
              </div>
            </div>
          )}

          {result.audit_log && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
              <div className="metric-label mb-3">Audit Log</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-300">
                {Object.entries(result.audit_log || {}).map(([key, value]) => (
                  <div key={key} className="flex gap-2 w-full">
                    <span className="capitalize w-48 text-slate-400">{key.replace(/_/g, ' ')}:</span>
                    <span>{safeRender(value)}</span>
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
