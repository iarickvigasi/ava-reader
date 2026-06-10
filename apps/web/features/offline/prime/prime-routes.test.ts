import { describe, expect, it, vi } from "vitest";

import type { LibraryView } from "../buckets/library/types";

import { STATIC_APP_ROUTES } from "./routes";
import { primeRoutes, type PrimeRoutesDeps } from "./prime-routes";

const VIEW = {
  collections: [
    { slug: "all", kind: "SMART", books: [{ libraryItemId: "dune", slug: "dune" }] },
  ],
  summary: { booksCount: 1, collectionsCount: 1 },
} as unknown as LibraryView;

function deps(overrides: Partial<PrimeRoutesDeps> = {}): PrimeRoutesDeps {
  return {
    isOnline: () => true,
    readLibraryView: vi.fn().mockResolvedValue(VIEW),
    requestRoutePrecache: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("primeRoutes", () => {
  it("precaches every route and returns done when the library view is present", async () => {
    const d = deps();
    const result = await primeRoutes(d);

    expect(result).toBe("done");
    expect(d.requestRoutePrecache).toHaveBeenCalledWith([
      ...STATIC_APP_ROUTES,
      "/app/library/collections/all",
      "/app/library/books/dune",
      "/app/read/dune",
    ]);
  });

  it("precaches only static routes and returns partial when the view is missing", async () => {
    const d = deps({ readLibraryView: vi.fn().mockResolvedValue(null) });
    const result = await primeRoutes(d);

    expect(result).toBe("partial");
    expect(d.requestRoutePrecache).toHaveBeenCalledWith([...STATIC_APP_ROUTES]);
  });

  it("skips when offline without touching the library or the worker", async () => {
    const d = deps({ isOnline: () => false });
    const result = await primeRoutes(d);

    expect(result).toBe("skipped");
    expect(d.requestRoutePrecache).not.toHaveBeenCalled();
    expect(d.readLibraryView).not.toHaveBeenCalled();
  });
});
