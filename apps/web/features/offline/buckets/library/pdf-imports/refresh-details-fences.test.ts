import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests, setActiveUser } from "../../../db";
import { DELETED_ITEM_PREFIX } from "../deleted-items";
import { refreshPdfDetails } from "./refresh-details";
import { ready, seedTransition } from "./details-test-fixture";
beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
});
afterEach(() => {
  vi.unstubAllGlobals();
  __resetDbForTests();
});
it("does not fetch details for deleted items", async () => {
  const db = await seedTransition(),
    fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await db.meta.put({
    key: DELETED_ITEM_PREFIX + ready.libraryItemId,
    value: true,
    updatedAt: "now",
  });
  await refreshPdfDetails(db, async () => "token");
  expect(fetch).not.toHaveBeenCalled();
});
it("discards a response after an account switch", async () => {
  const db = await seedTransition();
  let release!: (response: Response) => void;
  const fetch = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );
  vi.stubGlobal("fetch", fetch);
  const pending = refreshPdfDetails(db, async () => "token");
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  setActiveUser("details-other-account");
  release(Response.json({ book: ready }));
  await pending;
  expect(await getDb().libraryItems.get(ready.libraryItemId)).toBeUndefined();
});
