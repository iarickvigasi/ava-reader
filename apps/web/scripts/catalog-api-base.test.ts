import { describe, expect, it } from "vitest";
import { resolveCatalogApiBase } from "./catalog-api-base.mjs";

describe("catalog deployment base", () => {
  it("defaults production to the same-domain gateway and development to localhost", () => {
    expect(resolveCatalogApiBase(undefined, true)).toBe("/catalog");
    expect(resolveCatalogApiBase(undefined, false)).toBe(
      "http://localhost:4001",
    );
  });
  it.each(["/catalog", "/catalog/"])(
    "accepts the same-domain base: %s",
    (base) => {
      expect(resolveCatalogApiBase(base, true)).toBe("/catalog");
    },
  );
  it("normalizes a configured HTTPS origin", () => {
    expect(resolveCatalogApiBase("https://catalog.example.com/", true)).toBe(
      "https://catalog.example.com",
    );
  });
  it.each([
    "http://catalog.example.com",
    "http://localhost:4001",
    "https://localhost",
    "https://dev.localhost",
    "https://127.0.0.1",
    "https://[::1]",
    "https://0.0.0.0",
    "https://catalog.example.com/api",
    "https://catalog.example.com?x=1",
    "https://catalog.example.com#api",
    "https://user:pass@catalog.example.com",
    "",
    "invalid",
    "//catalog.example.com",
    "/catalog/api",
    "/catalog?host=other",
    "/catalog#api",
    "/catalog/../api",
    "/api",
  ])("rejects an invalid production origin: %s", (base) => {
    expect(() => resolveCatalogApiBase(base, true)).toThrow();
  });
  it("allows the explicit local catalog during development", () => {
    expect(resolveCatalogApiBase("http://localhost:4001", false)).toBe(
      "http://localhost:4001",
    );
  });
});
