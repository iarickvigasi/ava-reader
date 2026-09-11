import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../../db";
import { __setNetStateForTests, __resetNetStateForTests } from "../../../net/net-state";
import { hydrateBookInfo, hydrateFromPayload, readBookInfo, readCollectionBySlug, __resetLibraryBucketForTests } from "../bucket";
import { applyCollectionPayload } from "../collections/write-library";
import { clearCollectionMembershipRuntime } from "./bucket";
import { readCollectionPickerOptions } from "./picker-options";
import { updateBookCollections } from "./mutations";
import { addTarget, book, removeTarget, seedMembershipFixture, source, target, token } from "./test-fixture";

beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
  __setNetStateForTests(false);
  await seedMembershipFixture();
});
afterEach(() => {
  clearCollectionMembershipRuntime();
  __resetLibraryBucketForTests();
  __resetDbForTests();
  __resetNetStateForTests();
  vi.restoreAllMocks();
});

describe("offline collection membership", () => {
  it("updates book selection and large shelf counts, preserving cached previews", async () => {
    await updateBookCollections(addTarget, token);
    expect((await readBookInfo(book.slug))?.collections.map((entry) => entry.id)).toEqual([source.id, target.id]);
    const shelf = await readCollectionBySlug(target.slug);
    expect(shelf?.itemCount).toBe(21);
    expect(shelf?.unreadCount).toBe(21);
    expect(shelf?.books).toHaveLength(5);
    __resetDbForTests();
    __resetLibraryBucketForTests();
    expect((await readCollectionBySlug(target.slug))?.itemCount).toBe(21);
    expect(await getDb().collectionMembershipMutations.count()).toBe(1);
  });

  it("coalesces reversals and preserves pending selection across all hydration paths", async () => {
    await updateBookCollections(addTarget, token);
    await updateBookCollections(removeTarget, token);
    expect((await readCollectionBySlug(target.slug))?.itemCount).toBe(20);
    await updateBookCollections(addTarget, token);
    await hydrateBookInfo({ ...book, collections: [] });
    await applyCollectionPayload({ ...target, itemCount: 21 });
    await hydrateFromPayload({ collections: [source, { ...target, itemCount: 21 }], summary: { booksCount: 22, collectionsCount: 2 } });
    expect((await readCollectionBySlug(target.slug))?.itemCount).toBe(21);
    expect((await readBookInfo(book.slug))?.collections.map((entry) => entry.id)).toEqual([source.id, target.id]);
    expect(await getDb().collectionMembershipMutations.count()).toBe(1);
  });

  it("rejects SMART collections without queuing or changing them", async () => {
    await applyCollectionPayload({ ...target, kind: "SMART" });
    await expect(updateBookCollections(addTarget, token)).rejects.toThrow("Collection is unavailable");
    expect(await getDb().collectionMembershipMutations.count()).toBe(0);
  });

  it("uses newer positive collection evidence without double counting an addition", async () => {
    await applyCollectionPayload({
      ...target, itemCount: 21, unreadCount: 21,
      books: [...target.books.slice(0, 3), source.books[0]],
    });
    await getDb().collections.update(target.id, { serverUpdatedAt: "2099-01-01T00:00:00Z" });
    await updateBookCollections(addTarget, token);
    expect((await readCollectionBySlug(target.slug))?.itemCount).toBe(21);
    expect((await readCollectionBySlug(target.slug))?.unreadCount).toBe(21);
  });

  it("distinguishes incomplete cache from a confirmed empty custom list", async () => {
    await getDb().meta.clear();
    expect(await readCollectionPickerOptions()).toBeNull();
    await hydrateFromPayload({ collections: [], summary: { booksCount: 0, collectionsCount: 0 } });
    expect(await readCollectionPickerOptions()).toEqual([]);
  });
});
