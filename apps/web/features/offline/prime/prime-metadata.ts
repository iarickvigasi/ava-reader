// Tier 1 of the primer: the cheap metadata caches — home, the library list,
// and per-book info for every smart-collection book. Reuses the existing
// `revalidate*` functions, so no new endpoints.

import { mapWithConcurrency } from "./concurrency";
import { collectSmartBooks } from "./smart-books";
import type { PrimeInternals, PrimeRuntime } from "./types";

// How many book-info revalidations run at once. Generous enough to hide
// round-trips, low enough not to swamp the API on a large library.
const BOOKINFO_CONCURRENCY = 5;

// Returns true only when we can verify every target is cached: the home payload
// is present, the library view is present, and each smart book has a book-info
// row. `revalidate*` swallow network errors, so a silent failure leaves a hole
// → not clean → retried on the next home load.
export async function primeMetadata(
  runtime: PrimeRuntime,
  d: PrimeInternals,
): Promise<boolean> {
  const guard = () => d.isOnline() && d.shouldPrime();

  await d.revalidateHome(runtime.getToken);
  await d.revalidateLibrary(runtime.getToken);

  const view = await d.readLibraryView();
  if (!view) {
    return false; // library never landed — nothing to enumerate
  }

  const slugs = collectSmartBooks(view).map((b) => b.slug);
  const { aborted } = await mapWithConcurrency(
    slugs,
    BOOKINFO_CONCURRENCY,
    (slug) => d.revalidateBookInfo(slug, runtime.getToken),
    guard,
  );
  if (aborted) {
    return false;
  }

  // Verify presence before declaring the pass clean.
  if (!(await d.readHome())) {
    return false;
  }
  for (const slug of slugs) {
    if (!(await d.readBookInfo(slug))) {
      return false;
    }
  }
  return true;
}
