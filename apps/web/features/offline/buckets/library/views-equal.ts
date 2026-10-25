import type { LibraryView } from "./types";

// Views contain only ordered, serializable card data. Include the flat catalog and
// uncollected list as well as collection previews, so live filters never retain stale results.
export function viewsEqual(
  a: LibraryView | null,
  b: LibraryView | null,
): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}
