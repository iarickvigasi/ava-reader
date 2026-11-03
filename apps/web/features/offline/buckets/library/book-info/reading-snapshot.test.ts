import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import { getDb, __resetDbForTests } from "../../../db";
import { book } from "../membership/test-fixture";
import { applyBookInfoPayload } from "./write-book-info";
import { readBookInfoBySlug } from "./read-book-info";
import { checkpointHome } from "../../../stats/checkpoint-fixture";

afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
});

it("persists book-specific coverage and keeps it when a stale details response arrives", async () => {
  await applyBookInfoPayload({
    ...book,
    minutesRead: 18,
    readingSnapshot: checkpointHome(480, 3).readingSnapshot,
  });
  await applyBookInfoPayload({
    ...book,
    minutesRead: 10,
    readingSnapshot: checkpointHome(0, 1).readingSnapshot,
  });
  const cached = await readBookInfoBySlug(book.slug);
  expect(cached?.minutesRead).toBe(18);
  expect(cached?.readingSnapshot?.readingRevision).toBe(3);
  expect(cached?.readingSnapshot?.sessionCoverage).toEqual([
    { clientSessionId: "phone", durationSeconds: 480 },
  ]);
});
