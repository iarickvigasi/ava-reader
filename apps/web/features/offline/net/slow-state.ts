// Slow combines persistent probe degradation and a six-second SW signal tail.
type Listener = (slow: boolean) => void;

const DECAY_MS = 6_000;

type SlowState = {
  slow: boolean;
  probeDegraded: boolean;
  listeners: Set<Listener>;
  attached: boolean;
  decayHandle: ReturnType<typeof setTimeout> | null;
  onMessage: ((event: MessageEvent) => void) | null;
};

const state: SlowState = {
  slow: false,
  probeDegraded: false,
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

export function setProbeDegraded(degraded: boolean) {
  state.probeDegraded = degraded;
  setSlow(degraded || state.decayHandle !== null);
}

function reportSlowSignal() {
  setSlow(true);
  if (state.decayHandle !== null) clearTimeout(state.decayHandle);
  state.decayHandle = setTimeout(() => {
    state.decayHandle = null;
    setSlow(state.probeDegraded);
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

export function __reportSlowSignalForTests() {
  reportSlowSignal();
}

export function __resetSlowStateForTests() {
  if (
    state.attached &&
    state.onMessage &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator
  ) {
    navigator.serviceWorker.removeEventListener("message", state.onMessage);
  }
  if (state.decayHandle !== null) clearTimeout(state.decayHandle);
  state.attached = false;
  state.slow = false;
  state.probeDegraded = false;
  state.decayHandle = null;
  state.onMessage = null;
  state.listeners.clear();
}
