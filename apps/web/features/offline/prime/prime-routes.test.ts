import { describe, expect, it, vi } from "vitest";

import { collectAppRoutes } from "./routes";
import { primeRoutes, type PrimeRoutesDeps } from "./prime-routes";

function deps(overrides: Partial<PrimeRoutesDeps> = {}): PrimeRoutesDeps {
  return {
    isOnline: () => true,
    requestRoutePrecache: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("primeRoutes", () => {
  it("posts the fixed route list (static + shell sentinels) to the worker", async () => {
    const d = deps();
    const result = await primeRoutes(d);

    expect(result).toBe("done");
    expect(d.requestRoutePrecache).toHaveBeenCalledWith(collectAppRoutes());
  });

  it("skips when offline without touching the worker", async () => {
    const d = deps({ isOnline: () => false });
    const result = await primeRoutes(d);

    expect(result).toBe("skipped");
    expect(d.requestRoutePrecache).not.toHaveBeenCalled();
  });
});
