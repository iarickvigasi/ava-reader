import { describe, expect, it, vi } from "vitest";

import { collectAppRoutes } from "./routes";
import { primeRoutes, type PrimeRoutesDeps } from "./prime-routes";

function deps(overrides: Partial<PrimeRoutesDeps> = {}): PrimeRoutesDeps {
  return {
    isOnline: () => true,
    requestRoutePrecache: vi.fn().mockResolvedValue({ complete: true }),
    ...overrides,
  };
}

describe("primeRoutes", () => {
  it("posts the fixed route list and reports done when the SW confirms all cached", async () => {
    const d = deps();
    const result = await primeRoutes(d);

    expect(result).toBe("done");
    expect(d.requestRoutePrecache).toHaveBeenCalledWith(collectAppRoutes());
  });

  it("reports incomplete when the SW confirms only some routes cached", async () => {
    const d = deps({
      requestRoutePrecache: vi.fn().mockResolvedValue({ complete: false }),
    });
    expect(await primeRoutes(d)).toBe("incomplete");
  });

  it("reports incomplete when no ack is available (null)", async () => {
    const d = deps({
      requestRoutePrecache: vi.fn().mockResolvedValue(null),
    });
    expect(await primeRoutes(d)).toBe("incomplete");
  });

  it("skips when offline without touching the worker", async () => {
    const d = deps({ isOnline: () => false });
    const result = await primeRoutes(d);

    expect(result).toBe("skipped");
    expect(d.requestRoutePrecache).not.toHaveBeenCalled();
  });
});
