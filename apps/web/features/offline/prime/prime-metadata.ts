// Tier 1 of the primer: the cheap metadata caches — home, user preferences,
// the library list, every collection in full, and per-book info for every
// smart-collection book. Reuses the existing `revalidate*` functions, so no
// new endpoints.
//
// Why hydrate each collection: `/api/library` only returns a 4-book preview
// per collection, so the library view alone can't enumerate every book.
// `/api/library/collections/:slug` returns the full list, so we hydrate every
// collection before enumerating book-info targets.
//
// This pass is also the only place allowed to delete cached library rows: it
// is the one moment the device holds the whole library, so absence is
// knowable ([[4-offline/_overview]], Write paths).

import { mapWithConcurrency } from "./concurrency";
import { collectCompleteLibraryIds } from "./library-completeness";
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

  // Hydrate every collection in full so the view holds every book, not just
  // the 4-book preview the library list returns. Custom shelves included:
  // their membership and order cache nowhere else.
  for (const collection of listView.collections) {
    if (!guard()) {
      return false;
    }
    await d.revalidateCollection(collection.slug, runtime.getToken);
  }

  const view = await d.readLibraryView();
  if (!view) {
    return false;
  }

  // Drop books that are gone server-side — but only against a pass that
  // demonstrably cached every shelf in full (`revalidate*` swallow network
  // errors, so finishing the loop above proves nothing).
  const cachedIds = collectCompleteLibraryIds(view);
  if (cachedIds) {
    await d.pruneLibraryItems(cachedIds);
  }
  const slugs = collectSmartBooks(view).map((b) => b.slug);

  // Per-book-info is the dominant cost and what gates offline book-info/details
  // pages. Not surfaced in the header chip (it's a fast handful of small JSON
  // fetches; the "Ready offline" beat signals completion). Bounded concurrency.
  const { aborted } = await mapWithConcurrency(
    slugs,
    BOOKINFO_CONCURRENCY,
    (slug) => d.revalidateBookInfo(slug, runtime.getToken),
    guard,
  );
  if (aborted) {
    return false;
  }

  // Verify presence before declaring the pass clean. A book missing here on
  // every pass means metadata never goes clean (its `/api/library/[slug]`
  // persistently fails) and its details page falls back offline — see
  // [[4.4-cache-priming]].
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
