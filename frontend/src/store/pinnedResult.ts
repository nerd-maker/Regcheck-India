// Simple global state for pinned result — no Redux needed
// Uses a custom event system for cross-component communication

export interface PinnedResult {
  moduleName: string;
  moduleId: string;
  result: unknown;
  pinnedAt: string;
  inputSnippet: string;
}

let _pinned: PinnedResult | null = null;
const listeners: Set<(pinned: PinnedResult | null) => void> = new Set();

export const pinnedResultStore = {
  get: () => _pinned,

  pin: (result: PinnedResult) => {
    _pinned = result;
    listeners.forEach((fn) => fn(_pinned));
    try {
      sessionStorage.setItem('pinned_result', JSON.stringify(result));
    } catch {
      // sessionStorage unavailable (e.g. private browsing with strict settings)
    }
  },

  unpin: () => {
    _pinned = null;
    listeners.forEach((fn) => fn(null));
    try {
      sessionStorage.removeItem('pinned_result');
    } catch {}
  },

  subscribe: (fn: (pinned: PinnedResult | null) => void) => {
    // Restore from sessionStorage on first subscribe
    if (!_pinned) {
      try {
        const stored = sessionStorage.getItem('pinned_result');
        if (stored) _pinned = JSON.parse(stored);
      } catch {}
    }
    listeners.add(fn);
    fn(_pinned);
    return () => listeners.delete(fn);
  },
};
