// Cross-module data transfer store
// Allows sending output from one module as input to another

export interface TransferPayload {
  sourceModule: string;
  sourceModuleId: string;
  content: string;
  transferredAt: string;
}

let _pending: TransferPayload | null = null;
const listeners: Map<string, (payload: TransferPayload) => void> = new Map();

export const moduleTransferStore = {
  // Send content to a specific module
  send: (
    sourceModule: string,
    sourceModuleId: string,
    content: string,
    targetModuleId: string
  ) => {
    _pending = {
      sourceModule,
      sourceModuleId,
      content,
      transferredAt: new Date().toISOString()
    };
    // Store in sessionStorage so it survives module switching
    try {
      sessionStorage.setItem(
        `transfer_to_${targetModuleId}`,
        JSON.stringify(_pending)
      );
    } catch {}
    // Notify if target is already mounted
    const listener = listeners.get(targetModuleId);
    if (listener) listener(_pending);
  },

  // Called by target module on mount to check for pending transfer
  receive: (targetModuleId: string): TransferPayload | null => {
    try {
      const stored = sessionStorage.getItem(`transfer_to_${targetModuleId}`);
      if (stored) {
        sessionStorage.removeItem(`transfer_to_${targetModuleId}`);
        return JSON.parse(stored);
      }
    } catch {}
    return null;
  },

  // Subscribe to live transfers (for modules already mounted)
  subscribe: (moduleId: string, fn: (payload: TransferPayload) => void) => {
    listeners.set(moduleId, fn);
    return () => listeners.delete(moduleId);
  }
};
