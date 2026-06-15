import { describe, expect, it } from "vitest";

import { slugFromPath } from "./app-routes";

describe("slugFromPath", () => {
  it("extracts the slug after the prefix", () => {
    expect(slugFromPath("/app/read/dune-by-frank-herbert", "/app/read/")).toBe(
      "dune-by-frank-herbert",
    );
  });

  it("decodes percent-encoded slugs", () => {
    expect(slugFromPath("/app/read/caf%C3%A9", "/app/read/")).toBe("café");
  });

  it("tolerates a trailing slash", () => {
    expect(slugFromPath("/app/read/dune/", "/app/read/")).toBe("dune");
  });

  it("returns null for a different route, a bare prefix, or extra segments", () => {
    expect(slugFromPath("/app/library", "/app/read/")).toBeNull();
    expect(slugFromPath("/app/read/", "/app/read/")).toBeNull();
    expect(slugFromPath("/app/read/a/b", "/app/read/")).toBeNull();
  });
});
