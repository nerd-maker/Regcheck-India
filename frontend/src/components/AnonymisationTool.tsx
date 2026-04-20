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
                <div className="metric-value">
                  {Array.isArray(result.entities_detected) ? result.entities_detected.length : (result.entities_detected ?? 0)}
                </div>
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

            <div className="mt-5 space-y-6">
              <div>
                <div className="metric-label">Framework coverage</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(result.compliance_frameworks || []).map((framework: any, idx: number) => (
                    <span key={`fw-${idx}`} className="status-chip">
                      {String(framework ?? '')}
                    </span>
                  ))}
                </div>
              </div>

              {Array.isArray(result.entities_detected) && result.entities_detected.length > 0 && (
                <div>
                  <div className="metric-label">Detected Entities</div>
                  <div className="mt-3 space-y-2">
                    {result.entities_detected.map((entity: any, index: number) => (
                      <div key={`entity-${index}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                        <div className="font-semibold text-slate-100">
                          {String(entity.entity_type)}
                        </div>
                        <div className="mt-1 text-slate-400">
                          Value: {String(entity.value)}
                        </div>
                        <div className="mt-1 flex gap-2 text-xs text-slate-500">
                          <span className="rounded bg-teal-400/10 px-2 py-0.5 text-teal-400">{String(entity.category)}</span>
                          <span className="rounded bg-slate-800 px-2 py-0.5">{String(entity.position)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.audit_log && (
                <div>
                  <div className="metric-label">Audit Log</div>
                  <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                    <div className="flex justify-between border-b border-white/10 pb-2">
                      <span className="text-slate-500">Timestamp</span>
                      <span className="text-slate-200">{String(result.audit_log.timestamp ?? '')}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/10 pb-2">
                      <span className="text-slate-500">Mode</span>
                      <span className="text-slate-200">{String(result.audit_log.mode ?? '')}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/10 pb-2">
                      <span className="text-slate-500">Entities Processed</span>
                      <span className="text-slate-200">{String(result.audit_log.entities_processed ?? 0)}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/10 pb-2">
                      <span className="text-slate-500">Method</span>
                      <span className="text-slate-200">{String(result.audit_log.anonymisation_method ?? '')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status</span>
                      <span className="text-teal-400">{String(result.audit_log.status ?? '')}</span>
                    </div>
                  </div>
                </div>
              )}

              {result.anonymisation_report && (
                <div>
                  <div className="metric-label">Anonymisation Report</div>
                  <div className="mt-3 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                    <p className="font-medium text-slate-200">{String(result.anonymisation_report.summary ?? '')}</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-slate-500">PII Removed</div>
                        <div className="font-semibold text-slate-200">{String(result.anonymisation_report.pii_removed ?? 0)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">PHI Removed</div>
                        <div className="font-semibold text-slate-200">{String(result.anonymisation_report.phi_removed ?? 0)}</div>
                      </div>
                    </div>
                    <div className="rounded border border-indigo-500/20 bg-indigo-500/10 p-3 text-indigo-300">
                      <strong>Clinical Integrity:</strong> {String(result.anonymisation_report.clinical_integrity ?? '')}
                    </div>
                    {result.anonymisation_report.notes && (
                      <div className="text-xs italic text-slate-400">
                        Note: {String(result.anonymisation_report.notes)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="glass-panel p-6">
            <div className="metric-label">Anonymised output</div>
            <pre className="mt-4 overflow-auto rounded-[24px] border border-white/10 bg-slate-950/50 p-5 text-sm leading-7 text-slate-200 whitespace-pre-wrap">
              {typeof result.anonymised_content === 'string'
                ? result.anonymised_content
                : result.anonymised_content != null
                  ? JSON.stringify(result.anonymised_content, null, 2)
                  : ''}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
