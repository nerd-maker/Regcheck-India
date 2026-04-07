'use client';

import React, { useState } from 'react';
import ModelAttributionBadge from './ModelAttributionBadge';
import { api } from '@/services/api';

export default function SAEClassifier() {
  const [text, setText] = useState('');
  const [classification, setClassification] = useState<any>(null);
  const [duplicate, setDuplicate] = useState<any>(null);

  const run = async () => {
    const classificationResponse = await api.classifySAE(text);
    setClassification(classificationResponse);
    const duplicateResponse = await api.checkSAEDuplicate({
      event_description: text,
      case_id: `case_${Date.now()}`,
    });
    setDuplicate(duplicateResponse);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <h3 className="text-lg font-semibold">SAE Classifier</h3>
      <ModelAttributionBadge attribution={classification?.model_attribution || duplicate?.model_attribution} />
      <textarea className="w-full border rounded p-2 h-36" value={text} onChange={(e) => setText(e.target.value)} />
      <button className="px-4 py-2 bg-rose-600 text-white rounded" onClick={run}>Classify SAE</button>
      {classification && <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto">{JSON.stringify(classification, null, 2)}</pre>}
      {duplicate && <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto">{JSON.stringify(duplicate, null, 2)}</pre>}
    </div>
  );
}
