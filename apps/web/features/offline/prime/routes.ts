// Enumerates the app routes whose shells should be precached for offline use
// (see [[14-route-precaching]]). Pure: given the cached library view, returns
// the bare route paths (no query) the SW should cache as documents + RSC.
// Static routes need no data; per-entity routes come from the library view.

import type { LibraryView } from "../buckets/library/types";

import { collectSmartBooks } from "./smart-books";

// Fixed, always-available app routes. Admin is intentionally excluded — it's
// role-gated and tracked as an open question in the spec.
export const STATIC_APP_ROUTES = [
  "/app",
  "/app/library",
  "/app/insights",
  "/app/explore",
] as const;

export function collectAppRoutes(view: LibraryView | null): string[] {
  const routes: string[] = [...STATIC_APP_ROUTES];
  if (view) {
    for (const collection of view.collections) {
      routes.push(`/app/library/collections/${collection.slug}`);
    }
    for (const book of collectSmartBooks(view)) {
      routes.push(`/app/library/books/${book.slug}`, `/app/read/${book.slug}`);
    }
  }
  return [...new Set(routes)];
}
