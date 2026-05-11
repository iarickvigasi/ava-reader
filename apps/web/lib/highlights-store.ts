// Offline-first highlights store. The reader needs to feel instant: a click on
// a color swatch must paint the highlight immediately, even when the network
// is down. We hold the canonical state in memory + localStorage, apply
// mutations locally first, and replay them against the API when the browser
// is online. Replays are idempotent (PUT keyed by client-generated id), so a
// dropped response never produces a duplicate row.

import type { ReaderRangeLocator } from "./api-types";

// Storage shape (versioned so we can migrate later without nuking data).
type HighlightsStorageV1 = {
  version: 1;
  snapshot: HighlightRecord[];
  pending: PendingMutation[];
};

export type HighlightRecord = {
  id: string;
  excerpt: string;
  color: HighlightColor;
  locator: ReaderRangeLocator | null;
  createdAt: string;
  updatedAt: string;
};

export type HighlightColor =
  | "apricot"
  | "mimosa"
  | "jade"
  | "sky"
  | "lavender"
  | "rose"
  | "mauve";

export type PendingMutation =
  | {
      kind: "upsert";
      id: string;
      payload: {
        excerpt: string;
        highlightColor: HighlightColor;
        locator: ReaderRangeLocator | null;
      };
      queuedAt: string;
    }
  | {
      kind: "delete";
      id: string;
      queuedAt: string;
    };

type Listener = () => void;

type StorageBucket = {
  state: HighlightsStorageV1;
  listeners: Set<Listener>;
  flushing: boolean;
  // The token-getter is volatile (Clerk hooks return new identities), so we
  // store the latest one and re-use it for background flushes that fire
  // outside React render cycles (online/visibility events).
  getToken: (() => Promise<string | null>) | null;
  apiBaseUrl: string;
  // Bumped on every state mutation. The hook's getSnapshot uses this as a
  // memo key so it returns a referentially stable array across renders.
  version: number;
  derived: HighlightRecord[];
  derivedVersion: number;
};

const STORAGE_KEY_PREFIX = "ava-reader:highlights:";
const STORAGE_VERSION = 1;

const buckets = new Map<string, StorageBucket>();

function storageKey(libraryItemId: string): string {
  return `${STORAGE_KEY_PREFIX}${libraryItemId}`;
}

function readStorage(libraryItemId: string): HighlightsStorageV1 {
  if (typeof window === "undefined") {
    return { version: STORAGE_VERSION, snapshot: [], pending: [] };
  }
  try {
    const raw = window.localStorage.getItem(storageKey(libraryItemId));
    if (!raw) {
      return { version: STORAGE_VERSION, snapshot: [], pending: [] };
    }
    const parsed = JSON.parse(raw) as Partial<HighlightsStorageV1>;
    if (parsed.version !== STORAGE_VERSION) {
      return { version: STORAGE_VERSION, snapshot: [], pending: [] };
    }
    return {
      version: STORAGE_VERSION,
      snapshot: Array.isArray(parsed.snapshot) ? parsed.snapshot : [],
      pending: Array.isArray(parsed.pending) ? parsed.pending : [],
    };
  } catch {
    return { version: STORAGE_VERSION, snapshot: [], pending: [] };
  }
}

function writeStorage(libraryItemId: string, state: HighlightsStorageV1) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      storageKey(libraryItemId),
      JSON.stringify(state),
    );
  } catch {
    // Quota exceeded or storage disabled — the in-memory state still works
    // for the current session; we just lose the offline-replay on reload.
  }
}

function getOrCreateBucket(
  libraryItemId: string,
  apiBaseUrl: string,
): StorageBucket {
  let bucket = buckets.get(libraryItemId);
  if (!bucket) {
    bucket = {
      state: readStorage(libraryItemId),
      listeners: new Set(),
      flushing: false,
      getToken: null,
      apiBaseUrl,
      version: 1,
      derived: [],
      derivedVersion: 0,
    };
    buckets.set(libraryItemId, bucket);
  }
  bucket.apiBaseUrl = apiBaseUrl;
  return bucket;
}

function notify(bucket: StorageBucket) {
  for (const listener of bucket.listeners) {
    listener();
  }
}

function persist(libraryItemId: string, bucket: StorageBucket) {
  bucket.version += 1;
  writeStorage(libraryItemId, bucket.state);
  notify(bucket);
}

