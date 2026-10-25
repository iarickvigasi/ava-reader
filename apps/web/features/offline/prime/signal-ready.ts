import type { PrimeInternals, PrimeRuntime } from "./types";

// The "Ready for offline work" cue promises the current continue-reading book
// reads offline (see [[4.4-cache-priming]]). A best-effort content pass can end
// "done" with that book still uncached — its background auto-save failed, or it
// was declined under Save-Data — so gate the cue on the book's content actually
// being present. Otherwise the cue over-promises and tapping continue-reading
// offline hits the missing-book modal. No current book → nothing to gate on
// (metadata + shells suffice for a fresh user).
async function currentBookContentReady(d: PrimeInternals): Promise<boolean> {
  const currentBookId = await d.readCurrentBookId();
  if (!currentBookId) {
    return true;
  }
  return d.hasBookContent(currentBookId);
}

// Emit the "ready" beat only when the current book is genuinely cached. A
// withheld beat isn't lost: the pass still marks completion, and the next
// reconnect's reconcile re-attempts the save and fires the cue once it lands.
export async function signalReadyIfCurrentBookCached(
  runtime: PrimeRuntime,
  d: PrimeInternals,
): Promise<void> {
  if (await currentBookContentReady(d)) {
    runtime.onProgress?.({ phase: "ready" });
  }
}
