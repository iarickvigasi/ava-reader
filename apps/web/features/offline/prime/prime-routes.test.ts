import { describe, expect, it, vi } from "vitest";

import type { LibraryView } from "../buckets/library/types";

import { META_KEY_ROUTES_DONE } from "./meta";
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
    hasMetaFlag: vi.fn().mockResolvedValue(false),
    setMetaFlag: vi.fn().mockResolvedValue(undefined),
    readLibraryView: vi.fn().mockResolvedValue(VIEW),
    requestRoutePrecache: vi.fn().mockResolvedValue(undefined),
    now: () => "2026-06-09T00:00:00.000Z",
    ...overrides,
  };
}

describe("primeRoutes", () => {
  it("precaches every route and marks done when the library view is present", async () => {
    const d = deps();
    const result = await primeRoutes(d);

    expect(result).toBe("done");
    expect(d.requestRoutePrecache).toHaveBeenCalledWith([
      ...STATIC_APP_ROUTES,
      "/app/library/collections/all",
      "/app/library/books/dune",
      "/app/read/dune",
    ]);
    expect(d.setMetaFlag).toHaveBeenCalledWith(
      META_KEY_ROUTES_DONE,
      "2026-06-09T00:00:00.000Z",
    );
  });

  it("precaches only static routes and does NOT mark done when the view is missing", async () => {
    const d = deps({ readLibraryView: vi.fn().mockResolvedValue(null) });
    const result = await primeRoutes(d);

    expect(result).toBe("partial");
    expect(d.requestRoutePrecache).toHaveBeenCalledWith([...STATIC_APP_ROUTES]);
    expect(d.setMetaFlag).not.toHaveBeenCalled();
  });

  it("skips when offline", async () => {
    const d = deps({ isOnline: () => false });
    const result = await primeRoutes(d);

    expect(result).toBe("skipped");
    expect(d.requestRoutePrecache).not.toHaveBeenCalled();
    expect(d.readLibraryView).not.toHaveBeenCalled();
  });

  it("skips when a full pass already ran on this device", async () => {
    const d = deps({ hasMetaFlag: vi.fn().mockResolvedValue(true) });
    const result = await primeRoutes(d);

    expect(result).toBe("skipped");
    expect(d.requestRoutePrecache).not.toHaveBeenCalled();
  });
});
