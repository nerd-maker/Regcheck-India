'use client';

import React, { useState } from 'react';
import ModelAttributionBadge from './ModelAttributionBadge';
import { api } from '@/services/api';

type Tab = 'sugam' | 'sae' | 'meeting';

export default function DocumentSummariser() {
  const [tab, setTab] = useState<Tab>('sugam');
  const [text, setText] = useState('');
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    const response =
      tab === 'sugam' ? await api.summariseSugamApplication(text, 'ct04') :
      tab === 'sae' ? await api.summariseSAECase(text) :
      await api.summariseMeeting(text);
    setResult(response);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setTab('sugam')} className="px-3 py-1 rounded bg-blue-100">SUGAM Application</button>
        <button onClick={() => setTab('sae')} className="px-3 py-1 rounded bg-purple-100">SAE Case</button>
        <button onClick={() => setTab('meeting')} className="px-3 py-1 rounded bg-green-100">Meeting</button>
      </div>
      <ModelAttributionBadge attribution={result?.model_attribution} />
      <textarea className="w-full border rounded p-2 h-36" value={text} onChange={(e) => setText(e.target.value)} />
      <button className="px-4 py-2 bg-indigo-600 text-white rounded" onClick={run}>Summarise</button>
      {result && <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
