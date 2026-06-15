import { describe, expect, it } from "vitest";

import {
  SHELL_ROUTE_SENTINELS,
  STATIC_APP_ROUTES,
  collectAppRoutes,
} from "./routes";

describe("collectAppRoutes", () => {
  it("returns the static routes plus one shell sentinel per per-entity family", () => {
    expect(collectAppRoutes()).toEqual([
      ...STATIC_APP_ROUTES,
      ...SHELL_ROUTE_SENTINELS,
    ]);
  });

  it("covers each per-entity family with a __shell__ sentinel", () => {
    expect(SHELL_ROUTE_SENTINELS).toEqual([
      "/app/read/__shell__",
      "/app/library/books/__shell__",
      "/app/library/collections/__shell__",
    ]);
  });
});
