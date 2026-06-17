// Single source of truth for "are we online right now". Wraps
// navigator.onLine + the online/offline window events into a subscribable
// store. Components consume it through useNetworkState (see ./use-network-state).
//
// Why a custom store instead of just reading navigator.onLine inline?
// - We need a *subscribable* value (the offline chip in the header, the modal,
//   the sync runner, and various per-bucket flushes all need to react).
// - We need a test override. `navigator.onLine` is set by the browser; in
//   vitest we mock it but can also flip the override directly to exercise
//   transitions deterministically.
// - We want one place that emits a single "transition" event instead of
//   every subscriber double-checking on every fire.

type Listener = (online: boolean) => void;

type NetState = {
  online: boolean;
  // When set, takes precedence over navigator.onLine. Used by tests.
  override: boolean | null;
  listeners: Set<Listener>;
  // Listeners we registered on window so we can detach them in tests.
  attached: boolean;
  onOnline: (() => void) | null;
  onOffline: (() => void) | null;
};

const state: NetState = {
  online: true,
  override: null,
  listeners: new Set(),
  attached: false,
  onOnline: null,
  onOffline: null,
};

function readNavigatorOnline(): boolean {
  if (typeof navigator === "undefined") {
    // SSR: assume online. The first client render will correct this through
    // ensureAttached() before any UI depends on it.
    return true;
  }
  // navigator.onLine is unreliably true on some platforms when actually
  // offline; the better signal is the offline/online events, which is why
  // we also listen for those. We only read this for the initial value.
  return navigator.onLine;
}

function ensureAttached() {
  if (state.attached || typeof window === "undefined") {
    return;
  }
  state.online = state.override ?? readNavigatorOnline();
  state.onOnline = () => transition(true);
  state.onOffline = () => transition(false);
  window.addEventListener("online", state.onOnline);
  window.addEventListener("offline", state.onOffline);
  state.attached = true;
}

function transition(nextOnline: boolean) {
  // Override beats the real event — tests use this to pin the value.
  const effective = state.override ?? nextOnline;
  if (effective === state.online) {
    return;
  }
  state.online = effective;
  for (const listener of state.listeners) {
    listener(effective);
  }
}

export function isOnline(): boolean {
  ensureAttached();
  return state.online;
}

export function subscribeToNetworkState(listener: Listener): () => void {
  ensureAttached();
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}

// Test-only: pin the value, or pass null to release the override. After
// release the next online/offline event will resync from the browser.
export function __setNetStateForTests(override: boolean | null) {
  state.override = override;
  if (override === null) {
    transition(readNavigatorOnline());
  } else {
    transition(override);
  }
}

// Test-only: detach window listeners + clear subscribers so each test starts
// from a clean slate.
export function __resetNetStateForTests() {
  if (state.attached && typeof window !== "undefined") {
    if (state.onOnline) {
      window.removeEventListener("online", state.onOnline);
    }
    if (state.onOffline) {
      window.removeEventListener("offline", state.onOffline);
    }
  }
  state.attached = false;
  state.online = true;
  state.override = null;
  state.listeners.clear();
  state.onOnline = null;
  state.onOffline = null;
}
