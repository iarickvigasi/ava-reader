import { afterEach, expect, it, vi } from "vitest";
import { fetchMasteryHistory } from "./fetch-mastery-history";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("expires a stuck token and never sends the late request", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("navigator", { onLine: true });
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  let finish!: (token: string) => void;
  const controller = new AbortController();
  const work = fetchMasteryHistory(
    "2026-09-17",
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    controller,
  );
  const result = work.catch((error: unknown) => error);
  await vi.advanceTimersByTimeAsync(15_000);
  expect(await result).toEqual(new Error("Request timed out"));
  finish("late-token");
  await Promise.resolve();
  expect(controller.signal.aborted).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
});
it("expires a stalled history response", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  const controller = new AbortController();
  const result = fetchMasteryHistory(
    "2026-09-17",
    async () => "token",
    controller,
  ).catch((error: unknown) => error);
  await vi.advanceTimersByTimeAsync(15_000);
  expect(await result).toEqual(new Error("Request timed out"));
  expect(controller.signal.aborted).toBe(true);
});
