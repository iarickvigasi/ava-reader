import { afterEach, describe, expect, it, vi } from "vitest";
import { loadCanonicalResources } from "./resources";
import { canonicalPayload } from "./payload";
import { requireCompleteCanonicalResources } from "./resource-completeness";
import {
  networkResourcePayload,
  resourceOptions,
} from "./resource-recovery-fixture";

afterEach(() => vi.unstubAllGlobals());
describe("missing accepted illustration availability", () => {
  it.each(["http", "network"])(
    "keeps exact readable content on %s loss without offline completeness",
    async (kind) => {
      const payload = networkResourcePayload(),
        original = JSON.stringify(payload.readerPackage);
      vi.stubGlobal(
        "fetch",
        kind === "http"
          ? vi.fn().mockResolvedValue(new Response(null, { status: 404 }))
          : vi.fn().mockRejectedValue(new TypeError("Network unavailable")),
      );
      const result = await loadCanonicalResources(payload, resourceOptions);
      if (result.status !== "READY") throw new Error("Expected readable text");
      expect(JSON.stringify(result.readerPackage)).toBe(original);
      expect(result.resourceFailures).toEqual(["image-one"]);
      expect(result.resourceUrls?.["image-one"]).toBe("");
      expect(
        result.chapters[0].blocks.filter((b) => b.kind !== "image"),
      ).toEqual(payload.chapters[0].blocks.filter((b) => b.kind !== "image"));
      expect(
        result.chapters[0].blocks.find((b) => b.kind === "image"),
      ).toMatchObject({
        resourceId: "image-one",
        width: 32,
        height: 20,
        src: "",
      });
      expect(() => requireCompleteCanonicalResources(result)).toThrow(
        "incomplete",
      );
    },
  );
  it("prevalidates all destinations before sending any credential", async () => {
    const payload = networkResourcePayload();
    const first = payload.readerPackage!.book.resources[0];
    payload.readerPackage!.book.resources.push({ ...first, id: "second" });
    payload.resourceUrls!["second"] = "https://outside.invalid/private";
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      loadCanonicalResources(payload, resourceOptions),
    ).rejects.toThrow("Invalid owned");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not treat abort or an undeclared missing resource as availability", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      loadCanonicalResources(networkResourcePayload(), {
        ...resourceOptions,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).not.toHaveBeenCalled();
    const payload = networkResourcePayload();
    payload.resourceUrls!["image-one"] = "";
    expect(() => canonicalPayload(payload)).toThrow("availability");
  });
});
