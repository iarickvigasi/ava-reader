import { expect, it } from "vitest";
import {
  dispatchFetch,
  fakeRequest,
  loadServiceWorker,
  ORIGIN,
} from "./sw-test-harness";

it("never intercepts the API probe even when a cached response exists", async () => {
  const sw = loadServiceWorker();
  const cache = await sw.cacheStorage.open("ava-reader-sw-test");
  await cache.put(
    `${ORIGIN}/api/reachability`,
    Response.json({ service: "ava-reader-api" }),
  );
  const response = await dispatchFetch(
    sw.listeners.fetch!,
    fakeRequest("/api/reachability"),
  );
  expect(response).toBeUndefined();
  expect(sw.fetchMock).not.toHaveBeenCalled();
});
