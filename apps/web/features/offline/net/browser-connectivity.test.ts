import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  isBrowserOnline,
  subscribeToBrowserConnectivity,
} from "./browser-connectivity";
import {
  __resetNetStateForTests,
  checkNetworkReachability,
  isOnline,
} from "./net-state";

let cleanup: (() => void) | undefined;
beforeEach(() => {
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("navigator", { onLine: true });
  __resetNetStateForTests();
});
afterEach(() => {
  cleanup?.();
  __resetNetStateForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("keeps browser connectivity online through API failure and recovery", async () => {
  const seen = vi.fn();
  cleanup = subscribeToBrowserConnectivity(seen);
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("Failed to fetch"));
  vi.stubGlobal("fetch", fetchMock);
  await checkNetworkReachability();
  expect(isOnline()).toBe(false);
  expect(isBrowserOnline()).toBe(true);
  fetchMock.mockResolvedValue(Response.json({ service: "ava-reader-api" }));
  await checkNetworkReachability();
  expect(isOnline()).toBe(true);
  expect(seen).not.toHaveBeenCalled();
});

it("does not report browser offline when the probe times out", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    ),
  );
  const request = checkNetworkReachability();
  await vi.advanceTimersByTimeAsync(5_000);
  await request;
  expect(isOnline()).toBe(false);
  expect(isBrowserOnline()).toBe(true);
});

it("reports browser disconnect and reconnect immediately, and unsubscribes", () => {
  const seen: boolean[] = [];
  cleanup = subscribeToBrowserConnectivity((online) => seen.push(online));
  vi.stubGlobal("navigator", { onLine: false });
  window.dispatchEvent(new Event("offline"));
  expect(isBrowserOnline()).toBe(false);
  vi.stubGlobal("navigator", { onLine: true });
  window.dispatchEvent(new Event("online"));
  expect(isBrowserOnline()).toBe(true);
  expect(seen).toEqual([false, true]);
  cleanup();
  window.dispatchEvent(new Event("offline"));
  expect(seen).toEqual([false, true]);
});
