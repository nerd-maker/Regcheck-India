'use client';

import React, { useState } from 'react';
import ModelAttributionBadge from './ModelAttributionBadge';
import { api } from '@/services/api';

export default function AnonymisationTool() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [mode, setMode] = useState<'pseudo' | 'full'>('full');

  const runAnonymise = async () => {
    const response = await api.anonymiseText(text, mode === 'full');
    setResult({ ...response, mode });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <h3 className="text-lg font-semibold">Anonymisation Tool</h3>
      <ModelAttributionBadge attribution={result?.model_attribution} />
      <div className="flex gap-4 text-sm">
        <label><input type="radio" checked={mode === 'pseudo'} onChange={() => setMode('pseudo')} /> Pseudonymise only</label>
        <label><input type="radio" checked={mode === 'full'} onChange={() => setMode('full')} /> Full anonymisation</label>
      </div>
      <textarea className="w-full border rounded p-2 h-36" value={text} onChange={(e) => setText(e.target.value)} />
      <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={runAnonymise}>Run</button>
      {result && <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
