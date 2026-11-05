import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../db";
import { listDirtyProgress, readProgress, writeProgress } from "./storage";

beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
});
afterEach(() => {
  vi.useRealTimers();
  __resetDbForTests();
});
const locator = { chapterId: "chapter", blockId: "paragraph", textOffset: 0 };

it("round-trips a position and leaves a missing row absent", async () => {
  await writeProgress({
    libraryItemId: "book",
    locator,
    completionPercent: 42,
  });
  expect(await readProgress("book")).toMatchObject({
    locator,
    completionPercent: 42,
    dirty: false,
    lastServerUpdateAt: null,
  });
  expect(await readProgress("missing")).toBeUndefined();
});

it("preserves the server baseline while reading advances locally", async () => {
  const lastReadAt = "2026-04-07T10:00:00.000Z";
  await writeProgress({
    libraryItemId: "book",
    locator,
    completionPercent: 10,
    lastReadAt,
    dirty: false,
  });
  const baseline = await readProgress("book");
  await writeProgress({
    libraryItemId: "book",
    locator: { ...locator, textOffset: 5 },
    completionPercent: 20,
    dirty: true,
  });
  expect(await readProgress("book")).toMatchObject({
    lastReadAt,
    lastServerUpdateAt: baseline?.lastServerUpdateAt,
    completionPercent: 20,
    dirty: true,
  });
});

it("distinguishes two writes at the same position in one millisecond", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-04T10:00:00Z"));
  await writeProgress({
    libraryItemId: "book",
    locator,
    completionPercent: 20,
    dirty: true,
  });
  const first = await readProgress("book");
  await writeProgress({
    libraryItemId: "book",
    locator,
    completionPercent: 20,
    dirty: true,
  });
  expect((await readProgress("book"))?.lastLocalUpdateAt).not.toBe(
    first?.lastLocalUpdateAt,
  );
});

it("lists only pending rows with a position to upload", async () => {
  for (const row of [
    { libraryItemId: "clean", locator, dirty: false },
    { libraryItemId: "pending", locator, dirty: true },
    { libraryItemId: "no-position", locator: null, dirty: true },
  ])
    await writeProgress({ ...row, completionPercent: 10 });
  expect((await listDirtyProgress()).map((row) => row.libraryItemId)).toEqual([
    "pending",
  ]);
});
