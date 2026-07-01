import { describe, expect, it, vi } from "vitest";

import type { ReaderStatusPayload } from "@/lib/api-types";

import {
  loadReaderForSlug,
  type LoadReaderDeps,
} from "./load-reader-for-slug";

const PAYLOAD = {
  status: "READY",
  book: { libraryItemId: "id-1" },
} as unknown as ReaderStatusPayload;

function deps(overrides: Partial<LoadReaderDeps> = {}): LoadReaderDeps {
  return {
    isOnline: () => true,
    findLibraryItemIdBySlug: vi.fn().mockResolvedValue("id-1"),
    loadFromCache: vi.fn().mockResolvedValue(PAYLOAD),
    fetchFromNetwork: vi.fn().mockResolvedValue(PAYLOAD),
    ...overrides,
  };
}

describe("loadReaderForSlug", () => {
  it("serves from the Dexie cache without touching the network", async () => {
    const d = deps();
    const result = await loadReaderForSlug("dune", d);

    expect(result).toEqual({
      kind: "loaded",
      payload: PAYLOAD,
      libraryItemId: "id-1",
    });
    expect(d.fetchFromNetwork).not.toHaveBeenCalled();
  });

  it("falls back to the network on cache miss while online", async () => {
    const d = deps({ loadFromCache: vi.fn().mockResolvedValue(null) });
    const result = await loadReaderForSlug("dune", d);

    expect(result).toEqual({
      kind: "loaded",
      payload: PAYLOAD,
      libraryItemId: "id-1",
    });
    expect(d.fetchFromNetwork).toHaveBeenCalledWith("id-1");
  });

  it("fetches by slug when the book is unknown locally but we're online", async () => {
    const d = deps({
      findLibraryItemIdBySlug: vi.fn().mockResolvedValue(null),
    });
    const result = await loadReaderForSlug("dune", d);

    expect(result.kind).toBe("loaded");
    expect(d.fetchFromNetwork).toHaveBeenCalledWith("dune");
    expect(d.loadFromCache).not.toHaveBeenCalled();
  });

  it("reports missing-offline (with the known id) on cache miss while offline", async () => {
    const d = deps({
      isOnline: () => false,
      loadFromCache: vi.fn().mockResolvedValue(null),
    });
    const result = await loadReaderForSlug("dune", d);

    expect(result).toEqual({ kind: "missing-offline", libraryItemId: "id-1" });
    expect(d.fetchFromNetwork).not.toHaveBeenCalled();
  });

  it("reports missing-offline with null id for an unknown slug offline", async () => {
    const d = deps({
      isOnline: () => false,
      findLibraryItemIdBySlug: vi.fn().mockResolvedValue(null),
    });
    const result = await loadReaderForSlug("dune", d);

    expect(result).toEqual({ kind: "missing-offline", libraryItemId: null });
  });

  it("maps a failed fetch for a locally-known book to missing-offline (modal, not spinner)", async () => {
    const d = deps({
      loadFromCache: vi.fn().mockResolvedValue(null),
      fetchFromNetwork: vi.fn().mockRejectedValue(new Error("boom")),
    });
    const result = await loadReaderForSlug("dune", d);

    expect(result).toEqual({ kind: "missing-offline", libraryItemId: "id-1" });
  });

  it("reports an error when the fetch fails for a slug we know nothing about", async () => {
    const d = deps({
      findLibraryItemIdBySlug: vi.fn().mockResolvedValue(null),
      fetchFromNetwork: vi.fn().mockRejectedValue(new Error("boom")),
    });
    const result = await loadReaderForSlug("dune", d);

    expect(result).toEqual({ kind: "error" });
  });
});
