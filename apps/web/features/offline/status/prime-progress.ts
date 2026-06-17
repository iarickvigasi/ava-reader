// Single source of truth for "how far along is background book-content priming
// right now" (see [[11-cache-priming]]). The primer runs client-side, so it
// writes here directly via setPrimeProgress — no service-worker messaging. The
// header chip reads it through use-prime-progress. Plain JS so the (non-React)
// primer can write it. Mirrors net-state.ts.

export type PrimeProgress = { done: number; total: number };

type Listener = () => void;

const state: {
  progress: PrimeProgress | null;
  listeners: Set<Listener>;
} = {
  progress: null,
  listeners: new Set(),
};

function sameProgress(
  a: PrimeProgress | null,
  b: PrimeProgress | null,
): boolean {
  if (a === b) {
    return true;
  }
  return a !== null && b !== null && a.done === b.done && a.total === b.total;
}

export function getPrimeProgress(): PrimeProgress | null {
  return state.progress;
}

// Replace the snapshot only when the value actually changes, so getSnapshot
// stays referentially stable for useSyncExternalStore and we don't notify on
// no-op writes.
export function setPrimeProgress(value: PrimeProgress | null): void {
  if (sameProgress(value, state.progress)) {
    return;
  }
  state.progress = value;
  for (const listener of state.listeners) {
    listener();
  }
}

export function subscribeToPrimeProgress(listener: Listener): () => void {
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}

// Test-only: clear value + subscribers for a clean slate.
export function __resetPrimeProgressForTests(): void {
  state.progress = null;
  state.listeners.clear();
}
