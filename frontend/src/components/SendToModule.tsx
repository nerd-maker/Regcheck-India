'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { moduleTransferStore } from '@/store/moduleTransfer';

interface SendToModuleProps {
  content: string;
  sourceModule: string;
  sourceModuleId: string;
  contentLabel?: string; // e.g. "anonymised text", "extracted text"
}

// Define which modules can receive piped input
const PIPE_TARGETS = [
  { id: 'm1-anonymiser', label: 'M1 PII Anonymiser', path: '/app' },
  { id: 'm2-summariser', label: 'M2 Document Summariser', path: '/app' },
  { id: 'm3-completeness', label: 'M3 Completeness Assessor', path: '/app' },
  { id: 'm4-classifier', label: 'M4 Case Classifier', path: '/app' },
  { id: 'm5-inspection', label: 'M5 Inspection Report', path: '/app' },
  { id: 'm7-scheduley', label: 'M7 Schedule Y Compliance', path: '/app' },
  { id: 'm8-ichgcp', label: 'M8 ICH E6(R3) GCP', path: '/app' },
];

export default function SendToModule({
  content,
  sourceModule,
  sourceModuleId,
  contentLabel = "output"
}: SendToModuleProps) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const router = useRouter();

  // Filter out the source module from targets
  const targets = PIPE_TARGETS.filter(t => t.id !== sourceModuleId);

  const handleSend = (target: typeof PIPE_TARGETS[0]) => {
    moduleTransferStore.send(
      sourceModule,
      sourceModuleId,
      content,
      target.id
    );
    setSent(target.label);
    setOpen(false);

    // Navigate to the app — user needs to click the target module
    setTimeout(() => setSent(null), 3000);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-xs text-purple-400 transition-colors"
        title="Send this output as input to another module"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        Send to Module
      </button>

      {open && (
        <div className="absolute bottom-8 left-0 w-64 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl z-50 p-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
            Send {contentLabel} to:
          </div>
          <div className="space-y-1">
            {targets.map((target) => (
              <button
                key={target.id}
                onClick={() => handleSend(target)}
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 text-sm text-slate-300 hover:text-white transition-colors flex items-center justify-between group"
              >
                <span>{target.label}</span>
                <svg className="w-3 h-3 text-slate-500 group-hover:text-purple-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-full mt-2 text-xs text-slate-500 hover:text-slate-400 py-1"
          >
            Cancel
          </button>
        </div>
      )}

      {sent && (
        <div className="absolute bottom-8 left-0 w-64 bg-gray-900 border border-purple-500/30 rounded-2xl shadow-2xl z-50 p-4">
          <div className="flex items-center gap-2 text-purple-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium">Sent to {sent}</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Click {sent} in the sidebar — your content is ready to use
          </p>
        </div>
      )}
    </div>
  );
}
