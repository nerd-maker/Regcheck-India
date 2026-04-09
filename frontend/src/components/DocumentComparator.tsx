'use client';

import React, { useState } from 'react';
import ModelAttributionBadge from './ModelAttributionBadge';
import { api } from '@/services/api';

export default function DocumentComparator() {
  const [v1, setV1] = useState('');
  const [v2, setV2] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const compare = async () => {
    setLoading(true);
    try {
      const response = await api.compareVersions(v1, v2, 'general');
      setResult(response);
    } finally {
      setLoading(false);
    }
  };

  const summary = result?.summary || {};

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="section-kicker">Version intelligence</div>
            <h3 className="mt-3 text-2xl font-semibold">Document comparator</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Compare two filing versions side by side and separate formatting churn from substantive regulatory change.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="status-chip">Structural diff</span>
            <span className="status-chip">Impact summary</span>
            <span className="status-chip">Session-scoped</span>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div>
            <div className="metric-label mb-3">Version 1</div>
            <textarea
              className="textarea-shell"
              value={v1}
              onChange={(e) => setV1(e.target.value)}
              placeholder="Paste baseline submission text."
            />
          </div>
          <div>
            <div className="metric-label mb-3">Version 2</div>
            <textarea
              className="textarea-shell"
              value={v2}
              onChange={(e) => setV2(e.target.value)}
              placeholder="Paste amended submission text."
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button type="button" className="primary-button" onClick={compare} disabled={loading || !v1.trim() || !v2.trim()}>
            {loading ? 'Comparing...' : 'Compare versions'}
          </button>
        </div>
      </div>

      {result && (
        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-6">
            <div className="glass-panel p-6">
              <ModelAttributionBadge attribution={result?.model_attribution} />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="metric-card">
                  <div className="metric-label">Total changes</div>
                  <div className="metric-value">{summary.total_changes ?? 0}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Substantive</div>
                  <div className="metric-value">{summary.substantive_changes ?? 0}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Formatting only</div>
                  <div className="metric-value">{summary.formatting_only_changes ?? 0}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Risk level</div>
                  <div className="metric-value text-xl">{summary.risk_level ?? 'NA'}</div>
                </div>
              </div>
            </div>

            <div className="glass-panel p-6">
              <div className="metric-label">Substantive changes</div>
              <div className="mt-4 space-y-3">
                {(result.substantive_changes || []).length === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400">
                    No substantive changes were surfaced for this comparison.
                  </div>
                )}
                {(result.substantive_changes || []).map((change: any, index: number) => (
                  <div key={`${change.section || 'change'}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="status-chip">{change.section || 'Unmapped section'}</span>
                      <span className="status-chip">{change.change_type || 'Modification'}</span>
                      <span className="status-chip">{change.regulatory_significance || 'Unrated'}</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {change.v2_text || change.v1_text || 'Change text unavailable.'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-panel p-6">
            <div className="metric-label">Comparison payload</div>
            <pre className="mt-4 overflow-auto rounded-[24px] border border-white/10 bg-slate-950/50 p-5 text-sm leading-7 text-slate-200 whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
