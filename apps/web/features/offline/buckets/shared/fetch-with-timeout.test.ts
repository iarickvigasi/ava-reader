import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchWithTimeout } from "./fetch-with-timeout";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("fetchWithTimeout", () => {
  it("resolves with the response when fetch beats the timeout", async () => {
    const response = { ok: true } as Response;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response),
    );

    await expect(fetchWithTimeout("/x", {}, 5_000)).resolves.toBe(response);
  });

  it("rejects once the timeout elapses, even if fetch never settles", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<never>(() => {})),
    );

    const result = fetchWithTimeout("/x", {}, 5_000);
    // Pre-attach a no-op handler so Node doesn't report an unhandled
    // rejection the instant the fake timer fires below — the real
    // assertion still runs after, as an independent listener on the
    // same promise.
    result.catch(() => {});
    await vi.advanceTimersByTimeAsync(5_000);
    expect(result).rejects.toThrow("timeout");
  });

  it("aborts the real request via the signal passed to fetch", async () => {
    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<never>>(
      () => new Promise(() => {}),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = fetchWithTimeout("/x", {}, 5_000);
    // Pre-attach a no-op handler so Node doesn't report an unhandled
    // rejection the instant the fake timer fires below — the real
    // assertion still runs after, as an independent listener on the
    // same promise.
    result.catch(() => {});
    await vi.advanceTimersByTimeAsync(5_000);
    expect(result).rejects.toThrow();

    const signal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;
    expect(signal.aborted).toBe(true);
  });
});
