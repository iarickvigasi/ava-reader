// Shared types for the background primer. The orchestrator depends on a set of
// seams (PrimeInternals) so its control flow can be unit-tested without Dexie,
// Clerk, or the network; production wires the real implementations.

import type { LibraryView } from "../buckets/library/types";
import type { SaveOutcome } from "../buckets/book/download";

export type GetToken = () => Promise<string | null>;

// A single book's offline-save, provided by the client island (it needs Clerk
// auth for the reader fetcher). Returns the orchestrator's outcome so the
// primer can tell "user took over" (cancelled) from a plain failure.
export type SaveBookFn = (libraryItemId: string) => Promise<SaveOutcome>;

export type PrimeRuntime = {
  getToken: GetToken;
  saveBook: SaveBookFn;
};

// Seams for tests — default to the real implementations (see ./internals.ts).
export type PrimeInternals = {
  shouldPrime: () => boolean;
  isOnline: () => boolean;
  hasInFlightSaves: () => boolean;
  readLibraryView: () => Promise<LibraryView | null>;
  readHome: () => Promise<unknown>;
  readBookInfo: (slug: string) => Promise<unknown>;
  revalidateHome: (getToken: GetToken) => Promise<void>;
  revalidateLibrary: (getToken: GetToken) => Promise<void>;
  revalidateBookInfo: (slug: string, getToken: GetToken) => Promise<void>;
  hasBookContent: (libraryItemId: string) => Promise<boolean>;
  checkStorageQuota: (floorBytes?: number) => Promise<{ ok: boolean }>;
  hasMetaFlag: (key: string) => Promise<boolean>;
  setMetaFlag: (key: string, value: string) => Promise<void>;
  now: () => string;
};
