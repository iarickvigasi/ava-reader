// Single source of truth for "how far along is background priming right now"
// (see [[11-cache-priming]]). The primer runs client-side, so it writes here
// directly via setPrimeProgress — no service-worker messaging. The header chip
// reads it through use-prime-progress. Plain JS so the (non-React) primer can
// write it. Mirrors net-state.ts.

// The content tier reports per-book progress; the orchestrator emits `ready` on
// first completion. The metadata tier is NOT surfaced — it's a fast handful of
// small JSON fetches, and the "ready" beat already signals when offline browsing
// is prepared (see [[11-cache-priming]]). `ready` carries no counts.
export type PrimeProgress =
  | { phase: "content"; done: number; total: number }
  | { phase: "ready" };

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
  if (a === null || b === null || a.phase !== b.phase) {
    return false;
  }
  if (a.phase === "ready" || b.phase === "ready") {
    return true; // same phase, and ready carries no counts
  }
  return a.done === b.done && a.total === b.total;
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
