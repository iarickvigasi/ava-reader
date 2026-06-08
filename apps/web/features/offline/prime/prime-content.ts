// Tier 2 of the primer: the heavy per-book offline payload — full reader
// chapters + cover, plus highlights and AI comments — for every book the user
// marked "keep offline" (offlineRequested, server-synced; see
// specs/12-offline-save-sync). NOT all books: un-marked books load when opened.
// Sequential (the save orchestrator is single-flight), quota-gated, and yields
// to any save the user starts.

import { collectSmartBooks } from "./smart-books";
import type { PrimeInternals, PrimeRuntime } from "./types";

// Background priming is more conservative about disk than an interactive save:
// we stop pulling content while there's less than this much headroom, so
// proactive caching never crowds out the user's own saves or fills the device.
// (The interactive save floor is 100 MB — see book/quota.ts.)
const BACKGROUND_QUOTA_FLOOR_BYTES = 500 * 1024 * 1024; // 500 MB

// Returns true when book content reached a terminal state for this device:
// every offline-marked book is cached, or the storage floor was hit. Returns
// false for a resumable interruption (offline or a user save took over) so the
// next home load picks up where we left off.
export async function primeBookContent(
  runtime: PrimeRuntime,
  d: PrimeInternals,
): Promise<boolean> {
  const view = await d.readLibraryView();
  if (!view) {
    return false;
  }
  // Only books the user explicitly chose to keep offline. Everything else is
  // cached lazily when opened.
  const books = collectSmartBooks(view).filter((b) => b.offlineRequested);

  for (const b of books) {
    if (!d.isOnline()) {
      return false; // resumable — connection went away
    }
    // Never abort a save the user just started — saveBookOffline aborts other
    // in-flight saves, so we step aside and resume later.
    if (d.hasInFlightSaves()) {
      return false;
    }

    if (!(await d.hasBookContent(b.libraryItemId))) {
      if (!(await d.checkStorageQuota(BACKGROUND_QUOTA_FLOOR_BYTES)).ok) {
        // Out of polite headroom. Terminal: we've cached as much as the device
        // comfortably allows; don't retry forever. Tell the user so they can
        // free space if they want the rest offline.
        runtime.onStorageFull?.();
        if (process.env.NODE_ENV !== "production") {
          const remaining = books.length - books.indexOf(b);
          console.info(
            `[prime] storage floor reached — leaving ${remaining} book(s) uncached`,
          );
        }
        return true;
      }
      const outcome = await runtime.saveBook(b.libraryItemId);
      if (outcome.kind === "cancelled") {
        return false; // user opened a book mid-save — yield and resume
      }
      if (outcome.kind === "failed") {
        continue; // best-effort: skip this book, keep going
      }
    }

    // Cache the book's annotations + AI comments so they render offline. Done
    // for every offline-marked book (not just newly-saved ones) so a resumed
    // device backfills them even when content was already present.
    await d.revalidateHighlights(b.libraryItemId, runtime.getToken);
    await d.revalidateAiComments(b.libraryItemId, runtime.getToken);
  }

  return true;
}