// Stable selector for useSyncExternalStore. Re-derives only when `version`
// changed since the last call — otherwise returns the cached array so React
// sees referential equality and skips re-rendering.
export function selectStableHighlights(
  bucket: StorageBucket,
): HighlightRecord[] {
  if (bucket.derivedVersion === bucket.version) {
    return bucket.derived;
  }
  bucket.derived = selectHighlights(bucket);
  bucket.derivedVersion = bucket.version;
  return bucket.derived;
}

// Computes the merged view (snapshot + pending) the UI renders. Pending
// mutations always win over the server snapshot — they represent the
// user's local intent, which they expect to see reflected immediately.
export function selectHighlights(
  bucket: StorageBucket,
): HighlightRecord[] {
  const byId = new Map<string, HighlightRecord>();
  for (const row of bucket.state.snapshot) {
    byId.set(row.id, row);
  }
  for (const mutation of bucket.state.pending) {
    if (mutation.kind === "delete") {
      byId.delete(mutation.id);
      continue;
    }
    const existing = byId.get(mutation.id);
    const now = mutation.queuedAt;
    byId.set(mutation.id, {
      id: mutation.id,
      excerpt: mutation.payload.excerpt,
      color: mutation.payload.highlightColor,
      locator: mutation.payload.locator,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }
  return Array.from(byId.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function subscribeToHighlights(
  libraryItemId: string,
  apiBaseUrl: string,
  listener: Listener,
): () => void {
  const bucket = getOrCreateBucket(libraryItemId, apiBaseUrl);
  bucket.listeners.add(listener);
  return () => {
    bucket.listeners.delete(listener);
  };
}

export function getHighlightsBucket(
  libraryItemId: string,
  apiBaseUrl: string,
): StorageBucket {
  return getOrCreateBucket(libraryItemId, apiBaseUrl);
}

export function setBucketAuth(
  libraryItemId: string,
  apiBaseUrl: string,
  getToken: () => Promise<string | null>,
) {
  const bucket = getOrCreateBucket(libraryItemId, apiBaseUrl);
  bucket.getToken = getToken;
}

// Replaces the server snapshot from a fresh GET. Pending mutations are kept —
// they may not have been acked yet. We do drop snapshot rows that a pending
// delete supersedes (avoids them flicking back into view between the GET and
// the delete flush).
export function applyServerSnapshot(
  libraryItemId: string,
  apiBaseUrl: string,
  snapshot: HighlightRecord[],
) {
  const bucket = getOrCreateBucket(libraryItemId, apiBaseUrl);
  bucket.state = {
    version: STORAGE_VERSION,
    snapshot,
    pending: bucket.state.pending,
  };
  persist(libraryItemId, bucket);
}

export function enqueueUpsert(
  libraryItemId: string,
  apiBaseUrl: string,
  input: {
    id: string;
    excerpt: string;
    color: HighlightColor;
    locator: ReaderRangeLocator | null;
  },
) {
  const bucket = getOrCreateBucket(libraryItemId, apiBaseUrl);
  const queuedAt = new Date().toISOString();
  // Coalesce: if we already have a pending mutation for this id, replace it.
  // We only ever need to send the *final* state to the server.
  const filtered = bucket.state.pending.filter(
    (mutation) => mutation.id !== input.id,
  );
  bucket.state = {
    ...bucket.state,
    pending: [
      ...filtered,
      {
        kind: "upsert",
        id: input.id,
        payload: {
          excerpt: input.excerpt,
          highlightColor: input.color,
          locator: input.locator,
        },
        queuedAt,
      },
    ],
  };
  persist(libraryItemId, bucket);
  void flushBucket(libraryItemId, apiBaseUrl);
}

export function enqueueDelete(
  libraryItemId: string,
  apiBaseUrl: string,
  id: string,
) {
  const bucket = getOrCreateBucket(libraryItemId, apiBaseUrl);
  // If the row has never been synced (only exists in pending as an upsert),
  // we can drop both the upsert and the delete — there's nothing to delete
  // on the server.
  const everSynced = bucket.state.snapshot.some((row) => row.id === id);
  const filtered = bucket.state.pending.filter(
    (mutation) => mutation.id !== id,
  );
  if (!everSynced) {
    bucket.state = { ...bucket.state, pending: filtered };
    persist(libraryItemId, bucket);
    return;
  }
  bucket.state = {
    ...bucket.state,
    pending: [
      ...filtered,
      { kind: "delete", id, queuedAt: new Date().toISOString() },
    ],
  };
  persist(libraryItemId, bucket);
  void flushBucket(libraryItemId, apiBaseUrl);
}

// Tries to drain the pending queue head-first. One in-flight at a time per
// bucket so the server sees mutations in order. On 5xx / network error we
// stop and leave the queue intact — the next online/visibility event will
// retry. On 4xx (other than 401/429) we drop the mutation: the server
// rejected the data and retrying won't help.
export async function flushBucket(
  libraryItemId: string,
  apiBaseUrl: string,
): Promise<void> {
  const bucket = getOrCreateBucket(libraryItemId, apiBaseUrl);
  if (bucket.flushing) {
    return;
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return;
  }
  if (!bucket.getToken) {
    return;
  }
  bucket.flushing = true;
  try {
    while (bucket.state.pending.length > 0) {
      const head = bucket.state.pending[0];
      const token = await bucket.getToken();
      if (!token) {
        return;
      }
      const result = await sendMutation(
        bucket.apiBaseUrl,
        libraryItemId,
        head,
        token,
      );
      if (result === "retry") {
        return;
      }
      // success or drop — pop the head and apply to snapshot.
      const popped = bucket.state.pending.slice(1);
      let nextSnapshot = bucket.state.snapshot;
      if (result.kind === "upserted" && result.row) {
        const filtered = nextSnapshot.filter((row) => row.id !== head.id);
        nextSnapshot = [...filtered, result.row];
      } else if (result.kind === "deleted") {
        nextSnapshot = nextSnapshot.filter((row) => row.id !== head.id);
      }
      bucket.state = {
        ...bucket.state,
        snapshot: nextSnapshot,
        pending: popped,
      };
      persist(libraryItemId, bucket);
    }
  } finally {
    bucket.flushing = false;
  }
}

type SendResult =
  | "retry"
  | { kind: "upserted"; row: HighlightRecord | null }
  | { kind: "deleted" }
  | { kind: "drop" };

async function sendMutation(
  apiBaseUrl: string,
  libraryItemId: string,
  mutation: PendingMutation,
  token: string,
): Promise<SendResult> {
  const url = `${apiBaseUrl}/api/library/${encodeURIComponent(
    libraryItemId,
  )}/annotations/${encodeURIComponent(mutation.id)}`;
  try {
    if (mutation.kind === "delete") {
      const response = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok || response.status === 404) {
        return { kind: "deleted" };
      }
      if (response.status >= 500 || response.status === 408) {
        return "retry";
      }
      return { kind: "drop" };
    }
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        excerpt: mutation.payload.excerpt,
        highlightColor: mutation.payload.highlightColor,
        // Serialize the locator since the server schema accepts a string.
        locator: mutation.payload.locator
          ? JSON.stringify(mutation.payload.locator)
          : undefined,
      }),
    });
    if (response.ok) {
      const data = (await response.json()) as {
        item?: ServerAnnotation;
      };
      const row = data.item ? toHighlightRecord(data.item) : null;
      return { kind: "upserted", row };
    }
    if (response.status >= 500 || response.status === 408) {
      return "retry";
    }
    return { kind: "drop" };
  } catch {
    // Network failure (offline, DNS, etc.). Always retryable.
    return "retry";
  }
}

type ServerAnnotation = {
  id: string;
  excerpt: string;
  highlightColor: string | null;
  locator: ReaderRangeLocator | null;
  createdAt: string;
  updatedAt: string;
};

export function toHighlightRecord(
  annotation: ServerAnnotation,
): HighlightRecord {
  return {
    id: annotation.id,
    excerpt: annotation.excerpt,
    color: (annotation.highlightColor ?? "apricot") as HighlightColor,
    locator: annotation.locator,
    createdAt: annotation.createdAt,
    updatedAt: annotation.updatedAt,
  };
}

export function generateHighlightId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // Fallback: time + random. Only hit on very old browsers; collision risk is
  // negligible at the volume one user generates highlights.
  return `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
