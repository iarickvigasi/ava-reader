import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../db";
import { markProgressSyncedIfUnchanged } from "./acknowledge-progress";
import { readProgress, writeProgress } from "./storage";

beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
});
afterEach(() => {
  vi.useRealTimers();
  __resetDbForTests();
});
const locator = {
  chapterId: "chapter-22",
  blockId: "paragraph",
  textOffset: 410,
};
const server = {
  locator: { ...locator, chapterId: "chapter-10" },
  completionPercent: 10,
  lastReadAt: "2026-11-04T11:00:00Z",
};

it("adopts a canonical response only for the submitted write", async () => {
  await writeProgress({
    libraryItemId: "book",
    locator,
    completionPercent: 36,
    dirty: true,
  });
  const sent = (await readProgress("book"))!;
  expect(
    await markProgressSyncedIfUnchanged(
      "book",
      { locator, readAt: sent.lastLocalUpdateAt },
      server,
    ),
  ).toBe(true);
  expect(await readProgress("book")).toMatchObject({ ...server, dirty: false });
});

it.each(["same-position", "different-position"])(
  "retains a newer %s write when an old request responds",
  async (kind) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-04T10:00:00Z"));
    await writeProgress({
      libraryItemId: "book",
      locator,
      completionPercent: 36,
      dirty: true,
    });
    const sent = (await readProgress("book"))!;
    const nextLocator =
      kind === "same-position" ? locator : { ...locator, textOffset: 500 };
    // Even two writes in the same millisecond must have distinct fences.
    await writeProgress({
      libraryItemId: "book",
      locator: nextLocator,
      completionPercent: 36,
      dirty: true,
    });
    expect(
      await markProgressSyncedIfUnchanged(
        "book",
        { locator, readAt: sent.lastLocalUpdateAt },
        server,
      ),
    ).toBe(false);
    expect(await readProgress("book")).toMatchObject({
      locator: nextLocator,
      completionPercent: 36,
      dirty: true,
    });
  },
);
