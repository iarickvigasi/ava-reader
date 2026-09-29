import "fake-indexeddb/auto";
import { afterEach, beforeEach, vi } from "vitest";
import { getDb, __resetDbForTests, type LibraryItemRow } from "../../db";
export const id = "cover-library";
export const src = `/api/library/epub-imports/covers/${id}`;
export const image = () =>
  new Response(new Uint8Array([137, 80, 78, 71]), {
    headers: { "Content-Type": "image/png" },
  });
export const input = () => ({
  libraryItemId: id,
  src,
  getToken: async () => "cover-token",
  signal: new AbortController().signal,
});
export function coverTests() {
  beforeEach(async () => {
    __resetDbForTests();
    await getDb().delete();
    __resetDbForTests();
    await getDb().libraryItems.put({
      libraryItemId: id,
      slug: "cover",
      title: "Book",
      authors: [],
      coverImageUrl: src,
      primaryFormat: "EPUB",
      completionPercent: 0,
      lastReadAt: null,
      coverBlob: null,
      savedOffline: false,
      savedAutomatically: false,
      savedAt: null,
      offlineRequested: false,
      serverUpdatedAt: null,
    } as LibraryItemRow);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    __resetDbForTests();
  });
}
