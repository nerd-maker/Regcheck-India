'use client';

import React, { useState } from 'react';
import ModelAttributionBadge from './ModelAttributionBadge';
import { api } from '@/services/api';

export default function CompletenessAssessor() {
  const [text, setText] = useState('');
  const [docType, setDocType] = useState('clinical_protocol');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runAssessment = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.assessCompleteness(text, {
        document_type: docType,
      });
      setResult(response);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Assessment failed');
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    const style =
      status === 'COMPLETE'
        ? 'bg-emerald-400/20 text-emerald-300'
        : status === 'INCOMPLETE'
        ? 'bg-rose-400/20 text-rose-300'
        : 'bg-amber-400/20 text-amber-300';
    return <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${style}`}>{status}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="section-kicker">Completeness lane</div>
            <h3 className="mt-3 text-2xl font-semibold">Submission completeness assessment</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Evaluate whether a pharmaceutical submission is complete against CDSCO, Schedule Y,
              NDCTR 2019, and ICH requirements. Surfaces missing sections, data gaps, and submission
              readiness.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="status-chip">CDSCO</span>
            <span className="status-chip">Schedule Y</span>
            <span className="status-chip">NDCTR 2019</span>
          </div>
        </div>

        <div className="mb-5">
          <label className="metric-label mb-2 block">Document type</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="w-full max-w-xs rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 focus:border-teal-400/50 focus:outline-none"
          >
            <option value="clinical_protocol">Clinical Protocol</option>
            <option value="icf">Informed Consent Form</option>
            <option value="csr">Clinical Study Report</option>
            <option value="ib">Investigator Brochure</option>
            <option value="ctri">CTRI Registration</option>
            <option value="sugam_application">SUGAM Application</option>
          </select>
        </div>

        <textarea
          className="textarea-shell"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the full submission document text here for completeness evaluation."
        />

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-400">
            The agent will return section-level completeness, data gaps, and overall readiness.
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={runAssessment}
            disabled={loading || !text.trim()}
          >
            {loading ? 'Assessing...' : 'Run completeness check'}
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

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="metric-card">
              <div className="metric-label">Overall status</div>
              <div className="mt-2">{statusBadge(result.overall_status ?? 'N/A')}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Completeness score</div>
              <div className="metric-value">{result.completeness_score ?? '—'}%</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Sections present</div>
              <div className="metric-value">
                {Array.isArray(result.sections_present) ? result.sections_present.length : 0}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Sections missing</div>
              <div className="metric-value text-rose-300">
                {Array.isArray(result.sections_missing) ? result.sections_missing.length : 0}
              </div>
            </div>
          </div>

          {Array.isArray(result.sections_missing) && result.sections_missing.length > 0 && (
            <div className="mt-5">
              <div className="metric-label mb-3">Missing sections</div>
              <div className="flex flex-wrap gap-2">
                {result.sections_missing.map((s: string, i: number) => (
                  <span key={i} className="rounded-full bg-rose-400/15 px-3 py-1 text-xs font-semibold text-rose-300">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(result.data_gaps) && result.data_gaps.length > 0 && (
            <div className="mt-5">
              <div className="metric-label mb-3">Data gaps</div>
              <div className="space-y-2">
                {result.data_gaps.map((gap: any, i: number) => (
                  <div key={i} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                    {typeof gap === 'string' ? gap : JSON.stringify(gap)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.submission_readiness && (
            <div className="mt-5">
              <div className="metric-label mb-3">Submission readiness</div>
              <pre className="overflow-auto rounded-[24px] border border-white/10 bg-slate-950/50 p-5 text-sm leading-7 text-slate-200 whitespace-pre-wrap">
                {typeof result.submission_readiness === 'string'
                  ? result.submission_readiness
                  : JSON.stringify(result.submission_readiness, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
