import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, expect, it } from "vitest";
import { getDb, __resetDbForTests } from "../../../db";
import { __setNetStateForTests, __resetNetStateForTests } from "../../../net/net-state";
import { readBookInfo, __resetLibraryBucketForTests } from "../bucket";
import { clearFinishDateRuntime } from "./runtime";
import { setBookFinishedAt } from "./mutation";
import { book, finishedAt, seedFinishDateFixture, token } from "./test-fixture";

afterEach(() => {
  clearFinishDateRuntime();
  __resetLibraryBucketForTests();
  __resetDbForTests();
  __resetNetStateForTests();
});

it("upgrades a v2 database without losing old book details, progress, or queued membership edits", async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
  __setNetStateForTests(false);
  await seedFinishDateFixture();
  const row = (await getDb().libraryItems.get(book.libraryItemId))!;
  Reflect.deleteProperty(row.details!, "finishedAt");
  const progress = (await getDb().progress.get(book.libraryItemId))!;
  const name = getDb().name;
  await getDb().delete();
  __resetDbForTests();

  const oldDb = new Dexie(name);
  oldDb.version(2).stores({
    libraryItems: "libraryItemId, slug, lastReadAt, savedOffline, savedAutomatically",
    collections: "id, slug, kind",
    collectionMembership: "[collectionId+libraryItemId], collectionId, libraryItemId, order",
    collectionMembershipMutations: "libraryItemId, queuedAt",
    books: "libraryItemId",
    bookChapters: "[libraryItemId+chapterId], libraryItemId, index",
    highlights: "[libraryItemId+id], libraryItemId, updatedAt",
    aiComments: "[libraryItemId+id], libraryItemId, status, createdAt",
    sessions: "clientSessionId, libraryItemId, state, syncedAt",
    progress: "libraryItemId, dirty",
    statsSnapshot: "id",
    preferences: "id",
    me: "id",
    home: "id",
    highlightMutations: "mutationId, scopeId, queuedAt, highlightId",
    aiCommentMutations: "mutationId, scopeId, queuedAt, commentId",
    sessionMutations: "mutationId, scopeId, queuedAt, clientSessionId",
    preferenceMutations: "mutationId, queuedAt",
    meta: "key",
  });
  const pendingMembership = {
    libraryItemId: book.libraryItemId, revision: "old-edit", queuedAt: finishedAt,
    changes: [{ collectionId: "col-1", member: false, baselineMember: true }],
  };
  try {
    await oldDb.table("libraryItems").put(row);
    await oldDb.table("progress").put(progress);
    await oldDb.table("collectionMembershipMutations").put(pendingMembership);
  } finally {
    oldDb.close();
  }

  const upgraded = getDb();
  await upgraded.open();
  expect(upgraded.verno).toBe(3);
  expect(await upgraded.libraryItems.get(book.libraryItemId)).toEqual(row);
  expect(await upgraded.progress.get(book.libraryItemId)).toEqual(progress);
  expect(await upgraded.collectionMembershipMutations.get(book.libraryItemId)).toEqual(pendingMembership);
  expect((await readBookInfo(book.slug))?.finishedAt).toBeNull();
  expect(await upgraded.finishDateMutations.count()).toBe(0);
  await setBookFinishedAt(book.libraryItemId, finishedAt, token);
  expect((await readBookInfo(book.slug))?.finishedAt).toBe(finishedAt);
});
