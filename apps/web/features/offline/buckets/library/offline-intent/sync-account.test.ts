import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests, setActiveUser } from "../../../db";
import { readCompletionRevision } from "../../../completion/state";
import { bookToItemRow } from "../collections/payload-rows";
import { deferredResponse } from "../finish-date/test-fixture";
import { payload } from "../test-fixture";
import { setOfflineRequestedLocal } from "./offline-intent-store";
import { flushOfflineIntents, __resetOfflineIntentSyncForTests } from "./offline-intent-sync";

const row = bookToItemRow(payload().collections[0].books[0], "2026-09-14T10:00:00.000Z");

beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
  __resetOfflineIntentSyncForTests();
  vi.stubGlobal("navigator", { onLine: true });
});
afterEach(() => {
  __resetOfflineIntentSyncForTests();
  __resetDbForTests();
  vi.unstubAllGlobals();
});

it("does not acknowledge an identical offline-save intent belonging to a new account", async () => {
  await getDb().libraryItems.put(row);
  await setOfflineRequestedLocal(row.libraryItemId, true);
  const response = deferredResponse();
  const fetcher = vi.fn(response.fetch);
  vi.stubGlobal("fetch", fetcher);
  const flushing = flushOfflineIntents(async () => "old-token");
  await response.started;

  setActiveUser("offline-intent-next-account");
  await getDb().delete();
  await getDb().open();
  await getDb().libraryItems.put(row);
  await setOfflineRequestedLocal(row.libraryItemId, true);
  const newRow = await getDb().libraryItems.get(row.libraryItemId);
  const newRevision = await readCompletionRevision(getDb());
  response.respond(Response.json({ requested: true }));
  await flushing;

  expect(await getDb().libraryItems.get(row.libraryItemId)).toEqual(newRow);
  expect(await readCompletionRevision(getDb())).toBe(newRevision);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await getDb().delete();
  __resetDbForTests();
  expect((await getDb().libraryItems.get(row.libraryItemId))?.offlineRequestedDirty).toBe(true);
});
