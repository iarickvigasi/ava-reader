// Tier 2 of the primer: the heavy book content — full reader chapters + cover
// for every smart-collection book, saved via the book bucket's orchestrator.
// Sequential (the orchestrator is single-flight by design), quota-gated, and
// yields to any save the user starts.

import { collectSmartBooks } from "./smart-books";
import type { PrimeInternals, PrimeRuntime } from "./types";

// Background priming is more conservative about disk than an interactive save:
// we stop pulling content while there's less than this much headroom, so
// proactive caching never crowds out the user's own saves or fills the device.
// (The interactive save floor is 100 MB — see book/quota.ts.)
const BACKGROUND_QUOTA_FLOOR_BYTES = 500 * 1024 * 1024; // 500 MB

// Returns true when book content reached a terminal state for this device:
// every smart-collection book is cached, or the storage floor was hit. Returns
// false for a resumable interruption (offline, Save-Data flipped, or a user
// save took over) so the next home load picks up where we left off.
export async function primeBookContent(
  runtime: PrimeRuntime,
  d: PrimeInternals,
): Promise<boolean> {
  const view = await d.readLibraryView();
  if (!view) {
    return false;
  }
  const books = collectSmartBooks(view);

  for (const b of books) {
    if (!d.isOnline() || !d.shouldPrime()) {
      return false; // resumable — connection went away / metered
    }
    if (await d.hasBookContent(b.libraryItemId)) {
      continue; // already on disk (prior pass, or the user saved it)
    }
    // Never abort a save the user just started — saveBookOffline aborts other
    // in-flight saves, so we step aside and resume later.
    if (d.hasInFlightSaves()) {
      return false;
    }
    if (!(await d.checkStorageQuota(BACKGROUND_QUOTA_FLOOR_BYTES)).ok) {
      // Out of polite headroom. Terminal: we've cached as much as the device
      // comfortably allows; don't retry forever.
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
    // "failed" is best-effort: skip and keep going. "saved" → next book.
  }

  return true;
}
