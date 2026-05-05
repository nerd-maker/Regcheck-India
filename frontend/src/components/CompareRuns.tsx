'use client';

import { useState } from 'react';
import { getLastTwoResults, HistoryEntry } from '@/services/history';

interface CompareRunsProps {
  moduleId: string;
  moduleName: string;
}

export default function CompareRuns({ moduleId, moduleName }: CompareRunsProps) {
  const [showing, setShowing] = useState(false);

  const [current, previous] = getLastTwoResults(moduleId);

  if (!current || !previous) return null;

  const currentStr = JSON.stringify(current.result, null, 2);
  const previousStr = JSON.stringify(previous.result, null, 2);

  // Simple line-by-line diff
  const diffLines = () => {
    const currentLines = currentStr.split('\n');
    const previousLines = previousStr.split('\n');
    const maxLen = Math.max(currentLines.length, previousLines.length);
    const diff = [];

    for (let i = 0; i < maxLen; i++) {
      const curr = currentLines[i] || '';
      const prev = previousLines[i] || '';
      if (curr !== prev) {
        diff.push({ line: i + 1, current: curr, previous: prev });
      }
    }
    return diff;
  };

  const differences = diffLines();

  return (
    <>
      <button
        onClick={() => setShowing(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition-colors"
        title="Compare with previous run"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        Compare ({differences.length} changes)
      </button>

      {showing && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <h3 className="font-semibold text-white">{moduleName} — Run Comparison</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {differences.length} differences found between last 2 runs
                </p>
              </div>
              <button
                onClick={() => setShowing(false)}
                className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Run metadata */}
            <div className="grid grid-cols-2 gap-4 px-6 py-3 bg-white/5 border-b border-white/10">
              <div>
                <div className="text-xs font-semibold text-green-400 mb-1">Current Run</div>
                <div className="text-xs text-slate-400">
                  {new Date(current.timestamp).toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  {current.inputSnippet}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-amber-400 mb-1">Previous Run</div>
                <div className="text-xs text-slate-400">
                  {new Date(previous.timestamp).toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  {previous.inputSnippet}
                </div>
              </div>
            </div>

            {/* Diff content */}
            <div className="flex-1 overflow-y-auto p-6">
              {differences.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-green-400 font-semibold mb-2">Identical Results</div>
                  <div className="text-sm text-slate-400">No differences found between the two runs</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {differences.slice(0, 50).map((diff, i) => (
                    <div key={i} className="rounded-xl overflow-hidden border border-white/10">
                      <div className="px-3 py-1.5 bg-white/5 text-xs text-slate-500">
                        Line {diff.line}
                      </div>
                      <div className="grid grid-cols-2">
                        <div className="px-3 py-2 bg-green-500/5 border-r border-white/10">
                          <div className="text-xs text-green-400 font-medium mb-1">Current</div>
                          <div className="text-xs text-slate-300 font-mono whitespace-pre-wrap">
                            {diff.current || <span className="text-slate-600 italic">empty</span>}
                          </div>
                        </div>
                        <div className="px-3 py-2 bg-amber-500/5">
                          <div className="text-xs text-amber-400 font-medium mb-1">Previous</div>
                          <div className="text-xs text-slate-300 font-mono whitespace-pre-wrap">
                            {diff.previous || <span className="text-slate-600 italic">empty</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {differences.length > 50 && (
                    <div className="text-center text-xs text-slate-500 py-2">
                      Showing 50 of {differences.length} differences
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
