import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { __resetNetStateForTests, isOnline } from "./net-state";
import { startNetworkMonitor } from "./start-network-monitor";

let documentStub: EventTarget & { visibilityState: string };
let fetchMock: ReturnType<typeof vi.fn>;
let stop: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("navigator", { onLine: true });
  documentStub = Object.assign(new EventTarget(), {
    visibilityState: "visible",
  });
  vi.stubGlobal("document", documentStub);
  fetchMock = vi.fn(async () => Response.json({ service: "ava-reader-api" }));
  vi.stubGlobal("fetch", fetchMock);
  __resetNetStateForTests();
});
afterEach(() => {
  stop?.();
  __resetNetStateForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("checks at startup and detects and recovers from an idle outage on timers", async () => {
  stop = startNetworkMonitor();
  await vi.advanceTimersByTimeAsync(0);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fetchMock.mockRejectedValueOnce(new TypeError("offline"));
  await vi.advanceTimersByTimeAsync(30_000);
  expect(isOnline()).toBe(false);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(isOnline()).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it("suspends hidden polling, checks on visibility return, and cleans up", async () => {
  stop = startNetworkMonitor();
  await vi.advanceTimersByTimeAsync(0);
  documentStub.visibilityState = "hidden";
  documentStub.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(60_000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  documentStub.visibilityState = "visible";
  documentStub.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(0);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  stop();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
