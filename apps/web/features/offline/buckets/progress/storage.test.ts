import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DB_NAME, __resetDbForTests } from "../../db";
import {
  listDirtyProgress,
  markProgressSynced,
  markProgressSyncedIfUnchanged,
  readCompletionPercent,
  readProgress,
  writeProgress,
} from "./storage";

beforeEach(() => {
  __resetDbForTests();
});

afterEach(async () => {
  __resetDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

describe("progress storage", () => {
  it("writeProgress + readProgress round-trip", async () => {
    await writeProgress({
      libraryItemId: "lib-1",
      locator: { chapterId: "ch-1", blockId: "b1", textOffset: 0 },
      completionPercent: 42,
    });
    const row = await readProgress("lib-1");
    expect(row?.completionPercent).toBe(42);
    expect(row?.locator?.chapterId).toBe("ch-1");
    expect(row?.lastServerUpdateAt).toBeNull();
    expect(row?.dirty).toBe(false);
  });

  it("readCompletionPercent falls back to 0 when there's no row", async () => {
    expect(await readCompletionPercent("never-seen")).toBe(0);
  });

  it("writeProgress preserves lastServerUpdateAt across overwrites", async () => {
    await writeProgress({
      libraryItemId: "lib-1",
      locator: null,
      completionPercent: 10,
    });
    await markProgressSynced("lib-1");
    const beforeOverwrite = await readProgress("lib-1");
    expect(beforeOverwrite?.lastServerUpdateAt).not.toBeNull();
    expect(beforeOverwrite?.dirty).toBe(false);

    // A subsequent local write (the user reads further) — dirty flips back
    // on, but lastServerUpdateAt is preserved as the previous successful
    // sync's timestamp.
    await writeProgress({
      libraryItemId: "lib-1",
      locator: { chapterId: "ch-2", blockId: "b2", textOffset: 0 },
      completionPercent: 55,
      dirty: true,
    });
    const after = await readProgress("lib-1");
    expect(after?.completionPercent).toBe(55);
    expect(after?.dirty).toBe(true);
    expect(after?.lastServerUpdateAt).toBe(
      beforeOverwrite?.lastServerUpdateAt,
    );
  });

  it("writeProgress stores the server lastReadAt when provided", async () => {
    await writeProgress({
      libraryItemId: "lib-1",
      locator: { chapterId: "ch-1", blockId: "b1", textOffset: 0 },
      completionPercent: 30,
      lastReadAt: "2026-04-07T10:00:00.000Z",
      dirty: false,
    });
    const row = await readProgress("lib-1");
    expect(row?.lastReadAt).toBe("2026-04-07T10:00:00.000Z");
  });

  it("writeProgress preserves lastReadAt when a later local write omits it", async () => {
    await writeProgress({
      libraryItemId: "lib-1",
      locator: null,
      completionPercent: 10,
      lastReadAt: "2026-04-07T10:00:00.000Z",
      dirty: false,
    });
    // The reader advances locally (no server timestamp to hand) — the server
    // baseline timestamp must survive so resume recency stays comparable.
    await writeProgress({
      libraryItemId: "lib-1",
      locator: { chapterId: "ch-2", blockId: "b2", textOffset: 0 },
      completionPercent: 20,
      dirty: true,
    });
    const row = await readProgress("lib-1");
    expect(row?.lastReadAt).toBe("2026-04-07T10:00:00.000Z");
    expect(row?.dirty).toBe(true);
  });

  it("markProgressSynced sets lastServerUpdateAt and clears dirty", async () => {
    await writeProgress({
      libraryItemId: "lib-1",
      locator: null,
      completionPercent: 20,
      dirty: true,
    });
    await markProgressSynced("lib-1");
    const row = await readProgress("lib-1");
    expect(row?.dirty).toBe(false);
    expect(row?.lastServerUpdateAt).not.toBeNull();
  });
});

describe("progress sync helpers", () => {
  it("listDirtyProgress returns only dirty rows that have a locator", async () => {
    await writeProgress({
      libraryItemId: "clean",
      locator: { chapterId: "c", blockId: "b", textOffset: 0 },
      completionPercent: 10,
      dirty: false,
    });
    await writeProgress({
      libraryItemId: "dirty-with-locator",
      locator: { chapterId: "c2", blockId: "b2", textOffset: 1 },
      completionPercent: 20,
      dirty: true,
    });
    await writeProgress({
      libraryItemId: "dirty-no-locator",
      locator: null,
      completionPercent: 0,
      dirty: true,
    });

    const dirty = await listDirtyProgress();
    expect(dirty.map((r) => r.libraryItemId)).toEqual(["dirty-with-locator"]);
  });

  it("markProgressSyncedIfUnchanged clears dirty + stores server truth when the locator still matches", async () => {
    const locator = { chapterId: "c2", blockId: "b2", textOffset: 1 };
    await writeProgress({
      libraryItemId: "lib-1",
      locator,
      completionPercent: 20,
      dirty: true,
    });

    await markProgressSyncedIfUnchanged("lib-1", locator, {
      completionPercent: 25,
      lastReadAt: "2026-04-07T10:00:00.000Z",
    });

    const row = await readProgress("lib-1");
    expect(row?.dirty).toBe(false);
    expect(row?.completionPercent).toBe(25);
    expect(row?.lastReadAt).toBe("2026-04-07T10:00:00.000Z");
    expect(row?.lastServerUpdateAt).not.toBeNull();
  });

  it("markProgressSyncedIfUnchanged leaves the row dirty when a newer local write changed the locator", async () => {
    const synced = { chapterId: "c2", blockId: "b2", textOffset: 1 };
    await writeProgress({
      libraryItemId: "lib-1",
      locator: synced,
      completionPercent: 20,
      dirty: true,
    });
    // The user reads further while the PATCH is in flight.
    await writeProgress({
      libraryItemId: "lib-1",
      locator: { chapterId: "c9", blockId: "b9", textOffset: 4 },
      completionPercent: 40,
      dirty: true,
    });

    await markProgressSyncedIfUnchanged("lib-1", synced, {
      completionPercent: 25,
      lastReadAt: "2026-04-07T10:00:00.000Z",
    });

    const row = await readProgress("lib-1");
    expect(row?.dirty).toBe(true);
    expect(row?.locator?.chapterId).toBe("c9");
    expect(row?.completionPercent).toBe(40);
  });
});
