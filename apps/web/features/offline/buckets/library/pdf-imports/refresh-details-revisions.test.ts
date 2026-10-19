import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../../db";
import { applyBookInfoPayload } from "../book-info/write-book-info";
import { refreshPdfDetails } from "./refresh-details";
import { pdfDetailsRevision } from "./details-revision";
import { ready, seedTransition } from "./details-test-fixture";
import { pdfStatus } from "./test-fixture";
beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
});
afterEach(() => {
  vi.unstubAllGlobals();
  __resetDbForTests();
});
it.each([
  { ...ready, metadataEditVersion: 0, language: null },
  { ...ready, pdfImport: pdfStatus },
])(
  "older metadata or import state never stamps current details fresh",
  async (stale) => {
    const db = await seedTransition();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ book: stale }))
      .mockResolvedValueOnce(Response.json({ book: ready }));
    vi.stubGlobal("fetch", fetch);
    await refreshPdfDetails(db, async () => "token");
    const row = (await db.libraryItems.get(ready.libraryItemId))!;
    expect(row.pdfImport?.status).toBe("READY");
    expect(row.pdfDetailsRevision).not.toBe(pdfDetailsRevision(row));
    await refreshPdfDetails(db, async () => "token");
    const current = (await db.libraryItems.get(ready.libraryItemId))!;
    expect(current.pdfDetailsRevision).toBe(pdfDetailsRevision(current));
  },
);
it("bounds each poll to twenty cached detail refreshes and continues remaining work", async () => {
  const db = await seedTransition();
  const row = (await db.libraryItems.get(ready.libraryItemId))!;
  await db.libraryItems.clear();
  for (let i = 0; i < 21; i++)
    await db.libraryItems.put({
      ...row,
      libraryItemId: `item-${i}`,
      slug: `slug-${i}`,
    });
  const fetch = vi.fn(async () => new Response(null, { status: 503 }));
  vi.stubGlobal("fetch", fetch);
  expect(await refreshPdfDetails(db, async () => "token")).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(20);
});
it("ordinary EPUB details are not enrolled in PDF status refresh", async () => {
  await applyBookInfoPayload({ ...ready, pdfImport: undefined });
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect(await refreshPdfDetails(getDb(), async () => "token")).toBe(false);
  expect(fetch).not.toHaveBeenCalled();
});

it("a late older-state payload cannot regress already refreshed full details", async () => {
  const db = await seedTransition();
  await applyBookInfoPayload(ready);
  await applyBookInfoPayload({
    ...ready,
    approximatePageCount: null,
    pdfImport: pdfStatus,
  });
  const row = (await db.libraryItems.get(ready.libraryItemId))!;
  expect(row.details).toMatchObject({
    language: "en",
    approximatePageCount: 8,
  });
  expect(row.pdfDetailsRevision).toBe(pdfDetailsRevision(row));
});
