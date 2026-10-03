import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../../../db";
import { applyBookInfoPayload } from "../../book-info/write-book-info";
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
it("uses an owned no-store snapshot and expected version for a save", async () => {
  const fetch = vi.fn<
    (url: string, options?: RequestInit) => Promise<Response>
  >(async () => Response.json(edited));
  vi.stubGlobal("fetch", fetch);
  await requestPdfMetadata({
    ...input(),
    edit: {
      snapshot: { ...edited, metadataEditVersion: 0 },
      draft: { title: "My title", authors: "", language: "" },
    },
  });
  const options = fetch.mock.calls[0][1];
  expect(options).toMatchObject({
    method: "PATCH",
    cache: "no-store",
    headers: { Authorization: "Bearer test-token" },
  });
  expect(JSON.parse(options!.body as string)).toEqual({
    title: "My title",
    authors: [],
    language: null,
    expectedVersion: 0,
  });
});
it("reports conflict without overwriting the cached values or queueing edits", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 409 })),
  );
  await expect(requestPdfMetadata(input())).rejects.toMatchObject({
    reason: "conflict",
  });
  expect((await getDb().libraryItems.get("lib-1"))?.title).toBe("Original");
  expect(await getDb().meta.toArray()).toEqual([]);
});
it("rejects a substituted response and a foreign draft before transport", async () => {
  const fetch = vi.fn(async () =>
    Response.json({ ...edited, operationId: "other" }),
  );
  vi.stubGlobal("fetch", fetch);
  await expect(requestPdfMetadata(input())).rejects.toMatchObject({
    reason: "unavailable",
  });
  await expect(
    requestPdfMetadata({
      ...input(),
      edit: {
        snapshot: { ...edited, libraryItemId: "other" },
        draft: { title: "x", authors: "", language: "" },
      },
    }),
  ).rejects.toMatchObject({ reason: "invalid" });
  expect(fetch).toHaveBeenCalledTimes(1);
});
