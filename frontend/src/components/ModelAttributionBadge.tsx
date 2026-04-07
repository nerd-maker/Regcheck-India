'use client';

import React from 'react';

export interface ModelAttribution {
  primary_model?: string;
  validator_model?: string;
  ner_model?: string;
  provider?: string;
  sovereign?: boolean;
}

export default function ModelAttributionBadge({ attribution }: { attribution?: ModelAttribution | null }) {
  if (!attribution) return null;
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
      <span>{attribution.sovereign ? 'Sovereign AI' : 'AI Model'}</span>
      {attribution.primary_model && <span className="font-semibold">• {attribution.primary_model}</span>}
    </div>
  );
}

