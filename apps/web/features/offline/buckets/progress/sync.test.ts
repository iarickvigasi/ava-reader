import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal("navigator", { onLine: true });

import { DB_NAME, __resetDbForTests } from "../../db";
import { readProgress, writeProgress } from "./storage";
import { __resetProgressSyncForTests, flushDirtyProgress } from "./sync";

const TOKEN = async () => "token";

function jsonOk(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

async function seedDirty(id: string, chapterId: string, pct: number) {
  await writeProgress({
    libraryItemId: id,
    locator: { chapterId, blockId: `${chapterId}-b`, textOffset: 0 },
    completionPercent: pct,
    dirty: true,
  });
}

beforeEach(() => {
  __resetDbForTests();
  __resetProgressSyncForTests();
  vi.stubGlobal("navigator", { onLine: true });
});

afterEach(async () => {
  __resetDbForTests();
  __resetProgressSyncForTests();
  vi.restoreAllMocks();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

describe("flushDirtyProgress", () => {
  it("PATCHes each dirty locator up to the server and clears the flag", async () => {
    await seedDirty("lib-1", "c1", 20);
    const fetchMock = vi.fn(async () =>
      jsonOk({
        chapterLabel: null,
        completionPercent: 22,
        lastReadAt: "2026-04-07T10:00:00.000Z",
        locator: { chapterId: "c1", blockId: "c1-b", textOffset: 0 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await flushDirtyProgress(TOKEN);

    expect(result.synced).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/library/lib-1/reader/progress"),
      expect.objectContaining({ method: "PATCH" }),
    );
    const row = await readProgress("lib-1");
    expect(row?.dirty).toBe(false);
    expect(row?.completionPercent).toBe(22);
    expect(row?.lastReadAt).toBe("2026-04-07T10:00:00.000Z");
  });

  it("does not PATCH while offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    await seedDirty("lib-1", "c1", 20);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await flushDirtyProgress(TOKEN);

    expect(fetchMock).not.toHaveBeenCalled();
    expect((await readProgress("lib-1"))?.dirty).toBe(true);
  });

  it("leaves the row dirty on a server error", async () => {
    await seedDirty("lib-1", "c1", 20);
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await flushDirtyProgress(TOKEN);

    expect(result.synced).toBe(0);
    expect((await readProgress("lib-1"))?.dirty).toBe(true);
  });

  it("does nothing without a token", async () => {
    await seedDirty("lib-1", "c1", 20);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await flushDirtyProgress(async () => null);

    expect(fetchMock).not.toHaveBeenCalled();
    expect((await readProgress("lib-1"))?.dirty).toBe(true);
  });

  it("sends the row's local read time as readAt for most-recent-wins", async () => {
    await seedDirty("lib-1", "c1", 20);
    const seeded = await readProgress("lib-1");
    const fetchMock = vi.fn(async () =>
      jsonOk({
        chapterLabel: null,
        completionPercent: 20,
        lastReadAt: "2026-04-07T10:00:00.000Z",
        locator: { chapterId: "c1", blockId: "c1-b", textOffset: 0 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await flushDirtyProgress(TOKEN);

    const call = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    const body = JSON.parse(call[1].body) as {
      locator: unknown;
      readAt: string;
    };
    expect(body.readAt).toBe(seeded?.lastLocalUpdateAt);
    expect(body.locator).toEqual({
      chapterId: "c1",
      blockId: "c1-b",
      textOffset: 0,
    });
  });

  it("adopts the server's newer position when our stale write is rejected", async () => {
    await seedDirty("lib-1", "c1", 20);
    const fetchMock = vi.fn(async () =>
      jsonOk({
        chapterLabel: null,
        completionPercent: 80,
        lastReadAt: "2026-04-09T10:00:00.000Z",
        // Another device's newer position — the server kept this, ignored ours.
        locator: { chapterId: "c9", blockId: "c9-b", textOffset: 3 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await flushDirtyProgress(TOKEN);

    const row = await readProgress("lib-1");
    expect(row?.dirty).toBe(false);
    expect(row?.locator).toEqual({
      chapterId: "c9",
      blockId: "c9-b",
      textOffset: 3,
    });
    expect(row?.completionPercent).toBe(80);
  });

  it("is single-flight across concurrent calls", async () => {
    await seedDirty("lib-1", "c1", 20);
    const fetchMock = vi.fn(async () =>
      jsonOk({
        chapterLabel: null,
        completionPercent: 20,
        lastReadAt: null,
        locator: { chapterId: "c1", blockId: "c1-b", textOffset: 0 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([flushDirtyProgress(TOKEN), flushDirtyProgress(TOKEN)]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
