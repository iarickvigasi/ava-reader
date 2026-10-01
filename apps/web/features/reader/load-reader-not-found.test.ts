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

it.each([401, 403, 500])(
  "keeps HTTP %i failures unavailable",
  async (status) => {
    const result = await loadReaderForSlug("book", {
      isOnline: () => true,
      findLibraryItemIdBySlug: async () => null,
      loadFromCache: async () => null,
      fetchFromNetwork: vi
        .fn()
        .mockRejectedValue(new ReaderPayloadError(status)),
    });
    expect(result).toEqual({ kind: "error" });
  },
);
