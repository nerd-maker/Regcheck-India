'use client';

import React, { useState } from 'react';
import ModelAttributionBadge from './ModelAttributionBadge';
import { api } from '@/services/api';

export default function InspectionReportGenerator() {
  const [text, setText] = useState('');
  const [facilityType, setFacilityType] = useState('manufacturing');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runGeneration = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.generateInspectionReport(text, {
        facility_type: facilityType,
      });
      setResult(response);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Report generation failed');
    } finally {
      setLoading(false);
    }
  };

  const ratingColor = (rating: string) => {
    const r = (rating || '').toLowerCase();
    if (r.includes('compliant') && !r.includes('non')) return 'text-emerald-300';
    if (r.includes('non') || r.includes('critical')) return 'text-rose-300';
    return 'text-amber-300';
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="section-kicker">Inspection lane</div>
            <h3 className="mt-3 text-2xl font-semibold">Inspection report generation</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Transform raw inspection findings into a structured CDSCO-style report with
              observations, CAPA plan, and overall compliance rating.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="status-chip">CDSCO</span>
            <span className="status-chip">CAPA</span>
            <span className="status-chip">GMP</span>
          </div>
        </div>

        <div className="mb-5">
          <label className="metric-label mb-2 block">Facility type</label>
          <select
            value={facilityType}
            onChange={(e) => setFacilityType(e.target.value)}
            className="w-full max-w-xs rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 focus:border-teal-400/50 focus:outline-none"
          >
            <option value="manufacturing">Manufacturing Site</option>
            <option value="clinical_site">Clinical Trial Site</option>
            <option value="laboratory">Testing Laboratory</option>
            <option value="warehouse">Storage / Warehouse</option>
          </select>
        </div>

        <textarea
          className="textarea-shell"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste raw inspection findings, audit observations, or field notes here."
        />

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-400">
            Returns a structured report with observations, CAPA plan, and compliance rating.
          </p>
          <button type="button" className="primary-button" onClick={runGeneration} disabled={loading || !text.trim()}>
            {loading ? 'Generating report...' : 'Generate inspection report'}
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

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="metric-card">
              <div className="metric-label">Report type</div>
              <div className="metric-value text-lg">{result.report_type ?? 'Inspection'}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Overall compliance rating</div>
              <div className={`metric-value text-lg ${ratingColor(result.overall_compliance_rating ?? '')}`}>
                {result.overall_compliance_rating ?? '—'}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Re-inspection required</div>
              <div className={`metric-value text-lg ${result.re_inspection_required ? 'text-rose-300' : 'text-emerald-300'}`}>
                {result.re_inspection_required ? 'Yes' : 'No'}
              </div>
            </div>
          </div>

          {result.executive_summary && (
            <div className="mt-5">
              <div className="metric-label mb-3">Executive summary</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm leading-7 text-slate-300">
                {typeof result.executive_summary === 'string'
                  ? result.executive_summary
                  : JSON.stringify(result.executive_summary, null, 2)}
              </div>
            </div>
          )}

          {Array.isArray(result.observations) && result.observations.length > 0 && (
            <div className="mt-5">
              <div className="metric-label mb-3">Observations ({result.observations.length})</div>
              <div className="space-y-3">
                {result.observations.map((obs: any, i: number) => (
                  <div key={i} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-slate-300">
                    <div className="font-semibold text-slate-100">
                      {obs.category || obs.title || `Observation ${i + 1}`}
                    </div>
                    <div className="mt-1 text-slate-400">
                      {obs.description || obs.finding || JSON.stringify(obs)}
                    </div>
                    {obs.severity && (
                      <span className="mt-2 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                        {obs.severity}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.capa_plan && (
            <div className="mt-5">
              <div className="metric-label mb-3">CAPA plan</div>
              <pre className="overflow-auto rounded-[24px] border border-white/10 bg-slate-950/50 p-5 text-sm leading-7 text-slate-200 whitespace-pre-wrap">
                {typeof result.capa_plan === 'string'
                  ? result.capa_plan
                  : JSON.stringify(result.capa_plan, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
