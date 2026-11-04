import { afterEach, expect, it, vi } from "vitest";
import { postProgress } from "./post-progress";
const write = {
  locator: { chapterId: "chapter", blockId: "paragraph", textOffset: 0 },
  readAt: "2026-11-04T10:00:00Z",
};
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it.each(["fetch", "body"])(
  "aborts and releases a stalled %s within the deadline",
  async (stage) => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, options) => {
        signal = options.signal;
        if (stage === "fetch") return new Promise(() => {});
        return Promise.resolve({ ok: true, json: () => new Promise(() => {}) });
      }),
    );
    const work = postProgress("token", "book", write);
    const failed = expect(work).rejects.toThrow("Request timed out");
    await vi.advanceTimersByTimeAsync(15_000);
    await failed;
    expect(signal?.aborted).toBe(true);
  },
);
