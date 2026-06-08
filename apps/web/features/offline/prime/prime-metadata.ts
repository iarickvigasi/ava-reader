// Tier 1 of the primer: the cheap metadata caches — home, user preferences,
// the library list, every smart collection in full, and per-book info for
// every smart-collection book. Reuses the existing `revalidate*` functions, so
// no new endpoints.
//
// Why hydrate each smart collection: `/api/library` only returns a 4-book
// preview per collection, so the library view alone can't enumerate every
// book. `/api/library/collections/:slug` returns the full list, so we hydrate
// each smart collection before enumerating book-info targets.

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
  const guard = () => d.isOnline() && d.canPrimeMetadata();

  await d.revalidateHome(runtime.getToken);
  await d.revalidatePreferences(runtime.getToken);
  await d.revalidateLibrary(runtime.getToken);

  const listView = await d.readLibraryView();
  if (!listView) {
    return false; // library never landed — nothing to enumerate
  }

  // Hydrate each default smart collection in full so the view holds every book,
  // not just the 4-book preview the library list returns.
  const smartSlugs = listView.collections
    .filter((c) => c.kind === "SMART")
    .map((c) => c.slug);
  for (const slug of smartSlugs) {
    if (!guard()) {
      return false;
    }
    await d.revalidateCollection(slug, runtime.getToken);
  }

  const view = await d.readLibraryView();
  if (!view) {
    return false;
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
