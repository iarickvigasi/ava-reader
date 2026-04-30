import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetPreferencesStoreForTests,
  fetchPreferences,
  getCachedPreference,
  patchPreference,
  subscribePreference,
} from "./preferences-store";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

beforeEach(() => {
  __resetPreferencesStoreForTests();
  process.env.NEXT_PUBLIC_API_BASE_URL = "http://api.test";
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  process.env.NEXT_PUBLIC_API_BASE_URL = ORIGINAL_API_BASE_URL;
});

describe("fetchPreferences", () => {
  it("issues a single network call when called concurrently", async () => {
    const json = vi.fn().mockResolvedValue({ translateTargetLang: "Spanish" });
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json });
    globalThis.fetch = fetchSpy as never;

    const getToken = vi.fn().mockResolvedValue("token-1");

    const [a, b, c] = await Promise.all([
      fetchPreferences(getToken),
      fetchPreferences(getToken),
      fetchPreferences(getToken),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://api.test/api/me/preferences",
      expect.objectContaining({
        headers: { Authorization: "Bearer token-1" },
      }),
    );
    expect(a).toEqual({ translateTargetLang: "Spanish" });
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("returns the cached payload on subsequent calls without re-fetching", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ fontScale: 1.2 }),
    });
    globalThis.fetch = fetchSpy as never;
    const getToken = vi.fn().mockResolvedValue("token-1");

    await fetchPreferences(getToken);
    await fetchPreferences(getToken);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(getCachedPreference("fontScale")).toBe(1.2);
  });

  it("returns an empty payload when no auth token is available", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as never;
    const getToken = vi.fn().mockResolvedValue(null);

    await expect(fetchPreferences(getToken)).resolves.toEqual({});
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns an empty payload when the network call rejects", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error("offline")) as never;
    const getToken = vi.fn().mockResolvedValue("token-1");

    await expect(fetchPreferences(getToken)).resolves.toEqual({});
  });

  it("notifies subscribers for fields present in the response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ translateTargetLang: "German", fontScale: 1.1 }),
    }) as never;
    const getToken = vi.fn().mockResolvedValue("token-1");

    const langListener = vi.fn();
    const goalListener = vi.fn();
    subscribePreference("translateTargetLang", langListener);
    subscribePreference("readingGoalMinutes", goalListener);

    await fetchPreferences(getToken);

    expect(langListener).toHaveBeenCalledTimes(1);
    expect(goalListener).not.toHaveBeenCalled();
  });
});

describe("patchPreference", () => {
  it("updates the cache optimistically and PATCHes the API", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchSpy as never;
    const getToken = vi.fn().mockResolvedValue("token-1");

    await patchPreference(getToken, "translateTargetLang", "Italian");

    expect(getCachedPreference("translateTargetLang")).toBe("Italian");
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://api.test/api/me/preferences",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ translateTargetLang: "Italian" }),
      }),
    );
  });

  it("notifies subscribers immediately, before the network call resolves", async () => {
    let resolveFetch!: (value: unknown) => void;
    globalThis.fetch = vi.fn(
      () => new Promise((resolve) => (resolveFetch = resolve)),
    ) as never;
    const getToken = vi.fn().mockResolvedValue("token-1");

    const listener = vi.fn();
    subscribePreference("fontScale", listener);

    const inflight = patchPreference(getToken, "fontScale", 1.2);
    // Microtask drain — the optimistic update fires synchronously inside
    // the promise body, before the fetch promise has been awaited.
    await Promise.resolve();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getCachedPreference("fontScale")).toBe(1.2);

    resolveFetch({ ok: true });
    await inflight;
  });

  it("swallows network failures so the caller's optimistic update stands", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("offline")) as never;
    const getToken = vi.fn().mockResolvedValue("token-1");

    await expect(
      patchPreference(getToken, "fontScale", 1.3),
    ).resolves.toBeUndefined();
    expect(getCachedPreference("fontScale")).toBe(1.3);
  });
});

describe("subscribePreference", () => {
  it("returns an unsubscribe function that removes the listener", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ translateTargetLang: "Greek" }),
    }) as never;
    const getToken = vi.fn().mockResolvedValue("token-1");

    const listener = vi.fn();
    const unsubscribe = subscribePreference("translateTargetLang", listener);
    unsubscribe();

    await fetchPreferences(getToken);

    expect(listener).not.toHaveBeenCalled();
  });
});
