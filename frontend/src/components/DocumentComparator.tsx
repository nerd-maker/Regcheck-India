'use client';

import React, { useState } from 'react';
import ModelAttributionBadge from './ModelAttributionBadge';
import { api } from '@/services/api';

export default function DocumentComparator() {
  const [v1, setV1] = useState('');
  const [v2, setV2] = useState('');
  const [result, setResult] = useState<any>(null);

  const compare = async () => {
    const response = await api.compareVersions(v1, v2, 'general');
    setResult(response);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <h3 className="text-lg font-semibold">Document Comparator</h3>
      <ModelAttributionBadge attribution={result?.model_attribution} />
      <div className="grid grid-cols-2 gap-3">
        <textarea className="border rounded p-2 h-36" value={v1} onChange={(e) => setV1(e.target.value)} placeholder="Version 1" />
        <textarea className="border rounded p-2 h-36" value={v2} onChange={(e) => setV2(e.target.value)} placeholder="Version 2" />
      </div>
      <button className="px-4 py-2 bg-amber-600 text-white rounded" onClick={compare}>Compare</button>
      {result && <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto">{JSON.stringify(result.summary, null, 2)}</pre>}
    </div>
  );
}
