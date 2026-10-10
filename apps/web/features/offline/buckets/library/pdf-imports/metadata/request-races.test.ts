import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../../../db";
import { applyBookInfoPayload } from "../../book-info/write-book-info";
import { DELETED_ITEM_PREFIX } from "../../deleted-items";
import { requestPdfMetadata } from "./request";
import { book, edited } from "./test-fixture";
beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
  await applyBookInfoPayload(book);
});
afterEach(() => {
  vi.unstubAllGlobals();
  __resetDbForTests();
});
function input() {
  return {
    db: getDb(),
    getToken: async () => "test-token",
    operationId: "operation",
    libraryItemId: "lib-1",
  };
}
it("drops a response after deletion", async () => {
  const request = input();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      await request.db.meta.put({
        key: DELETED_ITEM_PREFIX + "lib-1",
        value: true,
        updatedAt: "now",
      });
      return Response.json(edited);
    }),
  );
  await expect(requestPdfMetadata(request)).rejects.toMatchObject({
    reason: "unavailable",
  });
  expect((await request.db.libraryItems.get("lib-1"))?.title).toBe("Original");
});
it("drops a response after an account database switch", async () => {
  const request = input();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      __resetDbForTests();
      return Response.json(edited);
    }),
  );
  await expect(requestPdfMetadata(request)).rejects.toThrow("ACCOUNT_CHANGED");
  expect((await getDb().libraryItems.get("lib-1"))?.title).toBe("Original");
});
