import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, expect, it, vi } from "vitest";
import { getDb } from "../../../db";
import { readCoverBlob } from "./read";
import { cleanCoverTest } from "./testing";

afterEach(async () => {
  vi.restoreAllMocks();
  await cleanCoverTest();
});

it("upgrades legacy covers atomically while preserving chapters, flags, and queues", async () => {
  const db = getDb();
  const schema = Object.fromEntries(
    db.tables
      .filter((t) => t.name !== "bookCovers")
      .map((t) => [
        t.name,
        [t.schema.primKey.src, ...t.schema.indexes.map((i) => i.src)].join(","),
      ]),
  );
  const old = new Dexie(db.name);
  old.version(4).stores(schema);
  for (const [id, text] of [
    ["good", "okay"],
    ["bad-size", "broken"],
    ["unreadable", "missing"],
  ]) {
    await old.table("libraryItems").put({
      libraryItemId: id,
      coverBlob: new Blob([text]),
      coverImageUrl: `/covers/${id}`,
      savedOffline: true,
      offlineRequested: true,
    });
  }
  await old
    .table("books")
    .put({ libraryItemId: "good", chapterIds: ["chapter"] });
  await old
    .table("bookChapters")
    .put({ libraryItemId: "good", chapterId: "chapter", blocks: ["text"] });
  await old
    .table("finishDateMutations")
    .put({ libraryItemId: "good", finishedAt: null });
  old.close();
  const arrayBuffer = Blob.prototype.arrayBuffer;
  vi.spyOn(Blob.prototype, "arrayBuffer").mockImplementation(function (
    this: Blob,
  ) {
    if (this.size === 6) return Promise.resolve(new ArrayBuffer(2));
    if (this.size === 7) return Promise.reject(new Error("missing Blob file"));
    return arrayBuffer.call(this);
  });
  await db.open();
  expect(await (await readCoverBlob("good"))!.text()).toBe("okay");
  expect(await db.bookCovers.get("good")).toMatchObject({
    verified: false,
    sourceUrl: "/covers/good",
  });
  expect(await readCoverBlob("bad-size")).toBeNull();
  expect(await readCoverBlob("unreadable")).toBeNull();
  for (const row of await db.libraryItems.toArray()) {
    expect(row).not.toHaveProperty("coverBlob");
    expect(row).toMatchObject({ savedOffline: true, offlineRequested: true });
  }
  expect(await db.bookChapters.get(["good", "chapter"])).toMatchObject({
    blocks: ["text"],
  });
  expect(await db.finishDateMutations.get("good")).toBeDefined();
  db.close();
  await db.open();
  expect(await (await readCoverBlob("good"))!.text()).toBe("okay");
});
