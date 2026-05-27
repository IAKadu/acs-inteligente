const QUEUE_KEY = 'acs_pending_relatos';

export interface PendingRelato {
  localId: string;
  payload: Record<string, unknown>;
  criado_em: string;
}

function isClient() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function enqueue(payload: Record<string, unknown>): PendingRelato {
  const entry: PendingRelato = {
    localId: crypto.randomUUID(),
    payload,
    criado_em: new Date().toISOString(),
  };
  const queue = getQueue();
  queue.push(entry);
  if (isClient()) localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return entry;
}

export function getQueue(): PendingRelato[] {
  if (!isClient()) return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingRelato[]) : [];
  } catch {
    return [];
  }
}

export function remove(localId: string) {
  if (!isClient()) return;
  const queue = getQueue().filter(e => e.localId !== localId);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function pendingCount(): number {
  return getQueue().length;
}
