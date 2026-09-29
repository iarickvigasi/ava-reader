import { probeReachability } from "./probe-reachability";

type Listener = (online: boolean) => void;
const listeners = new Set<Listener>();
let online = true;
let override: boolean | null = null;
let attached = false;
let active: { controller: AbortController; promise: Promise<void> } | null =
  null;
const PROBE_TIMEOUT_MS = 5_000;

function transition(next: boolean) {
  const effective = override ?? next;
  if (effective === online) return;
  online = effective;
  for (const listener of listeners) listener(online);
}

function onOffline() {
  active?.controller.abort();
  active = null;
  transition(false);
}

function onOnline() {
  void checkNetworkReachability();
}

function ensureAttached() {
  if (attached || typeof window === "undefined") return;
  online = override ?? navigator.onLine;
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  attached = true;
}

export function isOnline(): boolean {
  ensureAttached();
  return online;
}

export function subscribeToNetworkState(listener: Listener): () => void {
  ensureAttached();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Single-flight verification, independent of auth and bucket persistence.
export function checkNetworkReachability(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  ensureAttached();
  if (!navigator.onLine) {
    onOffline();
    return Promise.resolve();
  }
  if (override !== null) return Promise.resolve();
  if (active) return active.promise;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const promise = probeReachability(controller.signal)
    .then((reachable) => {
      if (active?.controller === controller && reachable !== null)
        transition(reachable);
    })
    .catch(() => {
      if (active?.controller === controller) transition(false);
    })
    .finally(() => {
      clearTimeout(timeout);
      if (active?.controller === controller) active = null;
    });
  active = { controller, promise };
  return promise;
}

export function __setNetStateForTests(value: boolean | null) {
  override = value;
  transition(value ?? (typeof navigator === "undefined" || navigator.onLine));
}

export function __resetNetStateForTests() {
  active?.controller.abort();
  active = null;
  if (attached && typeof window !== "undefined") {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  }
  attached = false;
  online = true;
  override = null;
  listeners.clear();
}
