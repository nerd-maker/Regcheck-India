import { useState, useEffect, useCallback } from 'react';

export type ServerStatus = 'checking' | 'online' | 'slow' | 'offline';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://regcheck-india.onrender.com';

let cachedStatus: ServerStatus = 'checking';
let lastChecked = 0;
const CHECK_INTERVAL = 60_000; // recheck every 60 seconds

export function useServerStatus() {
  const [status, setStatus] = useState<ServerStatus>(cachedStatus);

  const checkStatus = useCallback(async () => {
    const now = Date.now();
    if (now - lastChecked < CHECK_INTERVAL && cachedStatus !== 'checking') {
      setStatus(cachedStatus);
      return;
    }

    try {
      const start = Date.now();
      const res = await fetch(`${API_BASE_URL}/api/v1/agents/ping`, {
        signal: AbortSignal.timeout(8000),
      });
      const elapsed = Date.now() - start;

      if (res.ok) {
        const newStatus: ServerStatus = elapsed > 4000 ? 'slow' : 'online';
        cachedStatus = newStatus;
        lastChecked = now;
        setStatus(newStatus);
      } else {
        cachedStatus = 'offline';
        setStatus('offline');
      }
    } catch {
      cachedStatus = 'offline';
      setStatus('offline');
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return { status, recheck: checkStatus };
}
