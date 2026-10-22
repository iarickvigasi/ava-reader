import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  checkNetworkReachability,
  isOnline,
  __resetNetStateForTests,
} from "./net-state";
import {
  isSlow,
  __resetSlowStateForTests,
  __reportSlowSignalForTests,
} from "./slow-state";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("navigator", { onLine: true });
  __resetNetStateForTests();
  __resetSlowStateForTests();
});
afterEach(() => {
  __resetNetStateForTests();
  __resetSlowStateForTests();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("shows persistent Slow on a dead uplink and clears it on timely recovery", async () => {
  const fetchMock = vi
    .fn()
    .mockImplementationOnce(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    )
    .mockResolvedValue(Response.json({ service: "ava-reader-api" }));
  vi.stubGlobal("fetch", fetchMock);
  const pending = checkNetworkReachability();
  await vi.advanceTimersByTimeAsync(3_000);
  expect(isSlow()).toBe(true);
  expect(isOnline()).toBe(true);
  __reportSlowSignalForTests();
  await vi.advanceTimersByTimeAsync(6_000);
  await pending;
  expect(isOnline()).toBe(false);
  expect(isSlow()).toBe(true);
  await checkNetworkReachability();
  expect(isOnline()).toBe(true);
  expect(isSlow()).toBe(false);
});

it("a slow successful probe restores sync but retains Slow until a fast probe", async () => {
  let resolve!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    ),
  );
  const pending = checkNetworkReachability();
  await vi.advanceTimersByTimeAsync(3_000);
  resolve(Response.json({ service: "ava-reader-api" }));
  await pending;
  expect(isOnline()).toBe(true);
  expect(isSlow()).toBe(true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ service: "ava-reader-api" })),
  );
  await checkNetworkReachability();
  expect(isSlow()).toBe(false);
});

it("an older probe cannot clear degradation after browser disconnection", async () => {
  let resolve!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    ),
  );
  const pending = checkNetworkReachability();
  await vi.advanceTimersByTimeAsync(3_000);
  window.dispatchEvent(new Event("offline"));
  resolve(Response.json({ service: "ava-reader-api" }));
  await pending;
  expect(isOnline()).toBe(false);
  expect(isSlow()).toBe(true);
});
