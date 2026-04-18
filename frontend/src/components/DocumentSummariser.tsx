'use client';

import React, { useState } from 'react';
import ModelAttributionBadge from './ModelAttributionBadge';
import { runDocumentSummariser } from '@/services/api';

type Tab = 'sugam' | 'sae' | 'meeting';

const tabMeta: Record<Tab, { title: string; note: string; accent: string }> = {
  sugam: {
    title: 'SUGAM application',
    note: 'Map submission content to checklist sections and surface completeness gaps.',
    accent: '#5bc0be',
  },
  sae: {
    title: 'SAE case narration',
    note: 'Condense adverse event narratives into a reviewer-first schema.',
    accent: '#ff8f5a',
  },
  meeting: {
    title: 'Meeting transcript',
    note: 'Extract decisions, actions, and regulatory references from long transcripts.',
    accent: '#ffd166',
  },
};

export default function DocumentSummariser() {
  const [tab, setTab] = useState<Tab>('sugam');
  const [text, setText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const response = await runDocumentSummariser(text, {
        document_type: tab === 'sugam' ? 'sugam_application' : tab === 'sae' ? 'sae_case' : 'meeting_transcript',
        checklist_type: tab === 'sugam' ? 'ct04' : undefined,
      });
      setResult(response.result);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="mb-5">
          <div className="section-kicker">Structured synthesis</div>
          <h3 className="mt-3 text-2xl font-semibold">Document summarisation engine</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Move from long-form narratives to concise reviewer packets with deterministic output shapes.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {(Object.keys(tabMeta) as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="rounded-[24px] border p-4 text-left transition-all"
              style={{
                borderColor: tab === key ? `${tabMeta[key].accent}55` : 'rgba(255,255,255,0.1)',
                backgroundColor: tab === key ? `${tabMeta[key].accent}18` : 'rgba(255,255,255,0.04)',
              }}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: tabMeta[key].accent }}>
                {key}
              </div>
              <div className="mt-2 text-lg font-semibold text-white">{tabMeta[key].title}</div>
              <div className="mt-2 text-sm leading-6 text-slate-400">{tabMeta[key].note}</div>
            </button>
          ))}
        </div>

        <textarea
          className="textarea-shell mt-5"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste filing text, SAE details, or meeting notes here."
        />

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-400">{tabMeta[tab].note}</div>
          <button type="button" className="primary-button" onClick={run} disabled={loading || !text.trim()}>
            {loading ? 'Summarising...' : 'Generate summary'}
          </button>
        </div>
      </div>

      {result && (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="glass-panel p-6">
            <ModelAttributionBadge attribution={result?.model_attribution} />
            <div className="mt-5">
              <div className="metric-label">Summary fields</div>
              <div className="mt-4 grid gap-3">
                {Object.entries(result)
                  .filter(([key]) => key !== 'model_attribution')
                  .slice(0, 6)
                  .map(([key, value]) => (
                    <div key={key} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{key}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-200">
                        {typeof value === 'string' ? value : JSON.stringify(value)}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="glass-panel p-6">
            <div className="metric-label">Structured payload</div>
            <pre className="mt-4 overflow-auto rounded-[24px] border border-white/10 bg-slate-950/50 p-5 text-sm leading-7 text-slate-200 whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
