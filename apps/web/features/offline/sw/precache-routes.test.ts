import { afterEach, describe, expect, it, vi } from "vitest";

import { requestRoutePrecache } from "./precache-routes";

afterEach(() => {
  vi.unstubAllGlobals();
});

// A fake active worker that replies through the transferred MessagePort with a
// set of cached routes, mimicking the SW's completion ack.
function stubServiceWorkerReplying(cachedFor: (routes: string[]) => string[]) {
  const postMessage = vi.fn(
    (msg: { routes: string[] }, transfer?: Transferable[]) => {
      const port = transfer?.[0] as MessagePort | undefined;
      port?.postMessage({ cached: cachedFor(msg.routes) });
    },
  );
  vi.stubGlobal("navigator", {
    serviceWorker: { ready: Promise.resolve({ active: { postMessage } }) },
  });
  return postMessage;
}

describe("requestRoutePrecache", () => {
  it("posts PRECACHE_ROUTES with a reply port and reports complete when the SW caches all", async () => {
    const postMessage = stubServiceWorkerReplying((routes) => routes);

    const result = await requestRoutePrecache(["/app", "/app/library"]);

    expect(postMessage).toHaveBeenCalledTimes(1);
    const [msg, transfer] = postMessage.mock.calls[0]!;
    expect(msg).toEqual({
      type: "PRECACHE_ROUTES",
      routes: ["/app", "/app/library"],
    });
    expect(transfer).toHaveLength(1); // a MessagePort for the ack
    expect(result).toEqual({ complete: true });
  });

  it("reports incomplete when the SW caches only some routes", async () => {
    stubServiceWorkerReplying(() => ["/app"]); // /app/library not cached

    const result = await requestRoutePrecache(["/app", "/app/library"]);

    expect(result).toEqual({ complete: false });
  });

  it("returns complete without posting when there are no routes", async () => {
    const postMessage = stubServiceWorkerReplying((routes) => routes);

    const result = await requestRoutePrecache([]);

    expect(result).toEqual({ complete: true });
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("returns null when the service worker API is unavailable", async () => {
    vi.stubGlobal("navigator", {});
    await expect(requestRoutePrecache(["/app"])).resolves.toBeNull();
  });

  it("returns null when there is no active worker", async () => {
    vi.stubGlobal("navigator", {
      serviceWorker: { ready: Promise.resolve({ active: null }) },
    });
    await expect(requestRoutePrecache(["/app"])).resolves.toBeNull();
  });
});
