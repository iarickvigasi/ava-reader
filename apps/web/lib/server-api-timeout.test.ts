import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
import { fetchServerApiResult, fetchServerApiTolerant } from "./server-api";

function pendingUntilAbort(signal?: AbortSignal | null) {
  return new Promise<never>((_, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    signal?.addEventListener("abort", () => reject(signal.reason), {
      once: true,
    });
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  authMock.mockResolvedValue({
    userId: "reader",
    getToken: async () => "token",
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("server API read deadline", () => {
  it("aborts stalled headers and releases the cache fallback within five seconds", async () => {
    let observed: AbortSignal | null | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, init: RequestInit) => {
        observed = init.signal;
        return pendingUntilAbort(observed);
      }),
    );
    let outcome: unknown;
    const pending = fetchServerApiResult("/api/me").then((value) => {
      outcome = value;
    });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(outcome).toEqual({ status: "apiUnavailable" });
    expect(observed?.aborted).toBe(true);
    await pending;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the deadline active until a successful response body is read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init: RequestInit) => ({
        ok: true,
        json: () =>
          pendingUntilAbort(init.signal).catch(() => {
            throw new DOMException("Body read aborted", "AbortError");
          }),
      })),
    );
    const pending = fetchServerApiTolerant("/api/me");
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await pending).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves caller cancellation rather than reporting an API outage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, init: RequestInit) => pendingUntilAbort(init.signal)),
    );
    const controller = new AbortController();
    const reason = new Error("Route cancelled");
    const pending = fetchServerApiResult("/api/me", {
      signal: controller.signal,
    });
    const rejected = expect(pending).rejects.toBe(reason);
    await vi.advanceTimersByTimeAsync(1);
    controller.abort(reason);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([401, 500])(
    "retains HTTP %s even if its error body stalls",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url, init: RequestInit) => ({
          ok: false,
          status,
          json: () => pendingUntilAbort(init.signal),
        })),
      );
      const pending = fetchServerApiResult("/api/me");
      const checked =
        status === 401
          ? expect(pending).resolves.toEqual({ status: "authUnavailable" })
          : expect(pending).rejects.toMatchObject({
              status,
              name: "ServerApiError",
            });
      await vi.advanceTimersByTimeAsync(5_000);
      await checked;
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("clears the deadline after a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ id: "reader" })),
    );
    expect(await fetchServerApiResult("/api/me")).toEqual({
      status: "ready",
      data: { id: "reader" },
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
