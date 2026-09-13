import "fake-indexeddb/auto";
import Dexie from "dexie";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { interstellarHtml } from "@/features/library/book-description/fixtures/interstellar";
import { __resetLibraryBucketForTests } from "@/features/offline/buckets/library/bucket";
import { readBookInfoBySlug } from "@/features/offline/buckets/library/book-info/read-book-info";
import { applyBookInfoPayload } from "@/features/offline/buckets/library/book-info/write-book-info";
import { payload } from "@/features/offline/buckets/library/test-fixture";
import { DB_NAME, __resetDbForTests, getDb } from "@/features/offline/db";
import { withIntl } from "@/lib/test-utils/intl";
import { BookDescription } from "./description";

beforeEach(async () => {
  __resetDbForTests();
  __resetLibraryBucketForTests();
  await Dexie.delete(DB_NAME);
});

afterEach(() => {
  __resetDbForTests();
  __resetLibraryBucketForTests();
  vi.unstubAllGlobals();
});

it("renders cached publisher HTML offline without rewriting the stored description", async () => {
  const fetch = vi.fn().mockRejectedValue(new Error("Offline"));
  vi.stubGlobal("fetch", fetch);
  await applyBookInfoPayload({
    ...payload().collections[0].books[0],
    addedAt: "2026-01-01T00:00:00Z",
    approximateBodyPageCount: null,
    approximatePageCount: null,
    chapterLabel: null,
    collections: [],
    description: interstellarHtml,
    genres: [],
    language: "en",
    lastReadAt: null,
    minutesRead: 0,
    publishedYear: null,
    source: "IMPORTED",
  });

  // Reopen from persisted data, as a later offline visit does.
  __resetDbForTests();
  __resetLibraryBucketForTests();
  const cached = await readBookInfoBySlug("book-a");
  expect(cached?.description).toBe(interstellarHtml);
  const markup = renderToStaticMarkup(withIntl(
    <BookDescription description={cached?.description ?? null} />,
  ));

  expect(markup.match(/<p>/g)).toHaveLength(2);
  expect(markup).toContain("<em>Interstellar</em>");
  expect(markup).toContain("<em>The Science of Interstellar</em>");
  expect(markup).not.toMatch(/MS Shell Dlg|font-size|&lt;div|<font/);
  const stored = await getDb().libraryItems.get("lib-1");
  expect(stored?.details?.description).toBe(interstellarHtml);
  expect(fetch).not.toHaveBeenCalled();
});
