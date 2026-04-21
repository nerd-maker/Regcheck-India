'use client';

import React, { useState } from 'react';
import ModelAttributionBadge from './ModelAttributionBadge';
import { runCaseClassifier } from '@/services/api';

const severityAccent: Record<string, string> = {
  DEATH: '#ff8aa1',
  LIFE_THREATENING: '#ffb26b',
  HOSPITALISATION: '#ffd166',
  DISABILITY: '#9ad1ff',
  CONGENITAL_ANOMALY: '#79e1d6',
  OTHER: '#d8e5f3',
};

export default function SAEClassifier() {
  const [text, setText] = useState('');
  const [classification, setClassification] = useState<any>(null);
  const [duplicate, setDuplicate] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const classificationResponse = await runCaseClassifier(text);
      setClassification(classificationResponse.result);
    } finally {
      setLoading(false);
    }
  };

  const category = classification?.primary_category || 'OTHER';
  const accent = severityAccent[category] || severityAccent.OTHER;

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="section-kicker">Safety triage</div>
            <h3 className="mt-3 text-2xl font-semibold">SAE classifier and duplicate review</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Classify seriousness, surface duplicate risk, and generate a clearer queueing signal for reviewers.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="status-chip">WHO-UMC</span>
            <span className="status-chip">Duplicate signals</span>
            <span className="status-chip">Priority scoring</span>
          </div>
        </div>

        <textarea
          className="textarea-shell"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the SAE narrative, onset details, suspect product, outcome, and reporter summary."
        />

        <div className="mt-5 flex justify-end">
          <button type="button" className="primary-button" onClick={run} disabled={loading || !text.trim()}>
            {loading ? 'Classifying...' : 'Classify SAE'}
          </button>
        </div>
      </div>

      {(classification || duplicate) && (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            {classification && (
              <div className="glass-panel p-6">
                <ModelAttributionBadge attribution={classification?.model_attribution} />
                <div className="mt-5 rounded-[28px] border p-5" style={{ borderColor: `${accent}55`, backgroundColor: `${accent}14` }}>
                  <div className="metric-label">Primary severity</div>
                  <div className="mt-3 text-3xl font-semibold" style={{ color: accent }}>
                    {category}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="status-chip">Priority {classification.priority_score ?? 'NA'}</span>
                    <span className="status-chip">{classification.reporting_timeline?.timeline || classification.reporting_timeline?.status || classification.reporting_timeline?.assessment || 'Timeline pending'}</span>
                    <span className="status-chip">{classification.causality?.assessment || classification.causality?.who_umc_category || 'Causality pending'}</span>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <div className="metric-label">Rationale</div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {classification.classification_rationale || 'No rationale returned.'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <div className="metric-label">Triggered seriousness criteria</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(classification.seriousness_criteria || {}).map(([key, value]) => (
                        <div key={key} className="flex gap-2 text-sm text-slate-300 w-full mb-1">
                          <span className="capitalize w-48">{key.replace(/_/g, ' ')}</span>
                          <span className={value ? 'text-error font-medium' : 'text-slate-500'}>{value ? 'Yes' : 'No'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {(classification.secondary_categories || classification.flags || classification.regulatory_actions_required) && (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <div className="metric-label">Tags & Actions</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Array.isArray(classification.secondary_categories) && classification.secondary_categories.map((cat: string) => (
                        <span key={cat} className="status-chip">{cat}</span>
                      ))}
                      {Array.isArray(classification.flags) && classification.flags.map((flag: string) => (
                        <span key={flag} className="status-chip text-error">{flag}</span>
                      ))}
                      {Array.isArray(classification.regulatory_actions_required) && classification.regulatory_actions_required.map((action: string) => (
                        <span key={action} className="status-chip text-amber-500">{action}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {duplicate && (
              <div className="glass-panel p-6">
                <div className="metric-label">Duplicate review</div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="metric-card">
                    <div className="metric-label">Recommendation</div>
                    <div className="metric-value text-xl">{duplicate.recommendation || 'NA'}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Potential duplicates</div>
                    <div className="metric-value">{duplicate.duplicate_count ?? 0}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="glass-panel p-6">
            <div className="metric-label">Safety review payload</div>
            <pre className="mt-4 overflow-auto rounded-[24px] border border-white/10 bg-slate-950/50 p-5 text-sm leading-7 text-slate-200 whitespace-pre-wrap">
              {JSON.stringify({ classification, duplicate }, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
