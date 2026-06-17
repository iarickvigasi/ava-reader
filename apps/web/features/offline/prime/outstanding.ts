// Cheap probe for the primer's post-completion reconcile: is there an
// offline-marked book whose content we haven't cached yet? (e.g. the user
// tapped Save while disconnected after the device had already fully primed.)
// Reuses the content tier's target predicate — `offlineRequested &&
// !hasBookContent` — and stops at the first match, so it's safe to call on
// every reconnect.

import { collectSmartBooks } from "./smart-books";
import type { PrimeInternals } from "./types";

export async function hasOutstandingOfflineContent(
  d: PrimeInternals,
): Promise<boolean> {
  const view = await d.readLibraryView();
  if (!view) {
    return false;
  }
  for (const b of collectSmartBooks(view)) {
    if (b.offlineRequested && !(await d.hasBookContent(b.libraryItemId))) {
      return true;
    }
  }
  return false;
}
