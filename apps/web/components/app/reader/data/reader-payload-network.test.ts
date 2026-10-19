import { afterEach, expect, it, vi } from "vitest";
import { ReaderPayloadError } from "./reader-payload-error";
import { fetchReaderPayloadFromNetwork } from "./reader-payload-network";

const resources = vi.hoisted(() => vi.fn(async (payload: unknown) => payload));
vi.mock("@/features/reader/canonical/resources", () => ({
  loadCanonicalResources: resources,
}));
vi.mock("./reader-request", () => ({
  buildReaderUrl: () => new URL("https://reader.test/api/library/owned/reader"),
  withAuthHeader: (_token: string, headers: unknown) => headers,
}));
const input = {
  libraryItemId: "owned",
  isLoaded: true,
  isSignedIn: true,
  getToken: async () => "test-only-token",
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("retains only the exact compatibility code on HTTP 409 without exposing server text", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "PDF_READER_UPGRADE_REQUIRED",
          message: "private diagnostics",
        }),
        { status: 409 },
      ),
    );
  vi.stubGlobal("fetch", fetch);
  const error = await fetchReaderPayloadFromNetwork(input).catch(
    (error: unknown) => error,
  );
  expect(error).toBeInstanceOf(ReaderPayloadError);
  expect(error).toMatchObject({
    status: 409,
    code: "PDF_READER_UPGRADE_REQUIRED",
  });
  expect((error as Error).message).not.toContain("private diagnostics");
  expect(resources).not.toHaveBeenCalled();
});
it.each([
  [409, "not json"],
  [409, "null"],
  [409, JSON.stringify({ code: "PDF_BOOK_NOT_READY" })],
  [409, JSON.stringify({ code: ["PDF_READER_UPGRADE_REQUIRED"] })],
  [500, JSON.stringify({ code: "PDF_READER_UPGRADE_REQUIRED" })],
])("leaves HTTP %i with body %s generic", async (status, body) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(body, { status })),
  );
  await expect(fetchReaderPayloadFromNetwork(input)).rejects.toMatchObject({
    status,
    code: undefined,
  });
  expect(resources).not.toHaveBeenCalled();
});
it("continues normal resource loading for a successful payload", async () => {
  const payload = { status: "READY", book: { libraryItemId: "owned" } };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))),
  );
  await expect(fetchReaderPayloadFromNetwork(input)).resolves.toEqual(payload);
  expect(resources).toHaveBeenCalledOnce();
});
