import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requestWithDeadline } from "./request-with-deadline";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("translation request deadline", () => {
  it("aborts stalled response bodies after sixty seconds", async () => {
    let requestSignal: AbortSignal | null = null;
    const request = requestWithDeadline((signal) => {
      requestSignal = signal;
      return new Promise<never>(() => {});
    }, new AbortController().signal).catch((error) => error);
    await vi.advanceTimersByTimeAsync(60_000);
    expect((await request).name).toBe("TimeoutError");
    expect((requestSignal as AbortSignal | null)?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ends immediately when the reader abandons a request", async () => {
    const controller = new AbortController();
    const request = requestWithDeadline(
      () => new Promise<never>(() => {}),
      controller.signal,
    ).catch((error) => error);
    controller.abort();
    expect((await request).name).toBe("AbortError");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up the timeout after a completed response", async () => {
    expect(
      await requestWithDeadline(
        async () => "complete",
        new AbortController().signal,
      ),
    ).toBe("complete");
    expect(vi.getTimerCount()).toBe(0);
  });
});
