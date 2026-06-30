// Shared types for the background primer. The orchestrator depends on a set of
// seams (PrimeInternals) so its control flow can be unit-tested without Dexie,
// Clerk, or the network; production wires the real implementations.

import type { LibraryView } from "../buckets/library/types";
import type { SaveOutcome } from "../buckets/book/download";
import type { PrimeProgress } from "../status/prime-progress";

export type GetToken = () => Promise<string | null>;

// A single book's offline-save, provided by the client island (it needs Clerk
// auth for the reader fetcher). Returns the orchestrator's outcome so the
// primer can tell "user took over" (cancelled) from a plain failure.
export type SaveBookFn = (libraryItemId: string) => Promise<SaveOutcome>;

export type PrimeRuntime = {
  getToken: GetToken;
  saveBook: SaveBookFn;
  // Called when the content tier stops because the device is low on storage,
  // so the island can surface a toast. Optional — omitted in tests that don't
  // assert on it.
  onStorageFull?: () => void;
  // Reports priming progress to the header chip (see [[11-cache-priming]]):
  // the metadata tier ticks per book-info cached, the content tier per book
  // saved, and the orchestrator emits `{ phase: "ready" }` on first completion.
  // Optional — omitted in tests/SSR.
  onProgress?: (progress: PrimeProgress) => void;
};

// Seams for tests — default to the real implementations (see ./internals.ts).
export type PrimeInternals = {
  // Metadata tier may run on any non-slow connection (ignores Save-Data); the
  // content tier consults `isSaveDataOn` + consent separately.
  canPrimeMetadata: () => boolean;
  isSaveDataOn: () => boolean;
  isOnline: () => boolean;
  hasInFlightSaves: () => boolean;
  readLibraryView: () => Promise<LibraryView | null>;
  readHome: () => Promise<unknown>;
  readBookInfo: (slug: string) => Promise<unknown>;
  revalidateHome: (getToken: GetToken) => Promise<void>;
  revalidateLibrary: (getToken: GetToken) => Promise<void>;
  revalidateCollection: (slug: string, getToken: GetToken) => Promise<void>;
  revalidateBookInfo: (slug: string, getToken: GetToken) => Promise<void>;
  revalidatePreferences: (getToken: GetToken) => Promise<void>;
  revalidateHighlights: (libraryItemId: string, getToken: GetToken) => Promise<void>;
  revalidateAiComments: (libraryItemId: string, getToken: GetToken) => Promise<void>;
  hasBookContent: (libraryItemId: string) => Promise<boolean>;
  checkStorageQuota: (floorBytes?: number) => Promise<{ ok: boolean }>;
  getMetaFlag: (key: string) => Promise<string | null>;
  hasMetaFlag: (key: string) => Promise<boolean>;
  setMetaFlag: (key: string, value: string) => Promise<void>;
  now: () => string;
};

// Result of a primer run, so the client island knows whether to surface the
// Save-Data consent modal.
export type PrimeResult = {
  // True when the content tier is blocked waiting for the user's answer to the
  // Save-Data modal (Save-Data on + consent not yet given).
  contentConsentNeeded: boolean;
};
