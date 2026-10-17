import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deferred,
  failedResourcePayload,
  recovery,
  resourceBytes,
} from "./resource-recovery-fixture";
import { createResourceRecovery } from "./resource-recovery";
import { windowImage } from "./fixtures/resource";
import { MAX_RESOURCE_BYTES } from "./owned-resource";

afterEach(() => vi.unstubAllGlobals());
describe("immutable illustration recovery", () => {
  it("keeps the resource byte bound on retry before any dispatch", async () => {
    const payload = failedResourcePayload();
    payload.readerPackage!.book.resources[0].byte_length =
      MAX_RESOURCE_BYTES + 1;
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const store = createResourceRecovery(payload, {
      apiBase: "https://api.example.invalid",
      getToken: async () => "fixture-token",
      isCurrent: () => true,
    });
    expect(await store.retry("image-one")).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("retries the original authenticated resource, deduplicates clicks and publishes exact verified bytes", async () => {
    const response = deferred<Response>(),
      fetcher = vi.fn().mockReturnValue(response.promise);
    vi.stubGlobal("fetch", fetcher);
    const payload = failedResourcePayload(),
      original = JSON.stringify(payload);
    const store = createResourceRecovery(payload, {
      apiBase: "https://api.example.invalid",
      getToken: async () => "fixture-token",
      isCurrent: () => true,
    });
    const first = store.retry("image-one");
    expect(await store.retry("image-one")).toBe(false);
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: "Bearer fixture-token" },
      cache: "no-store",
      redirect: "error",
    });
    response.resolve(new Response(resourceBytes));
    expect(await first).toBe(true);
    expect(store.getSnapshot()["image-one"]).toEqual({
      src: windowImage,
      status: "ready",
    });
    expect(JSON.stringify(payload)).toBe(original);
  });
  it.each([
    Buffer.alloc(resourceBytes.length),
    Buffer.concat([resourceBytes, Buffer.from([0])]),
  ])(
    "refuses substituted bytes on retry without replacing source",
    async (bytes) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(bytes)));
      const store = recovery();
      expect(await store.retry("image-one")).toBe(false);
      expect(store.getSnapshot()["image-one"]).toEqual({
        src: "",
        status: "failed",
      });
    },
  );
  it("keeps retry available after a genuine failure and refuses an unowned retry URL", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(resourceBytes));
    vi.stubGlobal("fetch", fetcher);
    const store = recovery();
    expect(await store.retry("image-one")).toBe(false);
    expect(store.canRetry("image-one")).toBe(true);
    expect(await store.retry("image-one")).toBe(true);
    const payload = failedResourcePayload();
    payload.resourceRequests!["image-one"] = "https://outside.invalid/private";
    const invalid = createResourceRecovery(payload, {
      apiBase: "https://api.example.invalid",
      getToken: async () => "fixture-token",
      isCurrent: () => true,
    });
    expect(await invalid.retry("image-one")).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
