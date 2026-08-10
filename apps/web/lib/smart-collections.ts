// Stable identifiers for the server's system-owned (SMART) collections. The
// server stores their names in English; the UI resolves a localized name from
// these keys instead (see components/app/library/shared/collection-display.ts).

export const IMPORTED_LIBRARY_SMART_KEY = "imported-library";
export const PUBLIC_DOMAIN_SMART_KEY = "public-domain-library";
export const OFFLINE_BOOKS_SMART_KEY = "offline-books";

export const KNOWN_SMART_KEYS = new Set<string>([
  IMPORTED_LIBRARY_SMART_KEY,
  PUBLIC_DOMAIN_SMART_KEY,
  OFFLINE_BOOKS_SMART_KEY,
]);

export function isOfflineBooksCollection(collection: {
  smartKey: null | string;
}): boolean {
  return collection.smartKey === OFFLINE_BOOKS_SMART_KEY;
}
