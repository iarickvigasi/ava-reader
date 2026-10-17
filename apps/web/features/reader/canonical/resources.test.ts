import { READER_CAPABILITY_HEADERS } from "./headers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { windowImage } from "./fixtures/resource";
import { loadCanonicalResources } from "./resources";
import { canonicalFixture } from "./fixtures/payload";

const bytes = Buffer.from(windowImage.split(",")[1], "base64");
const options = { token: "synthetic", apiBase: "https://api.example.invalid" };
function payload() {
  const value = canonicalFixture();
  value.resourceUrls = {
    "image-one": "/api/library/pdf-imports/operation/artifacts/image",
  };
  return value;
}
afterEach(() => vi.unstubAllGlobals());
describe("owned canonical resource bytes", () => {
  it.each(["artifacts", "resources"])(
    "authenticates owned %s route and verifies image hash",
    async (route) => {
      const fetcher = vi.fn().mockResolvedValue(new Response(bytes));
      vi.stubGlobal("fetch", fetcher);
      const value = payload();
      value.resourceUrls!["image-one"] =
        `/api/library/pdf-imports/operation/${route}/image`;
      const result = await loadCanonicalResources(value, options);
      expect(
        result.status === "READY" && result.resourceUrls?.["image-one"],
      ).toMatch(/^data:image\/png;base64,/);
      expect(fetcher.mock.calls[0][1]).toMatchObject({
        headers: {
          Authorization: "Bearer synthetic",
          ...READER_CAPABILITY_HEADERS,
        },
        redirect: "error",
        cache: "no-store",
      });
    },
  );
  it.each([
    "https://other.invalid/api/library/pdf-imports/op/artifacts/image",
    "/api/private",
  ])(
    "rejects unowned resource route %s without sending credentials",
    async (url) => {
      const value = payload();
      value.resourceUrls!["image-one"] = url;
      const fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      await expect(loadCanonicalResources(value, options)).rejects.toThrow(
        "Invalid owned resource URL",
      );
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it.each([
    Buffer.concat([bytes, Buffer.from([0])]),
    Buffer.alloc(bytes.length),
  ])("refuses length or digest substitution", async (bad) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(bad)));
    await expect(loadCanonicalResources(payload(), options)).rejects.toThrow(
      /mismatch/,
    );
  });
});

it("authenticates separately owned generated-EPUB reimport resources", async () => {
  const value = payload();
  value.resourceUrls!["image-one"] =
    "/api/library/epub-imports/import/resources/image-one";
  const fetcher = vi.fn().mockResolvedValue(new Response(bytes));
  vi.stubGlobal("fetch", fetcher);
  await expect(loadCanonicalResources(value, options)).resolves.toMatchObject({
    status: "READY",
  });
  expect(fetcher.mock.calls[0][1].headers).toMatchObject(
    READER_CAPABILITY_HEADERS,
  );
  value.resourceUrls!["image-one"] =
    "/api/library/epub-imports/import/artifacts/image-one";
  await expect(loadCanonicalResources(value, options)).rejects.toThrow(
    "Invalid owned resource URL",
  );
});
