import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests, setActiveUser } from "../../db";
import { readCompletionRevision } from "../../completion/state";
import { deferredResponse } from "../library/finish-date/test-fixture";
import { readProgress, writeProgress } from "./storage";
import { flushDirtyProgress, __resetProgressSyncForTests } from "./sync";

const libraryItemId = "shared-id";
const locator = { chapterId: "same-chapter", blockId: "same-block", textOffset: 0 };

beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
  __resetProgressSyncForTests();
  vi.stubGlobal("navigator", { onLine: true });
});
afterEach(() => {
  __resetProgressSyncForTests();
  __resetDbForTests();
  vi.unstubAllGlobals();
});

it("keeps a new account's progress dirty when the previous account's PATCH responds", async () => {
  await writeProgress({ libraryItemId, locator, completionPercent: 100, dirty: true });
  const response = deferredResponse();
  const fetcher = vi.fn(response.fetch);
  vi.stubGlobal("fetch", fetcher);
  const flushing = flushDirtyProgress(async () => "old-token");
  await response.started;

  setActiveUser("progress-next-account");
  await getDb().delete();
  await getDb().open();
  // Matching IDs and locator cannot establish which account owns the ack.
  await writeProgress({ libraryItemId, locator, completionPercent: 40, dirty: true });
  const newProgress = await readProgress(libraryItemId);
  const newRevision = await readCompletionRevision(getDb());
  response.respond(Response.json({ locator, completionPercent: 100, lastReadAt: "2026-09-14T12:00:00.000Z" }));
  await flushing;

  expect(await readProgress(libraryItemId)).toEqual(newProgress);
  expect(await readCompletionRevision(getDb())).toBe(newRevision);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await getDb().delete();
  __resetDbForTests();
  expect((await readProgress(libraryItemId))?.dirty).toBe(true);
});
