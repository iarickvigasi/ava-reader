import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../db";
import { readProgress, writeProgress } from "./storage";
import { syncProgress } from "./sync-progress";

afterEach(async () => {
  vi.useRealTimers();
  await getDb().delete();
  __resetDbForTests();
  __resetDbForTests();
  vi.unstubAllGlobals();
});

it("keeps the saved read time through token acquisition and preserves a later same-position write", async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-04T10:00:00Z"));
  const locator = { chapterId: "chapter", blockId: "paragraph", textOffset: 0 };
  await writeProgress({
    libraryItemId: "book",
    locator,
    completionPercent: 36,
    dirty: true,
  });
  const saved = (await readProgress("book"))!;
  let begin!: () => void;
  let finish!: (token: string) => void;
  const started = new Promise<void>((resolve) => (begin = resolve));
  const getToken = () => {
    begin();
    return new Promise<string>((resolve) => (finish = resolve));
  };
  const request = vi.fn(async () =>
    Response.json({
      locator,
      completionPercent: 10,
      lastReadAt: "2026-11-04T11:00:00Z",
    }),
  );
  vi.stubGlobal("fetch", request);
  const work = syncProgress("book", getToken, { keepalive: true });
  await started;
  vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
  await writeProgress({
    libraryItemId: "book",
    locator,
    completionPercent: 36,
    dirty: true,
  });
  finish("token");
  expect(await work).toBeNull();
  expect(request).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      keepalive: true,
      body: JSON.stringify({ locator, readAt: saved.lastLocalUpdateAt }),
    }),
  );
  expect(await readProgress("book")).toMatchObject({
    locator,
    completionPercent: 36,
    dirty: true,
  });
});
