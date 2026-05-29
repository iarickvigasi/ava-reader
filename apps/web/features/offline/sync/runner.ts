// Orchestrator for offline sync. Buckets register a `flush()` here; the
// runner fires them on the right triggers (online / visibilitychange / focus
// / a slow poll while visible / pagehide) and in a sensible order.
//
// Phase 0 ships the wiring without any bucket registered. Each subsequent
// phase plugs its bucket in via `registerSyncBucket()`. The same triggers
// then start flushing it for free.

import { isOnline, subscribeToNetworkState } from "../net-state";

export type SyncBucket = {
  // Stable id for logging + dedupe.
  id: string;
  // Order within a flush cycle. Lower runs first.
  // preferences before highlights before sessions before AI comments.
  priority: number;
  // Drain the queue. Must be idempotent and safe to call concurrently with
  // itself (the runner guards single-flight per bucket, but bucket-internal
  // mutations may also call flush() directly).
  flush: () => Promise<void>;
};

type RunnerState = {
  buckets: Map<string, SyncBucket>;
  // In-flight flush promise per bucket id — guards against overlapping runs.
  inFlight: Map<string, Promise<void>>;
  attached: boolean;
  pollHandle: ReturnType<typeof setInterval> | null;
  onVisibility: (() => void) | null;
  onFocus: (() => void) | null;
  onPageHide: (() => void) | null;
  unsubscribeNet: (() => void) | null;
};

const state: RunnerState = {
  buckets: new Map(),
  inFlight: new Map(),
  attached: false,
  pollHandle: null,
  onVisibility: null,
  onFocus: null,
  onPageHide: null,
  unsubscribeNet: null,
};

// Slow safety-net while online + visible. The main triggers cover the
// common cases; this catches stragglers when the browser doesn't fire
// `online` reliably (some Wi-Fi transitions on macOS, for example).
const POLL_INTERVAL_MS = 30_000;

export function registerSyncBucket(bucket: SyncBucket) {
  state.buckets.set(bucket.id, bucket);
}

export function unregisterSyncBucket(id: string) {
  state.buckets.delete(id);
}

export function listSyncBuckets(): SyncBucket[] {
  return Array.from(state.buckets.values()).sort(
    (a, b) => a.priority - b.priority,
  );
}

// Triggers a flush for every registered bucket. Single-flight per bucket id;
// if a flush is already running for a bucket, calls to flushAll() that land
// during it are no-ops for that one bucket.
export async function flushAll(): Promise<void> {
  if (!isOnline()) {
    return;
  }
  const buckets = listSyncBuckets();
  await Promise.all(buckets.map((bucket) => flushBucket(bucket)));
}

function flushBucket(bucket: SyncBucket): Promise<void> {
  const existing = state.inFlight.get(bucket.id);
  if (existing) {
    return existing;
  }
  const promise = Promise.resolve()
    .then(() => bucket.flush())
    .catch((error) => {
      // The bucket itself owns retry/backoff; an exception here is a bug we
      // want surfaced in dev. In production we swallow so one bad bucket
      // can't break the others' flush cycle.
      if (process.env.NODE_ENV !== "production") {
        console.error(`[offline sync] bucket "${bucket.id}" threw`, error);
      }
    })
    .finally(() => {
      state.inFlight.delete(bucket.id);
    });
  state.inFlight.set(bucket.id, promise);
  return promise;
}

// Wires the global triggers. Call once at app boot.
export function startSyncRunner() {
  if (state.attached || typeof window === "undefined") {
    return;
  }

  state.unsubscribeNet = subscribeToNetworkState((online) => {
    if (online) {
      void flushAll();
    }
  });

  state.onVisibility = () => {
    if (document.visibilityState === "visible" && isOnline()) {
      void flushAll();
    }
  };
  document.addEventListener("visibilitychange", state.onVisibility);

  state.onFocus = () => {
    if (isOnline()) {
      void flushAll();
    }
  };
  window.addEventListener("focus", state.onFocus);

  // Best-effort drain before tab close. Each bucket should pair this with
  // fetch(..., { keepalive: true }) for any final mutation it cares about;
  // here we just kick the flush — the browser may or may not let it finish.
  state.onPageHide = () => {
    void flushAll();
  };
  window.addEventListener("pagehide", state.onPageHide);

  state.pollHandle = setInterval(() => {
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "visible" &&
      isOnline()
    ) {
      void flushAll();
    }
  }, POLL_INTERVAL_MS);

  state.attached = true;
}

export function stopSyncRunner() {
  if (!state.attached) {
    return;
  }
  if (state.unsubscribeNet) {
    state.unsubscribeNet();
    state.unsubscribeNet = null;
  }
  if (state.onVisibility && typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", state.onVisibility);
  }
  if (state.onFocus && typeof window !== "undefined") {
    window.removeEventListener("focus", state.onFocus);
  }
  if (state.onPageHide && typeof window !== "undefined") {
    window.removeEventListener("pagehide", state.onPageHide);
  }
  if (state.pollHandle) {
    clearInterval(state.pollHandle);
    state.pollHandle = null;
  }
  state.onVisibility = null;
  state.onFocus = null;
  state.onPageHide = null;
  state.attached = false;
}

// Test-only: clear all registered buckets + detach triggers. Each test sets
// up exactly the buckets it cares about.
export function __resetSyncRunnerForTests() {
  stopSyncRunner();
  state.buckets.clear();
  state.inFlight.clear();
}
