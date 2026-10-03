import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../../db";
import { applyBookInfoPayload } from "../book-info/write-book-info";
import { readBookInfoBySlug } from "../book-info/read-book-info";
import { payload } from "../test-fixture";
import { book } from "./metadata/test-fixture";
import { ready } from "./details-test-fixture";
import { observePdfImports } from "./sync";
beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
});
afterEach(() => {
  vi.unstubAllGlobals();
  __resetDbForTests();
});
it("a full observer tick refreshes details when polling makes the uploaded PDF Ready", async () => {
  await applyBookInfoPayload({ ...book, language: null });
  const card = { ...ready, lastReadAt: "2026-09-29T10:01:00.000Z" };
  const library = {
    ...payload(),
    collections: [{ ...payload().collections[0], books: [card] }],
  };
  const fetch = vi.fn(async (url: string) => {
    if (url.endsWith("/notifications"))
      return Response.json({ notifications: [], complete: true });
    if (url.includes("/observations/list"))
      return Response.json({ imports: [ready.pdfImport] });
    if (url.endsWith("/api/library")) return Response.json(library);
    if (url.endsWith("/api/library/book"))
      return Response.json({ book: ready });
    throw Error("UNEXPECTED_REQUEST");
  });
  vi.stubGlobal("fetch", fetch);
  await observePdfImports(async () => "token");
  expect(await readBookInfoBySlug(ready.slug)).toMatchObject({
    language: "en",
    metadataEditVersion: 1,
    approximatePageCount: 8,
    pdfImport: { status: "READY" },
  });
  fetch.mockClear();
  expect(await observePdfImports(async () => "token")).toBe(false);
  expect(
    fetch.mock.calls.map(([url]) => url.endsWith("/api/library/book")),
  ).not.toContain(true);
});
