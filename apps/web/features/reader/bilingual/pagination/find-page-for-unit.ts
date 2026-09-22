import type { BilingualPage } from "../types";

/** Find the page containing a source anchor after reflow or translation arrival. */
export function findBilingualPageForUnit(
  pages: readonly BilingualPage[],
  unitIndex: number,
  continuationIndex = 0,
): number | null {
  let lastMatch: number | null = null;
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    if (!page.unitIndexes.includes(unitIndex)) continue;
    lastMatch = pageIndex;
    if ((page.continuationIndex ?? 0) >= continuationIndex) return pageIndex;
  }
  // If a font change reduced the continuation count, retain its last page.
  return lastMatch;
}
