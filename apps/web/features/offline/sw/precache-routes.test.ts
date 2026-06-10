import { afterEach, describe, expect, it, vi } from "vitest";

import { requestRoutePrecache } from "./precache-routes";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubServiceWorker(active: { postMessage: (msg: unknown) => void } | null) {
  vi.stubGlobal("navigator", {
    serviceWorker: { ready: Promise.resolve({ active }) },
  });
}

describe("requestRoutePrecache", () => {
  it("posts a PRECACHE_ROUTES message to the active worker", async () => {
    const postMessage = vi.fn();
    stubServiceWorker({ postMessage });

    await requestRoutePrecache(["/app", "/app/library"]);

    expect(postMessage).toHaveBeenCalledWith({
      type: "PRECACHE_ROUTES",
      routes: ["/app", "/app/library"],
    });
  });

  it("does nothing when there are no routes", async () => {
    const postMessage = vi.fn();
    stubServiceWorker({ postMessage });

    await requestRoutePrecache([]);

    expect(postMessage).not.toHaveBeenCalled();
  });

  it("no-ops when the service worker API is unavailable", async () => {
    vi.stubGlobal("navigator", {});
    await expect(requestRoutePrecache(["/app"])).resolves.toBeUndefined();
  });

  it("no-ops when there is no active worker", async () => {
    stubServiceWorker(null);
    await expect(requestRoutePrecache(["/app"])).resolves.toBeUndefined();
  });
});
