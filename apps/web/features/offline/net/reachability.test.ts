import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  __resetNetStateForTests,
  checkNetworkReachability,
  isOnline,
  subscribeToNetworkState,
} from "./net-state";

let windowStub: EventTarget;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  windowStub = new EventTarget();
  vi.stubGlobal("window", windowStub);
  vi.stubGlobal("navigator", { onLine: true });
  fetchMock = vi.fn(async () => Response.json({ service: "ava-reader-api" }));
  vi.stubGlobal("fetch", fetchMock);
  __resetNetStateForTests();
});
afterEach(() => {
  __resetNetStateForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("detects dead uplinks and confirms recovery without a browser event", async () => {
  const seen: boolean[] = [];
  subscribeToNetworkState((value) => seen.push(value));
  fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  await checkNetworkReachability();
  expect(isOnline()).toBe(false);
  await checkNetworkReachability();
  expect(seen).toEqual([false, true]);
  expect(fetchMock).toHaveBeenLastCalledWith(
    expect.stringContaining("/api/reachability"),
    expect.objectContaining({
      cache: "no-store",
      redirect: "error",
      credentials: "omit",
    }),
  );
});

it.each(["<html>Sign in to Wi-Fi</html>", '{"service":"other"}', "null"])(
  "rejects portal content: %s",
  async (body) => {
    fetchMock.mockResolvedValueOnce(new Response(body));
    await checkNetworkReachability();
    expect(isOnline()).toBe(false);
  },
);

it("does not mark an HTTP error offline or treat it as confirmed recovery", async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
  await checkNetworkReachability();
  expect(isOnline()).toBe(true);
  windowStub.dispatchEvent(new Event("offline"));
  await checkNetworkReachability();
  expect(isOnline()).toBe(false);
});

it("shares concurrent checks and ignores a success arriving after browser offline", async () => {
  let resolve!: (response: Response) => void;
  fetchMock.mockReturnValue(
    new Promise<Response>((done) => {
      resolve = done;
    }),
  );
  const request = checkNetworkReachability();
  expect(checkNetworkReachability()).toBe(request);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  windowStub.dispatchEvent(new Event("offline"));
  resolve(Response.json({ service: "ava-reader-api" }));
  await request;
  expect(isOnline()).toBe(false);
});

it("times out a hanging probe and permits a later retry", async () => {
  fetchMock.mockImplementationOnce(
    (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      }),
  );
  const request = checkNetworkReachability();
  await vi.advanceTimersByTimeAsync(5_000);
  await request;
  expect(isOnline()).toBe(false);
  await checkNetworkReachability();
  expect(isOnline()).toBe(true);
});

it("does not probe while the browser reports offline", async () => {
  vi.stubGlobal("navigator", { onLine: false });
  await checkNetworkReachability();
  expect(isOnline()).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});
