// Cheap probe for the primer's post-completion reconcile: is there a content
// target whose content we haven't cached yet? (e.g. the user tapped Save while
// disconnected, or started a new book, after the device had already primed.)
// Shares the content tier's target set (collectContentTargets) — offline-marked
// books, plus the current book when Save-Data allows — and stops at the first
// match, so it's safe to call on every reconnect.

import { collectContentTargets } from "./smart-books";
import type { PrimeInternals } from "./types";

export async function hasOutstandingOfflineContent(
  d: PrimeInternals,
  includeCurrentBook: boolean,
): Promise<boolean> {
  const view = await d.readLibraryView();
  if (!view) {
    return false;
  }
  // The current book is a target only when Save-Data allows (it's not an
  // explicit request), so gate resolving it on `includeCurrentBook`.
  const currentBookId = includeCurrentBook ? await d.readCurrentBookId() : null;
  for (const b of collectContentTargets(view, currentBookId)) {
    if (!(await d.hasBookContent(b.libraryItemId))) {
      return true;
    }
  }
  return false;
}
