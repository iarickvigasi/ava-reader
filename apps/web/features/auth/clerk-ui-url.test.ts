import { afterEach, expect, it, vi } from "vitest";
import { retryClerkInitialization } from "./retry-clerk-initialization";

afterEach(() => vi.unstubAllGlobals());
const uiFailure = { code: "failed_to_load_clerk_ui" };
const publishableKey = `pk_live_${btoa("clerk.avareader.space$")}`;

it("lets Clerk choose a configured proxy and UI version", async () => {
  vi.stubGlobal("window", {
    location: { href: "https://avareader.space/app" },
  });
  const options = {
    publishableKey,
    proxyUrl: "/clerk-proxy",
    __internal_clerkUIVersion: "1.42.0",
  };
  const loader = vi
    .fn()
    .mockRejectedValueOnce(uiFailure)
    .mockImplementation(async () => {
      const url = new URL(Reflect.get(options, "__internal_clerkUIUrl"));
      expect(url.pathname).toBe(
        "/clerk-proxy/npm/@clerk/ui@1.42.0/dist/ui.browser.js",
      );
      expect(url.searchParams.has("ava_clerk_retry")).toBe(true);
    });
  await retryClerkInitialization({
    loaded: false,
    options,
    getClerkUIEntryChunk: loader,
  });
});

it("preserves an explicit relative URL, query and fragment", async () => {
  vi.stubGlobal("window", {
    location: { href: "https://avareader.space/app" },
  });
  const options = {
    publishableKey,
    __internal_clerkUIUrl: "/auth/ui.js?version=1#asset",
  };
  const original = options.__internal_clerkUIUrl;
  const loader = vi
    .fn()
    .mockRejectedValueOnce(uiFailure)
    .mockImplementation(async () => {
      const url = new URL(options.__internal_clerkUIUrl);
      expect(url.origin).toBe("https://avareader.space");
      expect(url.pathname).toBe("/auth/ui.js");
      expect(url.searchParams.get("version")).toBe("1");
      expect(url.hash).toBe("#asset");
    });
  await retryClerkInitialization({
    loaded: false,
    options,
    getClerkUIEntryChunk: loader,
  });
  expect(options.__internal_clerkUIUrl).toBe(original);
});
