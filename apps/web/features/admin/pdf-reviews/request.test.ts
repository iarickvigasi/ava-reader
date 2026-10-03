import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { reviewArtifact, reviewRequest } from "./request";
import type { ReviewFile, ReviewRequest } from "./types";
const bytes = "private source";
const descriptor: ReviewFile = {
  artifactId: "artifact",
  byteLength: Buffer.byteLength(bytes),
  sha256: createHash("sha256").update(bytes).digest("hex"),
  mediaType: "application/pdf",
  url: "/api/admin/pdf-imports/op/review/artifacts/artifact",
};
afterEach(() => vi.unstubAllGlobals());
describe("private review evidence", () => {
  it("loads only exact pinned bytes", async () => {
    const request = vi.fn<ReviewRequest>(async () => new Response(bytes));
    expect(await (await reviewArtifact(request, "op", descriptor)).text()).toBe(
      bytes,
    );
    expect(request).toHaveBeenCalledWith(descriptor.url);
  });
  it.each([NaN, undefined, Infinity, 1.5, 0, 256 * 1024 ** 2 + 1])(
    "refuses malformed size %s before I/O",
    async (size) => {
      const request = vi.fn<ReviewRequest>();
      await expect(
        reviewArtifact(request, "op", {
          ...descriptor,
          byteLength: size as number,
        }),
      ).rejects.toThrow("Invalid review artifact");
      expect(request).not.toHaveBeenCalled();
    },
  );
  it("refuses foreign paths and malformed hashes before I/O", async () => {
    const request = vi.fn<ReviewRequest>();
    for (const patch of [
      { url: "https://example.invalid/evidence" },
      { sha256: "bad" },
      { url: "/api/admin/pdf-imports/other/review/artifacts/artifact" },
    ]) {
      await expect(
        reviewArtifact(request, "op", { ...descriptor, ...patch }),
      ).rejects.toThrow();
    }
    expect(request).not.toHaveBeenCalled();
  });
  it("rejects overflow and same-length corrupted content", async () => {
    await expect(
      reviewArtifact(async () => new Response(bytes + "x"), "op", descriptor),
    ).rejects.toThrow("size mismatch");
    await expect(
      reviewArtifact(
        async () => new Response("x".repeat(bytes.length)),
        "op",
        descriptor,
      ),
    ).rejects.toThrow("hash mismatch");
  });
  it("aborts between token resolution and dispatch", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    const request = reviewRequest(async () => {
      controller.abort();
      return "test";
    }, controller.signal);
    await expect(request("/api/admin/pdf-imports/reviews")).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("never sends credentials to a foreign destination", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const request = reviewRequest(
      async () => "test",
      new AbortController().signal,
    );
    await expect(request("https://example.invalid/private")).rejects.toThrow(
      "Invalid review path",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
