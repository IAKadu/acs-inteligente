'use client';

import { useState, useEffect, useCallback } from 'react';
import { getQueue, remove, pendingCount } from '@/lib/offline-queue';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function useOfflineSync() {
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(true);

  const refresh = useCallback(() => {
    setPending(pendingCount());
  }, []);

  const flush = useCallback(async (): Promise<number> => {
    const queue = getQueue();
    if (!queue.length) return 0;
    setSyncing(true);
    let failed = 0;
    for (const entry of queue) {
      try {
        const res = await fetch(`${BASE_URL}/api/visitas/relato`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry.payload),
        });
        if (res.ok) remove(entry.localId);
        else failed++;
      } catch {
        failed++;
        break; // stop at first network failure
      }
    }
    setSyncing(false);
    setPending(pendingCount());
    return failed;
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    setPending(pendingCount());

    const goOnline = () => {
      setOnline(true);
      flush();
    };
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [flush]);

  return { pending, syncing, online, flush, refresh };
}
