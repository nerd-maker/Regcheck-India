'use client';

import React from 'react';

export interface ModelAttribution {
  primary_model?: string;
  validator_model?: string;
  ner_model?: string;
  provider?: string;
  sovereign?: boolean;
  transcription_model?: string;
  translation_model?: string;
}

function compactItems(attribution: ModelAttribution) {
  return [
    attribution.primary_model ? `Primary: ${attribution.primary_model}` : null,
    attribution.validator_model ? `Validator: ${attribution.validator_model}` : null,
    attribution.ner_model ? `NER: ${attribution.ner_model}` : null,
    attribution.translation_model ? `Translation: ${attribution.translation_model}` : null,
    attribution.transcription_model ? `ASR: ${attribution.transcription_model}` : null,
  ].filter(Boolean) as string[];
}

export default function ModelAttributionBadge({ attribution }: { attribution?: ModelAttribution | null }) {
  if (!attribution) return null;

  const items = compactItems(attribution);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
            style={{
              backgroundColor: attribution.sovereign ? 'rgba(91, 192, 190, 0.18)' : 'rgba(255, 143, 90, 0.18)',
              color: attribution.sovereign ? '#95efea' : '#ffc5ab',
            }}
          >
            {attribution.sovereign ? 'Self-hosted AI' : 'External AI'}
          </span>
          <div className="text-sm text-slate-300">
            {attribution.provider || 'Model attribution available'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className="status-chip">
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
