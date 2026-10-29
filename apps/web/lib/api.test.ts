import { afterEach, expect, it, vi } from "vitest";
import { resolveApiAssetUrl } from "./api";
afterEach(() => vi.unstubAllEnvs());
it("resolves Catalog covers on localhost and behind the production prefix", () => {
  vi.stubEnv("NEXT_PUBLIC_CATALOG_API_BASE_URL", "http://localhost:4001");
  expect(resolveApiAssetUrl("/catalog/api/edition-covers/id")).toBe(
    "http://localhost:4001/api/edition-covers/id",
  );
  vi.stubEnv("NEXT_PUBLIC_CATALOG_API_BASE_URL", "/catalog");
  expect(resolveApiAssetUrl("/catalog/api/edition-covers/id")).toBe(
    "/catalog/api/edition-covers/id",
  );
  expect(resolveApiAssetUrl("https://example.org/cover.jpg")).toBe(
    "https://example.org/cover.jpg",
  );
  expect(resolveApiAssetUrl(null)).toBeNull();
});
