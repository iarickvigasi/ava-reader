import { afterEach, expect, it, vi } from "vitest";
import { retryClerkInitialization } from "./retry-clerk-initialization";

afterEach(() => vi.unstubAllGlobals());
const uiFailure = { code: "failed_to_load_clerk_ui" };
const publishableKey = `pk_live_${btoa("clerk.avareader.space$")}`;

it("recovers the failed Safari URL and restores options before initialization", async () => {
  vi.stubGlobal("window", {
    location: { href: "https://avareader.space/app" },
  });
  const options = { publishableKey };
  const urls: (string | undefined)[] = [];
  const clerk = {
    loaded: false,
    options,
    getClerkUIEntryChunk: vi.fn(async () => {
      urls.push(Reflect.get(options, "__internal_clerkUIUrl"));
      if (urls.length === 1) throw uiFailure;
    }),
    getEntryChunks: vi.fn(async () => {
      expect(options).not.toHaveProperty("__internal_clerkUIUrl");
      clerk.loaded = true;
    }),
  };
  await retryClerkInitialization(clerk);
  expect(urls[0]).toBeUndefined();
  const fresh = new URL(urls[1]!);
  expect(fresh.origin).toBe("https://clerk.avareader.space");
  expect(fresh.pathname).toBe("/npm/@clerk/ui@1/dist/ui.browser.js");
  expect(fresh.searchParams.has("ava_clerk_retry")).toBe(true);
  expect(clerk.loaded).toBe(true);
  expect(clerk.getClerkUIEntryChunk).toHaveBeenCalledTimes(2);
});

it("keeps the normal path when UI loading succeeds or is disabled by Clerk", async () => {
  const getEntryChunks = vi.fn();
  const loader = vi.fn().mockResolvedValue(undefined);
  await retryClerkInitialization({
    loaded: false,
    options: { publishableKey },
    getClerkUIEntryChunk: loader,
    getEntryChunks,
  });
  expect(loader).toHaveBeenCalledOnce();
  expect(getEntryChunks).toHaveBeenCalledOnce();
});

it.each([undefined, "/auth/ui.js"])(
  "restores %s after a failed fresh retry",
  async (url) => {
    vi.stubGlobal("window", {
      location: { href: "https://avareader.space/app" },
    });
    const options = {
      publishableKey,
      ...(url ? { __internal_clerkUIUrl: url } : {}),
    };
    const loader = vi.fn().mockRejectedValue(uiFailure);
    const getEntryChunks = vi.fn();
    await expect(
      retryClerkInitialization({
        loaded: false,
        options,
        getClerkUIEntryChunk: loader,
        getEntryChunks,
      }),
    ).rejects.toBe(uiFailure);
    expect(loader).toHaveBeenCalledTimes(2);
    expect(options.__internal_clerkUIUrl).toBe(url);
    if (!url) expect(options).not.toHaveProperty("__internal_clerkUIUrl");
    expect(getEntryChunks).not.toHaveBeenCalled();
  },
);

it("does not substitute URLs for unrelated initialization failures", async () => {
  const error = new Error("another failure");
  const loader = vi.fn().mockRejectedValue(error);
  await expect(
    retryClerkInitialization({
      loaded: false,
      options: { publishableKey },
      getClerkUIEntryChunk: loader,
    }),
  ).rejects.toBe(error);
  expect(loader).toHaveBeenCalledOnce();
});
