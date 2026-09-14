import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../db";
import { deferredResponse } from "../library/finish-date/test-fixture";
import { revalidateProgress } from "./revalidate";
import { markProgressSyncedIfUnchanged, readProgress, writeProgress } from "./storage";

const libraryItemId = "progress-race";
const start = { chapterId: "first", blockId: "first", textOffset: 0 };
const end = { chapterId: "last", blockId: "last", textOffset: 0 };

beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
  await writeProgress({ libraryItemId, locator: start, completionPercent: 10, dirty: false });
});
afterEach(() => {
  __resetDbForTests();
  vi.unstubAllGlobals();
});

it.each(["dirty", "acknowledged"])("a pending GET cannot regress a newer %s completion", async (state) => {
  const response = deferredResponse();
  vi.stubGlobal("fetch", vi.fn(response.fetch));
  const revalidating = revalidateProgress(libraryItemId, async () => "token");
  await response.started;
  await writeProgress({ libraryItemId, locator: end, completionPercent: 100, dirty: true });
  if (state === "acknowledged") {
    await markProgressSyncedIfUnchanged(libraryItemId, end, {
      locator: end, completionPercent: 100, lastReadAt: "2026-09-14T12:00:00.000Z",
    });
  }
  const latest = await readProgress(libraryItemId);
  response.respond(Response.json({
    locator: start, completionPercent: 10, lastReadAt: "2026-09-14T10:00:00.000Z",
  }));
  await revalidating;
  expect(await readProgress(libraryItemId)).toEqual(latest);
  expect(latest).toMatchObject({ completionPercent: 100, dirty: state === "dirty" });
});
