import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, expect, it } from "vitest";
import { DB_NAME, __resetDbForTests, getDb } from "../../db";
import { payload } from "./test-fixture";
import { applyLibraryPayload, applyCollectionPayload } from "./collections/write-library";
import { removeCachedLibraryItems } from "./remove-cached-items";
import { applyBookContent, applyChapter, attachCoverBlob } from "../book/storage";
import { writeProgress } from "../progress/storage";
import { upsertSnapshotRow } from "../highlights/storage";
import { upsertCommentRow } from "../ai-comments/storage";

beforeEach(async () => { __resetDbForTests(); await Dexie.delete(DB_NAME); });
afterEach(() => __resetDbForTests());

async function seed(id: string) {
  const db = getDb();
  await applyBookContent({ libraryItemId: id, chapterIds: ["ch"], toc: [], metadata: {
    libraryItemId: id, slug: id, title: id, authors: [], language: null, primaryFormat: "EPUB",
  } });
  await applyChapter({ libraryItemId: id, chapterId: "ch", index: 0, blocks: [] });
  await attachCoverBlob(id, new Blob(["cover"]));
  await writeProgress({ libraryItemId: id, locator: null, completionPercent: 20 });
  await db.highlights.put({ libraryItemId: id, id: "h", excerpt: "text", color: "yellow", locator: null, createdAt: "now", updatedAt: "now" });
  await db.aiComments.put({ libraryItemId: id, id: "a", kind: "EXPLAIN", sourceText: "text", body: "explanation", targetLang: null, locator: null, createdAt: "now", status: "ready", error: null });
  await db.translations.put({ libraryItemId: id, chapterId: "ch", targetLang: "fr" } as never);
  await db.highlightMutations.put({ mutationId: id, scopeId: id } as never);
  await db.aiCommentMutations.put({ mutationId: id, scopeId: id } as never);
  await db.collectionMembershipMutations.put({ libraryItemId: id, changes: [], queuedAt: "now" } as never);
  await db.finishDateMutations.put({ libraryItemId: id } as never);
  await db.sessions.put({ clientSessionId: id, libraryItemId: id, startedAt: "2026-09-23T10:00:00Z", endedAt: "2026-09-23T11:00:00Z", lastHeartbeatAt: "2026-09-23T11:00:00Z", state: "closed", syncedAt: null, serverSessionId: null });
  await db.sessionMutations.put({ mutationId: id, scopeId: id, clientSessionId: id } as never);
}

it("cascades a remote deletion including pre-existing orphans, but retains sessions and books outside previews", async () => {
  await applyLibraryPayload(payload());
  for (const id of ["lib-1", "lib-2", "old-orphan"]) await seed(id);
  const db = getDb();
  await applyLibraryPayload({ libraryItemIds: ["lib-1"], collections: [], summary: { booksCount: 1, collectionsCount: 0 } });
  for (const table of [db.libraryItems, db.books, db.bookChapters, db.translations, db.highlights, db.aiComments, db.progress, db.collectionMembership, db.collectionMembershipMutations, db.finishDateMutations]) {
    const rows = await table.toArray();
    expect(rows.every(row => row.libraryItemId === "lib-1"), table.name).toBe(true);
  }
  expect(await db.libraryItems.get("lib-1")).toBeDefined();
  expect((await db.highlightMutations.toArray()).map(row => row.scopeId)).toEqual(["lib-1"]);
  expect((await db.aiCommentMutations.toArray()).map(row => row.scopeId)).toEqual(["lib-1"]);
  expect(await db.sessions.count()).toBe(3);
  expect(await db.sessionMutations.count()).toBe(3);
});

it("never infers deletion from an older server's previews", async () => {
  await applyLibraryPayload(payload());
  await seed("lib-2");
  await applyLibraryPayload({ collections: [], summary: { booksCount: 0, collectionsCount: 0 } });
  expect(await getDb().books.get("lib-2")).toBeDefined();
});

it("deletes all content for an empty authoritative library", async () => {
  await seed("orphan");
  await applyLibraryPayload({ libraryItemIds: [], collections: [], summary: { booksCount: 0, collectionsCount: 0 } });
  expect(await getDb().books.count()).toBe(0);
  expect(await getDb().bookChapters.count()).toBe(0);
  expect(await getDb().sessions.count()).toBe(1);
});

it("fences late content, annotation, progress and metadata responses after deletion", async () => {
  await applyLibraryPayload(payload());
  await seed("lib-2");
  const db = getDb();
  const highlight = (await db.highlights.get(["lib-2", "h"]))!;
  const comment = (await db.aiComments.get(["lib-2", "a"]))!;
  await removeCachedLibraryItems(["lib-2"]);
  await applyCollectionPayload(payload().collections[0]);
  await applyChapter({ libraryItemId: "lib-2", chapterId: "late", index: 0, blocks: [] });
  await applyBookContent({ libraryItemId: "lib-2", chapterIds: [], toc: [], metadata: {} as never });
  await writeProgress({ libraryItemId: "lib-2", locator: null, completionPercent: 30 });
  await upsertSnapshotRow("lib-2", highlight as never);
  await upsertCommentRow("lib-2", comment);
  expect(await db.libraryItems.get("lib-2")).toBeUndefined();
  expect(await db.books.count()).toBe(0);
  expect(await db.bookChapters.count()).toBe(0);
  expect(await db.highlights.count()).toBe(0);
  expect(await db.aiComments.count()).toBe(0);
  expect(await db.progress.count()).toBe(0);
  expect(await db.sessions.count()).toBe(1);
});

it("does not sweep a new book hydrated after the library request began", async () => {
  await applyLibraryPayload(payload());
  await seed("new-import");
  await applyLibraryPayload({ libraryItemIds: ["lib-1", "lib-2"], collections: [], summary: { booksCount: 2, collectionsCount: 0 } }, { removalCandidates: ["lib-1", "lib-2"] });
  expect(await getDb().books.get("new-import")).toBeDefined();
});
