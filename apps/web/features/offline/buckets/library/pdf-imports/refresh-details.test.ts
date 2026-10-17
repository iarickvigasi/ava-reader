import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../../db";
import { readBookInfoBySlug } from "../book-info/read-book-info";
import { refreshPdfDetails } from "./refresh-details";
import { applyPdfMetadata } from "./metadata/storage";
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
const token = async () => "token";
it("updates language and full details after Ready without reload, then stops fetching", async () => {
  const db = await seedTransition();
  expect((await readBookInfoBySlug(ready.slug))?.language).toBeNull();
  const fetch = vi.fn<
    (url: string, options?: RequestInit) => Promise<Response>
  >(async () => Response.json({ book: ready }));
  vi.stubGlobal("fetch", fetch);
  await refreshPdfDetails(db, token);
  expect(await readBookInfoBySlug(ready.slug)).toMatchObject({
    language: "en",
    title: ready.title,
    approximatePageCount: 8,
  });
  expect(await refreshPdfDetails(db, token)).toBe(false);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(fetch.mock.calls[0]?.[0])).toContain("/api/library/book");
});
it("retries a failed detail fetch on the next observation even after terminal status", async () => {
  const db = await seedTransition();
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ book: ready }));
  vi.stubGlobal("fetch", fetch);
  await refreshPdfDetails(db, token);
  expect((await readBookInfoBySlug(ready.slug))?.language).toBeNull();
  await refreshPdfDetails(db, token);
  expect((await readBookInfoBySlug(ready.slug))?.language).toBe("en");
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("a late details response cannot erase a newer user language edit", async () => {
  const db = await seedTransition();
  let release!: (response: Response) => void;
  const fetch = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );
  vi.stubGlobal("fetch", fetch);
  const pending = refreshPdfDetails(db, token);
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  await applyPdfMetadata(db, {
    operationId: ready.pdfImport.operationId,
    libraryItemId: ready.libraryItemId,
    metadataEditVersion: 2,
    title: "My title",
    authors: [],
    language: null,
  });
  release(Response.json({ book: ready }));
  await pending;
  expect(await readBookInfoBySlug(ready.slug)).toMatchObject({
    language: null,
    title: "My title",
    metadataEditVersion: 2,
  });
});
