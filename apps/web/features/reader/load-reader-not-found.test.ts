import { expect, it, vi } from "vitest";
import { ReaderPayloadError } from "@/components/app/reader/data/reader-payload-error";
import { loadReaderForSlug } from "./load-reader-for-slug";

it.each([null, "known-id"])(
  "reports confirmed 404 for cached identity %s",
  async (id) => {
    const result = await loadReaderForSlug("mistyped-book", {
      isOnline: () => true,
      findLibraryItemIdBySlug: async () => id,
      loadFromCache: async () => null,
      fetchFromNetwork: vi.fn().mockRejectedValue(new ReaderPayloadError(404)),
    });
    expect(result).toEqual({ kind: "not-found" });
  },
);

it.each(
  [401, 403, 409, 500].flatMap((status) =>
    [null, "known-id"].map((id) => [status, id] as const),
  ),
)(
  "keeps HTTP %i failures unavailable for cached identity %s",
  async (status, id) => {
    const result = await loadReaderForSlug("book", {
      isOnline: () => true,
      findLibraryItemIdBySlug: async () => id,
      loadFromCache: async () => null,
      fetchFromNetwork: vi
        .fn()
        .mockRejectedValue(new ReaderPayloadError(status)),
    });
    expect(result).toEqual({ kind: "error" });
  },
);

it.each([null, "known-id"])(
  "identifies an incompatible reader for cached identity %s",
  async (id) => {
    const result = await loadReaderForSlug("book", {
      isOnline: () => true,
      findLibraryItemIdBySlug: async () => id,
      loadFromCache: async () => null,
      fetchFromNetwork: vi
        .fn()
        .mockRejectedValue(
          new ReaderPayloadError(409, "PDF_READER_UPGRADE_REQUIRED"),
        ),
    });
    expect(result).toEqual({ kind: "upgrade-required", libraryItemId: id });
  },
);
it("does not turn an upgrade code on another HTTP status into compatibility failure", async () => {
  const result = await loadReaderForSlug("book", {
    isOnline: () => true,
    findLibraryItemIdBySlug: async () => "known-id",
    loadFromCache: async () => null,
    fetchFromNetwork: vi
      .fn()
      .mockRejectedValue(
        new ReaderPayloadError(500, "PDF_READER_UPGRADE_REQUIRED"),
      ),
  });
  expect(result).toEqual({ kind: "error" });
});
