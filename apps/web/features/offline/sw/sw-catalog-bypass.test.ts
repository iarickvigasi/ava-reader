import { describe, expect, it } from "vitest";
import {
  dispatchFetch,
  fakeRequest,
  loadServiceWorker,
  ORIGIN,
} from "./sw-test-harness";

describe("same-origin catalog API", () => {
  it.each([
    "/catalog/api/works?limit=1",
    "/catalog/api/works/filters",
    "/catalog/api/authors/123",
  ])(
    "bypasses the service worker even with a cached response: %s",
    async (path) => {
      const sw = loadServiceWorker();
      const cache = await sw.cacheStorage.open("ava-reader-sw-test");
      await cache.put(`${ORIGIN}${path}`, new Response("stale catalog data"));

      const response = await dispatchFetch(
        sw.listeners.fetch!,
        fakeRequest(path),
      );

      expect(response).toBeUndefined();
      expect(sw.fetchMock).not.toHaveBeenCalled();
      expect(await (await cache.match(`${ORIGIN}${path}`))?.text()).toBe(
        "stale catalog data",
      );
    },
  );
});
