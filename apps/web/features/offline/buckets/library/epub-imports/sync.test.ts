import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests, setActiveUser } from "../../../db";
import { applyBookInfoPayload } from "../book-info/write-book-info";
import { readBookInfoBySlug } from "../book-info/read-book-info";
import { observeEpubImports } from "./sync";
import { nativeBook, readyBook } from "./test-fixture";
vi.mock("../../home", () => ({ revalidateHome: vi.fn() }));
it("discards an in-flight response after an account switch", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      setActiveUser("new-user");
      return Response.json({ book: readyBook });
    }),
  );
  await observeEpubImports(async () => "token");
  expect(await getDb().libraryItems.count()).toBe(0);
});
beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
  await applyBookInfoPayload(nativeBook);
});
afterEach(() => {
  vi.unstubAllGlobals();
  __resetDbForTests();
});
it("refreshes metadata and readiness without reload, then stops fetching", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ book: readyBook }));
  vi.stubGlobal("fetch", fetch);
  expect(await observeEpubImports(async () => "token")).toBe(true);
  expect(await readBookInfoBySlug(nativeBook.slug)).toMatchObject({
    title: "Printed title",
    language: "uk",
    epubImport: readyBook.epubImport,
  });
  expect(await observeEpubImports(async () => "token")).toBe(false);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("retains pending state on a fetch failure and retries on the next observation", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ book: readyBook }));
  vi.stubGlobal("fetch", fetch);
  await observeEpubImports(async () => "token");
  expect((await readBookInfoBySlug(nativeBook.slug))?.epubImport).toEqual(
    nativeBook.epubImport,
  );
  await observeEpubImports(async () => "token");
  expect((await readBookInfoBySlug(nativeBook.slug))?.epubImport).toEqual(
    readyBook.epubImport,
  );
});
it("makes failure visible and stops polling a terminal failure", async () => {
  const failed = {
    ...nativeBook,
    epubImport: {
      ...nativeBook.epubImport,
      status: "FAILED",
      updatedAt: "2026-10-15T10:01:00.000Z",
    },
  };
  const fetch = vi.fn().mockResolvedValue(Response.json({ book: failed }));
  vi.stubGlobal("fetch", fetch);
  await observeEpubImports(async () => "token");
  expect((await readBookInfoBySlug(nativeBook.slug))?.epubImport?.status).toBe(
    "FAILED",
  );
  expect(await observeEpubImports(async () => "token")).toBe(false);
  expect(fetch).toHaveBeenCalledTimes(1);
});
