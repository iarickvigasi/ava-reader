// The fixed route list whose shells the SW precaches for offline use (see
// [[14-route-precaching]]). Per-entity routes (reader, book-info, collection)
// are generic shells (ADR 4) — any slug returns the same document — so one
// `__shell__` sentinel per family covers every book/collection, with no
// library enumeration.

// Always-available app routes. Admin is intentionally excluded — it's
// role-gated and tracked as an open question in the spec.
export const STATIC_APP_ROUTES = [
  "/app",
  "/app/library",
  "/app/insights",
  "/app/explore",
] as const;

// One sentinel per generic-shell family. The SW stores their documents under
// the family `__shell__` key and serves them as the offline fallback for any
// slug in that family.
export const SHELL_ROUTE_SENTINELS = [
  "/app/read/__shell__",
  "/app/library/books/__shell__",
  "/app/library/collections/__shell__",
] as const;

export function collectAppRoutes(): string[] {
  return [...STATIC_APP_ROUTES, ...SHELL_ROUTE_SENTINELS];
}
