// Shared types for the offline-first highlights bucket. Keeping them in one
// leaf module avoids circular imports between the storage/bucket/sync
// layers and makes it obvious which shapes are public vs. internal.

import type { ReaderRangeLocator } from "@/lib/api-types";

export type HighlightColor =
  | "apricot"
  | "mimosa"
  | "jade"
  | "sky"
  | "lavender"
  | "rose"
  | "mauve";

export type HighlightRecord = {
  id: string;
  excerpt: string;
  color: HighlightColor;
  locator: ReaderRangeLocator | null;
  createdAt: string;
  updatedAt: string;
};

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

// In-memory state. Backed by Dexie rows but held in memory for fast,
// synchronous reads from the selector + useSyncExternalStore.
export type HighlightsState = {
  version: 1;
  snapshot: HighlightRecord[];
  pending: PendingMutation[];
};

export const STORAGE_VERSION = 1;

export type Listener = () => void;

// Emitted when a queued mutation hits a permanent failure and we discard it.
// The hook surfaces these as toasts so the user knows their highlight didn't
// save and *why* — silently dropping data is the worst kind of bug.
export type DropEvent = {
  mutationKind: "upsert" | "delete";
  highlightId: string;
  // Server-provided message when available, otherwise a generic fallback.
  // Already user-readable; we don't try to translate it (no error codes on
  // the wire yet).
  reason: string;
};

export type DropListener = (event: DropEvent) => void;

// In-memory per-book record. Mutated in place; consumers subscribe via
// `subscribeToHighlights` and re-read through `selectStableHighlights`,
// which uses `version` as a memo key.
export type StorageBucket = {
  state: HighlightsState;
  listeners: Set<Listener>;
  dropListeners: Set<DropListener>;
  flushing: boolean;
  // The token-getter is volatile (Clerk hooks return new identities), so we
  // store the latest one and re-use it for background flushes that fire
  // outside React render cycles (online/visibility events).
  getToken: (() => Promise<string | null>) | null;
  apiBaseUrl: string;
  // Bumped on every state mutation. Drives the stable-selector memo.
  version: number;
  derived: HighlightRecord[];
  derivedVersion: number;
  // In-session retry backoff. Reset on success, doubled on each retryable
  // failure, capped at RETRY_MAX_MS. The handle lets us cancel a pending
  // retry when a fresh mutation comes in.
  retryDelayMs: number;
  retryHandle: ReturnType<typeof setTimeout> | null;
  // Hydration state. The bucket is created synchronously with empty state
  // and an async hydrate kicks off in the background; this promise resolves
  // once Dexie has been read at least once. `flushBucket` awaits it so a
  // queue drained from a previous session isn't double-sent before the
  // in-memory queue catches up.
  hydratedPromise: Promise<void>;
  // Chains every fire-and-forget Dexie write done by mutations.ts / sync.ts.
  // Tests await it via `awaitHighlightsPersistDrain` to make timing
  // deterministic; production code never reads it (writes are always
  // fire-and-forget by design).
  pendingPersist: Promise<unknown>;
  // The currently-running flushBucket promise, when there is one. Same
  // story as `pendingPersist` — exposed to tests so they can await the
  // network roundtrip + post-ack Dexie writes deterministically.
  flushPromise: Promise<void> | null;
};

// Shape returned by the API. Annotation rows can have a null highlightColor
// (legacy data from before this feature shipped); the store defaults those
// to `apricot` so the UI has something to render.
export type ServerAnnotation = {
  id: string;
  excerpt: string;
  highlightColor: string | null;
  locator: ReaderRangeLocator | null;
  createdAt: string;
  updatedAt: string;
};
