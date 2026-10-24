import { describe, expect, it } from "vitest";
import { resolveCatalogApiBase } from "./catalog-api-base.mjs";

describe("catalog deployment origin", () => {
  it("defaults production to avacatalog.com and development to localhost", () => {
    expect(resolveCatalogApiBase(undefined, true)).toBe(
      "https://avacatalog.com",
    );
    expect(resolveCatalogApiBase(undefined, false)).toBe(
      "http://localhost:4001",
    );
  });
  it("normalizes a configured HTTPS origin", () => {
    expect(resolveCatalogApiBase("https://catalog.example.com/", true)).toBe(
      "https://catalog.example.com",
    );
  });
  it.each([
    "http://avacatalog.com",
    "http://localhost:4001",
    "https://localhost",
    "https://dev.localhost",
    "https://127.0.0.1",
    "https://[::1]",
    "https://0.0.0.0",
    "https://avacatalog.com/api",
    "https://avacatalog.com?x=1",
    "https://avacatalog.com#api",
    "https://user:pass@avacatalog.com",
    "",
    "invalid",
  ])("rejects an invalid production origin: %s", (base) => {
    expect(() => resolveCatalogApiBase(base, true)).toThrow();
  });
  it("allows the explicit local catalog during development", () => {
    expect(resolveCatalogApiBase("http://localhost:4001", false)).toBe(
      "http://localhost:4001",
    );
  });
});
