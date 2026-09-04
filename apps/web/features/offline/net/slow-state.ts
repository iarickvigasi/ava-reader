// Single source of truth for "does the connection look slow right now" —
// distinct from net-state's online/offline. Driven by the service worker's
// AVA_SLOW_CONNECTION broadcast (sw.js, spec 4.5-route-precaching §10): each
// message flips `slow` true and (re)starts a decay timer, so a burst of
// slow-fallback events reads as one steady state instead of flickering, and
// the badge clears itself a few seconds after the last one. See spec
// 4.10-slow-connection.

type Listener = (slow: boolean) => void;

// How long the "Slow" state persists after the most recent SW signal.
const DECAY_MS = 6_000;

type SlowState = {
  slow: boolean;
  listeners: Set<Listener>;
  attached: boolean;
  decayHandle: ReturnType<typeof setTimeout> | null;
  onMessage: ((event: MessageEvent) => void) | null;
};

const state: SlowState = {
  slow: false,
  listeners: new Set(),
  attached: false,
  decayHandle: null,
  onMessage: null,
};

function setSlow(next: boolean) {
  if (next === state.slow) {
    return;
  }
  state.slow = next;
  for (const listener of state.listeners) {
    listener(next);
  }
}

function reportSlowSignal() {
  setSlow(true);
  if (state.decayHandle !== null) {
    clearTimeout(state.decayHandle);
  }
  state.decayHandle = setTimeout(() => {
    state.decayHandle = null;
    setSlow(false);
  }, DECAY_MS);
}

function ensureAttached() {
  if (
    state.attached ||
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return;
  }
  state.onMessage = (event: MessageEvent) => {
    if (event.data && event.data.type === "AVA_SLOW_CONNECTION") {
      reportSlowSignal();
    }
  };
  navigator.serviceWorker.addEventListener("message", state.onMessage);
  state.attached = true;
}

export function isSlow(): boolean {
  ensureAttached();
  return state.slow;
}

export function subscribeToSlowState(listener: Listener): () => void {
  ensureAttached();
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}

// Test-only: simulate the SW broadcast without a real service worker.
export function __reportSlowSignalForTests() {
  reportSlowSignal();
}

// Test-only: detach listeners, clear timers, reset to the idle state.
export function __resetSlowStateForTests() {
  if (
    state.attached &&
    state.onMessage &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator
  ) {
    navigator.serviceWorker.removeEventListener("message", state.onMessage);
  }
  if (state.decayHandle !== null) {
    clearTimeout(state.decayHandle);
  }
  state.attached = false;
  state.slow = false;
  state.decayHandle = null;
  state.onMessage = null;
  state.listeners.clear();
}
