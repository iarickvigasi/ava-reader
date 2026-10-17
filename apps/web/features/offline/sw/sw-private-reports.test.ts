import { expect, it, vi } from "vitest";
import {
  dispatchFetch,
  fakeRequest,
  loadServiceWorker,
  ORIGIN,
} from "./sw-test-harness";

it("never caches or serves private report navigations, even with an old cache entry", async () => {
  const sw = loadServiceWorker(),
    cache = await sw.cacheStorage.open("ava-reader-sw-test");
  await cache.put(
    `${ORIGIN}/app/admin/pdf-reports?__sw=doc`,
    new Response("PRIVATE"),
  );
  sw.fetchMock.mockRejectedValue(new Error("offline"));
  for (const path of [
    "/app/admin/pdf-reports?kind=conversionId&reference=one",
    "/app/admin/pdf-reports/export",
  ]) {
    expect(
      await dispatchFetch(
        sw.listeners.fetch!,
        fakeRequest(path, { mode: "navigate" }),
      ),
    ).toBeUndefined();
  }
  expect(sw.fetchMock).not.toHaveBeenCalled();
});
it("excludes reports from route precache while retaining the ordinary library route", async () => {
  const sw = loadServiceWorker(),
    reply = vi.fn();
  sw.fetchMock.mockResolvedValue(new Response("PUBLIC_SHELL"));
  let work: Promise<unknown> | undefined;
  sw.listeners.message!({
    data: {
      type: "PRECACHE_ROUTES",
      routes: [
        `${ORIGIN}/app/admin/pdf-reports`,
        `${ORIGIN}/app/library`,
        "http://[",
      ],
    },
    ports: [{ postMessage: reply }],
    waitUntil: (value: Promise<unknown>) => {
      work = value;
    },
  });
  await work;
  expect(reply).toHaveBeenCalledWith({ cached: [`${ORIGIN}/app/library`] });
  expect(sw.fetchMock.mock.calls.map(([request]) => request.url)).toEqual([
    `${ORIGIN}/app/library`,
  ]);
});
it("retains the pre-existing API bypass for report data even when a cache entry exists", async () => {
  const sw = loadServiceWorker(),
    path = "/api/admin/pdf-reports?reference=one";
  const cache = await sw.cacheStorage.open("ava-reader-sw-test");
  await cache.put(`${ORIGIN}${path}`, new Response("PRIVATE"));
  expect(
    await dispatchFetch(sw.listeners.fetch!, fakeRequest(path)),
  ).toBeUndefined();
  expect(sw.fetchMock).not.toHaveBeenCalled();
});
