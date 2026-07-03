import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DB_NAME, __resetDbForTests } from "../../db";
import { revalidateProgress } from "./revalidate";
import { readProgress, writeProgress } from "./storage";

const TOKEN = async () => "token";

beforeEach(() => {
  __resetDbForTests();
});

afterEach(async () => {
  __resetDbForTests();
  vi.restoreAllMocks();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

describe("revalidateProgress", () => {
  it("writes the server progress into the bucket as a clean baseline", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        chapterLabel: "Chapter Two",
        completionPercent: 50,
        lastReadAt: "2026-04-07T10:00:00.000Z",
        locator: { chapterId: "ch-2", blockId: "b2", textOffset: 3 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await revalidateProgress("lib-1", TOKEN);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/library/lib-1/reader/progress"),
      expect.anything(),
    );
    const row = await readProgress("lib-1");
    expect(row?.locator?.chapterId).toBe("ch-2");
    expect(row?.completionPercent).toBe(50);
    expect(row?.lastReadAt).toBe("2026-04-07T10:00:00.000Z");
    expect(row?.dirty).toBe(false);
  });

  it("does nothing without a token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await revalidateProgress("lib-1", async () => null);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await readProgress("lib-1")).toBeUndefined();
  });

  it("leaves the cache intact on a non-ok response", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await revalidateProgress("lib-1", TOKEN);

    expect(await readProgress("lib-1")).toBeUndefined();
  });

  it("never clobbers a dirty local row (unsynced offline reading wins)", async () => {
    await writeProgress({
      libraryItemId: "lib-1",
      locator: { chapterId: "ch-9", blockId: "b9", textOffset: 0 },
      completionPercent: 90,
      dirty: true,
    });
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        chapterLabel: null,
        completionPercent: 10,
        lastReadAt: "2026-04-07T10:00:00.000Z",
        locator: { chapterId: "ch-1", blockId: "b1", textOffset: 0 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await revalidateProgress("lib-1", TOKEN);

    expect(fetchMock).not.toHaveBeenCalled();
    const row = await readProgress("lib-1");
    expect(row?.locator?.chapterId).toBe("ch-9");
    expect(row?.completionPercent).toBe(90);
    expect(row?.dirty).toBe(true);
  });
});
