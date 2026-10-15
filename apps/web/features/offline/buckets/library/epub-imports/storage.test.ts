import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { getDb, __resetDbForTests } from "../../../db";
import { applyBookInfoPayload } from "../book-info/write-book-info";
import { readBookInfoBySlug } from "../book-info/read-book-info";
import { mergeListPayloadItemRow } from "../collections/item-row";
import { bookToItemRow } from "../collections/payload-rows";
import { composeHomeMetadata } from "../../home/metadata";
import { homeFixture } from "../../home/test-fixture";
import { nativeBook, readyBook } from "./test-fixture";

beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
});
afterEach(() => __resetDbForTests());
it("updates full details and protects them from older and missing status payloads", async () => {
  await applyBookInfoPayload(nativeBook);
  await applyBookInfoPayload(readyBook);
  await applyBookInfoPayload(nativeBook);
  await applyBookInfoPayload({ ...nativeBook, epubImport: undefined });
  expect(await readBookInfoBySlug(nativeBook.slug)).toMatchObject({
    title: "Printed title",
    language: "uk",
    coverImageUrl: "/owned-cover",
    epubImport: readyBook.epubImport,
  });
});
it("retains a prepared cover when an older list response arrives", async () => {
  await applyBookInfoPayload(readyBook);
  const prior = (await getDb().libraryItems.get(readyBook.libraryItemId))!;
  const next = bookToItemRow({ ...nativeBook, lastReadAt: "now" }, "now");
  expect(mergeListPayloadItemRow(next, prior)).toMatchObject({
    title: "Printed title",
    coverImageUrl: "/owned-cover",
    epubImport: readyBook.epubImport,
  });
});
it("a legacy list cannot erase preparation or local offline intent", async () => {
  await applyBookInfoPayload(nativeBook);
  const prior = (await getDb().libraryItems.get(nativeBook.libraryItemId))!;
  prior.offlineRequestedDirty = true;
  prior.offlineRequested = true;
  const next = bookToItemRow(
    { ...nativeBook, epubImport: undefined, lastReadAt: "now" },
    "now",
  );
  expect(mergeListPayloadItemRow(next, prior)).toMatchObject({
    epubImport: nativeBook.epubImport,
    offlineRequested: true,
    offlineRequestedDirty: true,
  });
});
it("a cached Home payload cannot offer Continue reading for a known unfinished import", async () => {
  await applyBookInfoPayload(nativeBook);
  const home = homeFixture();
  home.currentEngagement = {
    ...nativeBook,
    chapterLabel: "Start",
    lastReadAt: "now",
    nextMilestone: "Next",
  };
  expect(
    composeHomeMetadata(
      home,
      await getDb().libraryItems.get(nativeBook.libraryItemId),
    ).currentEngagement,
  ).toBeNull();
});
