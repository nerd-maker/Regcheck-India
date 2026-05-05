'use client';

import { useState, useEffect } from 'react';
import { pinnedResultStore, PinnedResult } from '@/store/pinnedResult';

export default function PinnedResultPanel() {
  const [pinned, setPinned] = useState<PinnedResult | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const unsub = pinnedResultStore.subscribe(setPinned);
    return () => { unsub(); };
  }, []);

  if (!pinned) return null;

  const resultPreview =
    typeof pinned.result === 'object'
      ? JSON.stringify(pinned.result, null, 2).substring(0, 800) + '...'
      : String(pinned.result);

  return (
    <div className="fixed bottom-4 right-4 w-80 z-50 shadow-2xl">
      <div className="bg-gray-900 border border-teal-500/30 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-teal-600/20 border-b border-teal-500/20">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-teal-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
            </svg>
            <span className="text-xs font-semibold text-teal-400 truncate max-w-[160px]">
              Pinned: {pinned.moduleName}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              <svg
                className={`w-3.5 h-3.5 transition-transform ${collapsed ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              onClick={pinnedResultStore.unpin}
              className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-red-400 transition-colors"
              title="Unpin"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        {!collapsed && (
          <div className="p-4">
            <p className="text-xs text-slate-500 mb-2">
              {new Date(pinned.pinnedAt).toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-slate-400 italic mb-3 line-clamp-2">
              Input: &quot;{pinned.inputSnippet}&quot;
            </p>
            <div className="max-h-48 overflow-y-auto text-xs text-slate-300 bg-white/5 rounded-xl p-3 leading-relaxed font-mono">
              {resultPreview}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Switch modules — this result stays visible
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
