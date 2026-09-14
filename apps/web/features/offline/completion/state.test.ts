import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { getDb, __resetDbForTests } from "../db";
import { completionTables, readCompletionContext } from "./counts";
import { bumpCompletionRevision, readCompletionRevision, recordCompletionAck } from "./state";

const date = "2026-09-14T12:00:00.000Z";

beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
});
afterEach(() => __resetDbForTests());

it("records independent per-field and per-collection acknowledgment revisions", async () => {
  const db = getDb();
  await db.transaction("rw", db.meta, async () => {
    expect(await recordCompletionAck(db, "book", { finishedAt: date })).toBe(1);
    expect(await recordCompletionAck(db, "book", { completionPercent: 100, memberships: { a: true } })).toBe(2);
    expect(await recordCompletionAck(db, "book", { offlineRequested: true, memberships: { b: false } })).toBe(3);
    expect(await recordCompletionAck(db, "book", { finishedAt: null })).toBe(4);
  });
  const ctx = await db.transaction("r", completionTables(db), () => readCompletionContext(db));
  expect(ctx.changes.get("book")).toEqual({
    libraryItemId: "book", finishedAt: { value: null, revision: 4 },
    completionPercent: { value: 100, revision: 2 }, offlineRequested: { value: true, revision: 3 },
    memberships: { a: { value: true, revision: 2 }, b: { value: false, revision: 3 } },
  });
  expect(await readCompletionRevision(db)).toBe(4);
});

it("rolls back the revision fence together with a failed local transaction", async () => {
  const db = getDb();
  await expect(db.transaction("rw", db.meta, async () => {
    await recordCompletionAck(db, "book", { finishedAt: date });
    throw new Error("Write failed");
  })).rejects.toThrow("Write failed");
  expect(await readCompletionRevision(db)).toBe(0);
  const ctx = await db.transaction("r", completionTables(db), () => readCompletionContext(db));
  expect(ctx.changes.size).toBe(0);
  await db.transaction("rw", db.meta, () => bumpCompletionRevision(db));
  expect(await readCompletionRevision(db)).toBe(1);
});
