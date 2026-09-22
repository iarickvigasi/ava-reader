import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TranslationRequestError } from "@/features/offline/buckets/translations";
import { runSentenceDemand } from "./run-sentence-demand";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("active sentence demand", () => {
  it("settles navigation before attempting a request", async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    const pending = runSentenceDemand(request, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(149);
    expect(request).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("retries transient failures twice with increasing delay, then stops", async () => {
    const request = vi
      .fn()
      .mockRejectedValue(new TranslationRequestError("Try later", 503));
    const pending = runSentenceDemand(
      request,
      new AbortController().signal,
    ).catch((error) => error);
    await vi.advanceTimersByTimeAsync(150);
    expect(request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(request).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(request).toHaveBeenCalledTimes(3);
    expect(await pending).toBeInstanceOf(TranslationRequestError);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it.each([400, 403, 409, 422])(
    "does not automatically retry HTTP %i",
    async (status) => {
      const request = vi
        .fn()
        .mockRejectedValue(
          new TranslationRequestError("Invalid request", status),
        );
      const pending = runSentenceDemand(
        request,
        new AbortController().signal,
      ).catch((error) => error);
      await vi.advanceTimersByTimeAsync(150);
      expect(await pending).toBeInstanceOf(TranslationRequestError);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(request).toHaveBeenCalledTimes(1);
    },
  );

  it("retries a transport failure and stops once it succeeds", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue(undefined);
    const pending = runSentenceDemand(request, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(1_150);
    await pending;
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("retries a request deadline without retrying invalid model output", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("Timeout", "TimeoutError"))
      .mockRejectedValueOnce(
        new Error("The translation response did not match this chapter."),
      );
    const pending = runSentenceDemand(
      request,
      new AbortController().signal,
    ).catch((error) => error);
    await vi.advanceTimersByTimeAsync(1_150);
    expect((await pending).message).toContain("did not match");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it.each([0, 150])(
    "cancels abandoned demand after %i ms without further requests",
    async (elapsed) => {
      const request = vi.fn().mockRejectedValue(new TypeError("Offline"));
      const controller = new AbortController();
      const pending = runSentenceDemand(request, controller.signal).catch(
        (error) => error,
      );
      await vi.advanceTimersByTimeAsync(elapsed);
      controller.abort();
      expect((await pending).name).toBe("AbortError");
      await vi.advanceTimersByTimeAsync(60_000);
      expect(request).toHaveBeenCalledTimes(elapsed ? 1 : 0);
    },
  );
});
