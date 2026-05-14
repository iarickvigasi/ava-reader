// Shared types for the offline-first highlights store. Keeping them in one
// leaf module avoids circular imports between the bucket/storage/sync layers
// and makes it obvious which shapes are part of the public surface vs.
// internal plumbing.

import type { ReaderRangeLocator } from "../api-types";

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

// Persisted shape. Versioned so we can migrate later without nuking data.
export type HighlightsStorageV1 = {
  version: 1;
  snapshot: HighlightRecord[];
  pending: PendingMutation[];
};

export const STORAGE_VERSION = 1;

export type Listener = () => void;

// In-memory per-book record. Mutated in place; consumers subscribe via
// `subscribeToHighlights` and re-read through `selectStableHighlights`,
// which uses `version` as a memo key.
export type StorageBucket = {
  state: HighlightsStorageV1;
  listeners: Set<Listener>;
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
