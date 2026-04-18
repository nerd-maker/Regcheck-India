'use client';

import React, { useState } from 'react';
import ModelAttributionBadge from './ModelAttributionBadge';
import { runPIIAnonymiser } from '@/services/api';

export default function AnonymisationTool() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [mode, setMode] = useState<'pseudo' | 'full'>('full');
  const [loading, setLoading] = useState(false);

  const runAnonymise = async () => {
    setLoading(true);
    try {
      const response = await runPIIAnonymiser(text, { mode: mode === 'full' ? 'full' : 'pseudo', full_anonymisation: mode === 'full' });
      setResult({ ...response.result, mode });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="section-kicker">Privacy lane</div>
            <h3 className="mt-3 text-2xl font-semibold">PII and PHI anonymisation</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Run reversible pseudonymisation or full anonymisation with compliance reporting and
              legal basis tracking.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="status-chip">DPDP</span>
            <span className="status-chip">NDHM</span>
            <span className="status-chip">Audit-ready</span>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setMode('pseudo')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              mode === 'pseudo' ? 'bg-white text-slate-900' : 'bg-white/5 text-slate-300'
            }`}
          >
            Pseudonymise only
          </button>
          <button
            type="button"
            onClick={() => setMode('full')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              mode === 'full' ? 'bg-teal-300 text-slate-950' : 'bg-white/5 text-slate-300'
            }`}
          >
            Full anonymisation
          </button>
        </div>

        <textarea
          className="textarea-shell"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste patient narratives, site details, or investigator notes here."
        />

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-400">
            Structured reports will show entity counts, legal frameworks, and audit log summaries.
          </p>
          <button type="button" className="primary-button" onClick={runAnonymise} disabled={loading || !text.trim()}>
            {loading ? 'Processing...' : 'Run anonymisation'}
          </button>
        </div>
      </div>

      {result && (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="glass-panel p-6">
            <ModelAttributionBadge attribution={result?.model_attribution} />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="metric-card">
                <div className="metric-label">Detected entities</div>
                <div className="metric-value">{result.entities_detected ?? 0}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Anonymised entities</div>
                <div className="metric-value">{result.entities_anonymised ?? 0}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Mode</div>
                <div className="metric-value text-xl">
                  {result.mode === 'full' ? 'Irreversible' : 'Pseudonymised'}
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Frameworks</div>
                <div className="metric-value text-xl">
                  {Array.isArray(result.compliance_frameworks) ? result.compliance_frameworks.length : 0}
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <div className="metric-label">Framework coverage</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(result.compliance_frameworks || []).map((framework: string) => (
                    <span key={framework} className="status-chip">
                      {framework}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="metric-label">Audit log entries</div>
                <div className="mt-3 space-y-2">
                  {(result.audit_log || []).slice(0, 4).map((entry: any, index: number) => (
                    <div key={`${entry.timestamp}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                      <div className="font-semibold text-slate-100">{entry.entity_type}</div>
                      <div className="mt-1 text-slate-400">
                        {entry.action} under {entry.legal_basis}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel p-6">
            <div className="metric-label">Anonymised output</div>
            <pre className="mt-4 overflow-auto rounded-[24px] border border-white/10 bg-slate-950/50 p-5 text-sm leading-7 text-slate-200 whitespace-pre-wrap">
              {result.anonymised_content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
