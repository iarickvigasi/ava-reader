// Resolves what the reader shell should render for a slug (ADR 4): the Dexie
// cache first, the network while online, or a missing/error outcome. Pure
// orchestration behind injected seams so it's unit-testable without Dexie or
// Clerk; the shell component wires the real implementations.

import type { ReaderStatusPayload } from "@/lib/api-types";

export type ReaderLoadResult =
  | { kind: "loaded"; payload: ReaderStatusPayload; libraryItemId: string }
  // Offline and the content isn't in Dexie. `libraryItemId` is null when the
  // slug isn't even in the cached library (deep link to an unknown book).
  | { kind: "missing-offline"; libraryItemId: string | null }
  | { kind: "error" };

export type LoadReaderDeps = {
  isOnline: () => boolean;
  findLibraryItemIdBySlug: (slug: string) => Promise<string | null>;
  loadFromCache: (libraryItemId: string) => Promise<ReaderStatusPayload | null>;
  // Accepts a slug or a libraryItemId — the API route resolves either.
  fetchFromNetwork: (slugOrId: string) => Promise<ReaderStatusPayload>;
};

export async function loadReaderForSlug(
  slug: string,
  deps: LoadReaderDeps,
): Promise<ReaderLoadResult> {
  const libraryItemId = await deps.findLibraryItemIdBySlug(slug);
  if (libraryItemId) {
    const cached = await deps.loadFromCache(libraryItemId);
    if (cached) {
      return { kind: "loaded", payload: cached, libraryItemId };
    }
  }
  if (!deps.isOnline()) {
    return { kind: "missing-offline", libraryItemId };
  }
  try {
    const payload = await deps.fetchFromNetwork(libraryItemId ?? slug);
    return {
      kind: "loaded",
      payload,
      libraryItemId: payload.book.libraryItemId,
    };
  } catch {
    // A failed fetch for a book we know locally means its content just isn't
    // available right now (offline that navigator.onLine failed to report,
    // server unreachable, auth never booted). Surface the instructional
    // missing-book modal instead of a dead spinner. Only a slug we know
    // nothing about is a plain error.
    return libraryItemId
      ? { kind: "missing-offline", libraryItemId }
      : { kind: "error" };
  }
}
