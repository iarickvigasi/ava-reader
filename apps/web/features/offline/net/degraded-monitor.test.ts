import { afterEach, expect, it, vi } from "vitest";
import { __resetNetStateForTests, isOnline } from "./net-state";
import { __resetSlowStateForTests, isSlow } from "./slow-state";
import { startNetworkMonitor } from "./start-network-monitor";

let stop: (() => void) | undefined;
afterEach(() => {
  stop?.();
  __resetNetStateForTests();
  __resetSlowStateForTests();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("rechecks a slow but reachable connection after 10s and clears Slow on recovery", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), { visibilityState: "visible" }),
  );
  __resetNetStateForTests();
  __resetSlowStateForTests();
  const fetchMock = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () => resolve(Response.json({ service: "ava-reader-api" })),
            4_000,
          );
        }),
    )
    .mockImplementation(async () =>
      Response.json({ service: "ava-reader-api" }),
    );
  vi.stubGlobal("fetch", fetchMock);
  stop = startNetworkMonitor();
  await vi.advanceTimersByTimeAsync(4_000);
  expect(isSlow()).toBe(true);
  expect(isOnline()).toBe(true);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(isSlow()).toBe(false);
});
