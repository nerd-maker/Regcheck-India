'use client';

import { useState } from 'react';
import PrintableReport from '@/components/PrintableReport';
import { pinnedResultStore } from '@/store/pinnedResult';
import SendToModule from '@/components/SendToModule';
import CompareRuns from '@/components/CompareRuns';

interface OutputActionsProps {
  result: unknown;
  moduleName: string;
  moduleId: string;
  textContent: string;       // plain text version for copy / print
  inputSnippet: string;      // first ~150 chars of input for pin preview
  pipeableContent?: string;  // the specific content to pipe (e.g. anonymised text)
  pipeableLabel?: string;    // e.g. "anonymised text"
}

export default function OutputActions({
  result,
  moduleName,
  moduleId,
  textContent,
  inputSnippet,
  pipeableContent,
  pipeableLabel,
}: OutputActionsProps) {
  const [copied, setCopied] = useState(false);
  const [pinned, setPinned] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textContent);
    } catch {
      const el = document.createElement('textarea');
      el.value = textContent;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${moduleName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportText = () => {
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${moduleName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePin = () => {
    pinnedResultStore.pin({
      moduleName,
      moduleId,
      result,
      pinnedAt: new Date().toISOString(),
      inputSnippet,
    });
    setPinned(true);
    setTimeout(() => setPinned(false), 2000);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pt-4 mt-4 border-t border-white/10">
      <span className="text-xs text-slate-500 mr-1">Workflow:</span>

      {/* Pin Result */}
      <button
        onClick={handlePin}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
          pinned
            ? 'bg-teal-500/30 text-teal-300'
            : 'bg-teal-500/10 hover:bg-teal-500/20 text-teal-400'
        }`}
        title="Pin this result — keep it visible while switching modules"
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
        </svg>
        {pinned ? 'Pinned!' : 'Pin'}
      </button>

      {/* Send to Module */}
      {pipeableContent && (
        <SendToModule
          content={pipeableContent}
          sourceModule={moduleName}
          sourceModuleId={moduleId}
          contentLabel={pipeableLabel || 'output'}
        />
      )}

      {/* Compare Runs */}
      <CompareRuns moduleId={moduleId} moduleName={moduleName} />

      <div className="w-full h-px md:hidden" />
      <span className="text-xs text-slate-500 mr-1 md:ml-2">Export:</span>

      {/* Copy Text */}
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition-colors"
      >
        {copied ? (
          <>
            <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-400">Copied!</span>
          </>
        ) : (
          <>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy
          </>
        )}
      </button>

      {/* Export TXT */}
      <button
        onClick={handleExportText}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition-colors"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        TXT
      </button>

      {/* Export JSON */}
      <button
        onClick={handleExportJSON}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition-colors"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        JSON
      </button>

      {/* Print / PDF */}
      <PrintableReport
        moduleName={moduleName}
        result={result}
        textContent={textContent}
        timestamp={new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}
      />
    </div>
  );
}
