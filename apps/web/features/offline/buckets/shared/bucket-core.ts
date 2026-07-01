// Shared per-bucket primitives for the offline buckets (highlights,
// ai-comments). Both buckets keep the same StorageBucket shape — a listener
// set, a drop-listener set, a version counter, a fire-and-forget persist
// chain, and an in-session retry timer — so these helpers operate on the
// structural subset each one satisfies. The drop-event type is left generic
// because each bucket carries a different DropEvent payload.

type Listener = () => void;

// --- subscriptions -------------------------------------------------------

// Registers a state-change listener and returns an unsubscribe.
export function addListener(
  bucket: { listeners: Set<Listener> },
  listener: Listener,
): () => void {
  bucket.listeners.add(listener);
  return () => {
    bucket.listeners.delete(listener);
  };
}

// Registers a drop listener and returns an unsubscribe.
export function addDropListener<Event>(
  bucket: { dropListeners: Set<(event: Event) => void> },
  listener: (event: Event) => void,
): () => void {
  bucket.dropListeners.add(listener);
  return () => {
    bucket.dropListeners.delete(listener);
  };
}

// Stores the latest token-getter for background flushes. The getter is
// volatile (Clerk hooks return new identities), so the caller refreshes it.
export function setBucketAuth(
  bucket: { getToken: (() => Promise<string | null>) | null },
  getToken: () => Promise<string | null>,
): void {
  bucket.getToken = getToken;
}

// --- notify / persist ----------------------------------------------------

function notify(bucket: { listeners: Set<Listener> }): void {
  for (const listener of bucket.listeners) {
    listener();
  }
}

export function notifyDrop<Event>(
  bucket: { dropListeners: Set<(event: Event) => void> },
  event: Event,
): void {
  for (const listener of bucket.dropListeners) {
    listener(event);
  }
}

// Bump version (so memoized selectors invalidate) and notify subscribers.
// Dexie writes are issued by the mutation/sync caller in lockstep; this
// helper deliberately doesn't touch storage.
export function persist(bucket: {
  version: number;
  listeners: Set<Listener>;
}): void {
  bucket.version += 1;
  notify(bucket);
}

// Chains a fire-and-forget Dexie write onto the bucket's pendingPersist
// promise. Production code voids the return; tests await the chain via the
// per-bucket persist-drain helper to make timing deterministic.
export function trackPersist(
  bucket: { pendingPersist: Promise<unknown> },
  write: () => Promise<unknown>,
): void {
  bucket.pendingPersist = bucket.pendingPersist
    .catch(() => {})
    .then(() => write());
}

// --- retry backoff -------------------------------------------------------

export const RETRY_BASE_MS = 1_000;
export const RETRY_MAX_MS = 30_000;

type RetryBucket = {
  retryDelayMs: number;
  retryHandle: ReturnType<typeof setTimeout> | null;
};

// Clears a pending retry timer, if any.
export function cancelRetry(bucket: {
  retryHandle: ReturnType<typeof setTimeout> | null;
}): void {
  if (bucket.retryHandle) {
    clearTimeout(bucket.retryHandle);
    bucket.retryHandle = null;
  }
}

// Doubles the in-session backoff (capped at RETRY_MAX_MS), replaces any
// pending timer, and schedules `run` after the new delay.
export function scheduleRetry(bucket: RetryBucket, run: () => void): void {
  const next =
    bucket.retryDelayMs === 0
      ? RETRY_BASE_MS
      : Math.min(bucket.retryDelayMs * 2, RETRY_MAX_MS);
  bucket.retryDelayMs = next;
  if (bucket.retryHandle) {
    clearTimeout(bucket.retryHandle);
  }
  bucket.retryHandle = setTimeout(() => {
    bucket.retryHandle = null;
    run();
  }, next);
}

// --- test helper ---------------------------------------------------------

// Waits for every in-flight async piece kicked off by mutations/sync — the
// fire-and-forget Dexie write chain *and* any currently-running flush — to
// settle. Loops because the flush appends more writes to pendingPersist after
// its network roundtrip resolves. Avoids brittle setTimeout polling.
export async function awaitPersistDrain(
  bucket:
    | { pendingPersist: Promise<unknown>; flushPromise: Promise<void> | null }
    | undefined,
): Promise<void> {
  if (!bucket) {
    return;
  }
  for (let i = 0; i < 10; i++) {
    const persistBefore = bucket.pendingPersist;
    const flush = bucket.flushPromise;
    await bucket.pendingPersist.catch(() => {});
    if (flush) {
      await flush.catch(() => {});
    }
    if (!bucket.flushPromise && bucket.pendingPersist === persistBefore) {
      return;
    }
  }
}
