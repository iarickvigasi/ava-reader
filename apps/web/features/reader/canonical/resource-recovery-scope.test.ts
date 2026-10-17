import { afterEach, describe, expect, it, vi } from "vitest";
import { deferred, recovery, resourceBytes } from "./resource-recovery-fixture";

afterEach(() => vi.unstubAllGlobals());
describe("reader resource session fencing", () => {
  it("rechecks ownership after token resolution and never dispatches a stale request", async () => {
    let current = true;
    const token = deferred<string>(),
      fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const store = recovery(
      () => current,
      () => token.promise,
    );
    const attempt = store.retry("image-one");
    current = false;
    token.resolve("fixture-token");
    expect(await attempt).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
    expect(store.getSnapshot()["image-one"].src).toBe("");
  });
  it("rejects late verified bytes after account/content exit and aborts its request", async () => {
    const response = deferred<Response>(),
      fetcher = vi.fn().mockReturnValue(response.promise);
    vi.stubGlobal("fetch", fetcher);
    const store = recovery(),
      attempt = store.retry("image-one");
    await Promise.resolve();
    const signal = fetcher.mock.calls[0][1].signal;
    store.deactivate();
    response.resolve(new Response(resourceBytes));
    expect(signal.aborted).toBe(true);
    expect(await attempt).toBe(false);
    expect(store.getSnapshot()["image-one"].src).toBe("");
  });
  it("does not publish after ownership changes during the request", async () => {
    let current = true;
    const response = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(response.promise));
    const store = recovery(() => current),
      attempt = store.retry("image-one");
    await Promise.resolve();
    current = false;
    response.resolve(new Response(resourceBytes));
    expect(await attempt).toBe(false);
    expect(store.getSnapshot()["image-one"]).toEqual({
      src: "",
      status: "failed",
    });
  });
  it("survives effect replay without reviving the previous request", async () => {
    const token = deferred<string>(),
      store = recovery(
        () => true,
        () => token.promise,
      );
    const attempt = store.retry("image-one");
    store.deactivate();
    store.activate();
    token.resolve("fixture-token");
    expect(await attempt).toBe(false);
    expect(store.getSnapshot()["image-one"].status).toBe("failed");
  });
});
