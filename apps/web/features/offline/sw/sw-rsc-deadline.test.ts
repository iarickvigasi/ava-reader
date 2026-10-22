import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  dispatchFetch,
  fakeRequest,
  loadServiceWorker,
  ORIGIN,
  RSC_NAV_HEADERS,
} from "./sw-test-harness";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("bounds a hanging RSC request and then serves the cached reader document", async () => {
  const sw = loadServiceWorker();
  const cache = await sw.cacheStorage.open("ava-reader-sw-test");
  await cache.put(
    `${ORIGIN}/app/read/__shell__?__sw=doc`,
    new Response("READER"),
  );
  sw.fetchMock.mockReturnValue(new Promise(() => {}));
  const pending = dispatchFetch(
    sw.listeners.fetch!,
    fakeRequest("/app/read/book", { headers: RSC_NAV_HEADERS }),
  );
  const failure = expect(pending).rejects.toThrow("RSC navigation timed out");
  await vi.advanceTimersByTimeAsync(3_000);
  await failure;
  expect(sw.clientPostMessage).toHaveBeenCalledWith({
    type: "AVA_SLOW_CONNECTION",
  });
  const fallback = dispatchFetch(
    sw.listeners.fetch!,
    fakeRequest("/app/read/book", { mode: "navigate" }),
  );
  await vi.advanceTimersByTimeAsync(3_000);
  expect(await (await fallback)?.text()).toBe("READER");
  expect(await cache.keys()).toEqual([`${ORIGIN}/app/read/__shell__?__sw=doc`]);
});

it("preserves a fast RSC redirect without caching it", async () => {
  const sw = loadServiceWorker();
  sw.fetchMock.mockResolvedValue(
    new Response(null, { status: 307, headers: { location: "/sign-in" } }),
  );
  const response = await dispatchFetch(
    sw.listeners.fetch!,
    fakeRequest("/app/library", { headers: RSC_NAV_HEADERS }),
  );
  expect(response?.status).toBe(307);
  expect(sw.clientPostMessage).not.toHaveBeenCalled();
});
