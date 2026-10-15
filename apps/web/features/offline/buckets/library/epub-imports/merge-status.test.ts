import { expect, it } from "vitest";
import { mergeEpubImportStatus } from "./merge-status";
import { isBookReadable } from "@/features/library/is-book-readable";
import { getLibraryBookInfoHref } from "@/lib/app-routes";
import { pending, ready, nativeBook } from "./test-fixture";

it("missing or older data cannot erase known preparation or immutable content", () => {
  for (const missing of [undefined, null])
    expect(mergeEpubImportStatus(pending, missing)).toBe(pending);
  expect(mergeEpubImportStatus(ready, pending)).toBe(ready);
  expect(
    mergeEpubImportStatus(ready, { ...ready, finalContentId: "other" }),
  ).toBe(ready);
  expect(mergeEpubImportStatus(pending, { ...ready, runId: "other" })).toBe(
    pending,
  );
  expect(mergeEpubImportStatus(pending, ready)).toBe(ready);
});
it("a newer explicit availability failure remains visible", () => {
  const failed = {
    ...pending,
    status: "FAILED" as const,
    updatedAt: "2026-10-15T10:02:00.000Z",
  };
  expect(mergeEpubImportStatus(ready, failed)).toBe(failed);
  expect(mergeEpubImportStatus(failed, pending)).toBe(failed);
});
it("requires both acceptance and content identity, leaving legacy books alone", () => {
  expect(isBookReadable({})).toBe(true);
  for (const status of [
    "PENDING",
    "PROCESSING",
    "AWAITING_ACCEPTANCE",
    "FAILED",
  ] as const)
    expect(isBookReadable({ epubImport: { ...pending, status } })).toBe(false);
  expect(
    isBookReadable({ epubImport: { ...ready, finalContentId: null } }),
  ).toBe(false);
  expect(isBookReadable({ epubImport: ready })).toBe(true);
});
it("does not bootstrap a ready-looking Details card from an incomplete URL snapshot", () => {
  expect(getLibraryBookInfoHref(nativeBook.slug, { card: nativeBook })).toBe(
    "/app/library/books/book",
  );
});
