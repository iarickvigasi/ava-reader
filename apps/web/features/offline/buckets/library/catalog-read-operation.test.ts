import { afterEach, expect, it, vi } from "vitest";
import { catalogReadOperation } from "./catalog-read-operation";

afterEach(() => vi.useRealTimers());
it("bounds even a stalled auth or hydration promise and aborts the network signal", async () => {
  vi.useFakeTimers();
  let signal: AbortSignal | undefined;
  const read = catalogReadOperation((current) => {
    signal = current;
    return new Promise(() => undefined);
  });
  const result = expect(read).rejects.toMatchObject({ name: "TimeoutError" });
  await vi.advanceTimersByTimeAsync(30_000);
  await result;
  expect(signal?.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
it("rejects cancellation even when the pending operation ignores its signal", async () => {
  const controller = new AbortController();
  const read = catalogReadOperation(
    () => new Promise(() => undefined),
    controller.signal,
  );
  controller.abort();
  await expect(read).rejects.toMatchObject({ name: "AbortError" });
});
it("does not start an already-cancelled acquisition", async () => {
  const controller = new AbortController();
  controller.abort();
  const run = vi.fn();
  await expect(
    catalogReadOperation(run, controller.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(run).not.toHaveBeenCalled();
});
