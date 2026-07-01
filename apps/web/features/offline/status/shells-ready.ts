// Whether the service worker has confirmed the app's route shells are cached
// (see [[14-route-precaching]]). The route-precache runner writes it after the
// SW acks a complete pass; the header chip reads it via use-shells-ready to gate
// the "Ready for offline work" cue, so that cue never fires while a route (e.g.
// /app/library) would be a blank page offline. Plain JS — mirrors
// prime-progress.ts / net-state.ts — so the (non-React) SW-message handler in
// the runner can write it directly.

type Listener = () => void;

const state: {
  ready: boolean;
  listeners: Set<Listener>;
} = {
  ready: false,
  listeners: new Set(),
};

export function getShellsReady(): boolean {
  return state.ready;
}

// Set only when actually changed, so getSnapshot stays referentially stable for
// useSyncExternalStore and we don't notify on no-op writes.
export function setShellsReady(value: boolean): void {
  if (state.ready === value) {
    return;
  }
  state.ready = value;
  for (const listener of state.listeners) {
    listener();
  }
}

export function subscribeToShellsReady(listener: Listener): () => void {
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}

// Test-only: clear value + subscribers for a clean slate.
export function __resetShellsReadyForTests(): void {
  state.ready = false;
  state.listeners.clear();
}
