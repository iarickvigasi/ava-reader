import { afterEach, expect, it, vi } from "vitest";
import { startClerkRecovery } from "./recover-clerk";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("retries failed script initialization on reconnect without remounting", async () => {
  vi.useFakeTimers();
  const target = new EventTarget();
  vi.stubGlobal("window", target);
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), { visibilityState: "visible" }),
  );
  const network = { onLine: false };
  vi.stubGlobal("navigator", network);
  const clerk = {
    loaded: false,
    status: "error",
    getEntryChunks: vi.fn(async () => {
      clerk.loaded = true;
    }),
  };
  const stop = startClerkRecovery(clerk);
  expect(clerk.getEntryChunks).not.toHaveBeenCalled();
  network.onLine = true;
  target.dispatchEvent(new Event("online"));
  await vi.advanceTimersByTimeAsync(1);
  expect(clerk.getEntryChunks).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(clerk.getEntryChunks).toHaveBeenCalledOnce();
  stop();
});
it("deduplicates wakes during recovery, backs off, and cleans up", async () => {
  vi.useFakeTimers();
  const target = new EventTarget();
  vi.stubGlobal("window", target);
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), { visibilityState: "visible" }),
  );
  vi.stubGlobal("navigator", { onLine: true });
  let finish!: () => void;
  const clerk = {
    loaded: false,
    status: "error",
    getEntryChunks: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    ),
  };
  const stop = startClerkRecovery(clerk);
  target.dispatchEvent(new Event("online"));
  expect(clerk.getEntryChunks).toHaveBeenCalledOnce();
  finish();
  await vi.advanceTimersByTimeAsync(2_000);
  expect(clerk.getEntryChunks).toHaveBeenCalledTimes(2);
  stop();
  finish();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(clerk.getEntryChunks).toHaveBeenCalledTimes(2);
});
