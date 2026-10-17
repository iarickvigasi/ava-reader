import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests, setActiveUser } from "../../../../db";
import { bookToItemRow } from "../../collections/payload-rows";
import { payload } from "../../test-fixture";
import { DELETED_ITEM_PREFIX } from "../../deleted-items";
import { pdfStatus } from "../test-fixture";
import { markPdfNotice, readPdfNotices, storePdfNotices } from "./storage";
import { syncPdfNotices } from "./sync";
import { PDF_NOTICE_PREFIX, type PdfNotice } from "./types";
import { getLibraryBookInfoHref } from "@/lib/app-routes";

const notice: PdfNotice = {
  id: "notice",
  operationId: "operation",
  libraryItemId: "lib-1",
  kind: "pdf_import_failed",
  createdAt: "2026-09-29T12:00:00Z",
  deliveredAt: null,
};
beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
  const item = bookToItemRow(
    payload().collections[0].books[0],
    notice.createdAt,
  );
  await getDb().libraryItems.put({
    ...item,
    libraryItemId: notice.libraryItemId,
    pdfImport: pdfStatus,
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  __resetDbForTests();
});
it("persists offline acknowledgement and does not reopen on stale server delivery", async () => {
  const db = getDb();
  await storePdfNotices(db, [notice]);
  expect(await readPdfNotices(db)).toHaveLength(1);
  await markPdfNotice(db, notice.id, "delivered");
  expect(
    (await db.meta.get(PDF_NOTICE_PREFIX + notice.id))?.value,
  ).toMatchObject({ dirty: "delivered" });
  await markPdfNotice(db, notice.id, "acknowledged");
  await storePdfNotices(db, [notice]);
  expect(await readPdfNotices(db)).toEqual([]);
  expect(
    (await db.meta.get(PDF_NOTICE_PREFIX + notice.id))?.value,
  ).toMatchObject({ dirty: "acknowledged" });
});
it("does not resurrect deleted imports or write across accounts", async () => {
  const db = getDb();
  await db.meta.put({
    key: DELETED_ITEM_PREFIX + notice.libraryItemId,
    value: true,
    updatedAt: notice.createdAt,
  });
  await storePdfNotices(db, [notice]);
  expect(await readPdfNotices(db)).toEqual([]);
  expect(await db.meta.get(PDF_NOTICE_PREFIX + notice.id)).toBeUndefined();
  setActiveUser("pdf-notice-next");
  await getDb().delete();
  await getDb().open();
  await storePdfNotices(db, [notice]);
  expect(await getDb().meta.count()).toBe(0);
  await getDb().delete();
});
it("retains a dismissal that arrives while delivery is in flight", async () => {
  const db = getDb();
  await storePdfNotices(db, [notice]);
  await markPdfNotice(db, notice.id, "delivered");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        await markPdfNotice(db, notice.id, "acknowledged");
        return Response.json({ ok: true });
      }
      return Response.json({ notifications: [notice] });
    }),
  );
  await syncPdfNotices(db, async () => "token");
  expect(
    (await db.meta.get(PDF_NOTICE_PREFIX + notice.id))?.value,
  ).toMatchObject({ dirty: "acknowledged" });
  expect(await readPdfNotices(db)).toEqual([]);
});
it("flushes a stored acknowledgement once online and retains its tombstone", async () => {
  const db = getDb();
  await storePdfNotices(db, [notice]);
  await markPdfNotice(db, notice.id, "acknowledged");
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) =>
    Response.json(
      init?.method === "POST"
        ? { ok: true }
        : { notifications: [], complete: true },
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  await syncPdfNotices(db, async () => "token");
  expect(fetcher.mock.calls[0][0]).toContain(
    "/notifications/notice/acknowledged",
  );
  expect(
    (await db.meta.get(PDF_NOTICE_PREFIX + notice.id))?.value,
  ).toMatchObject({ dirty: null });
  expect(await readPdfNotices(db)).toEqual([]);
});
it("preserves queued acknowledgement when the service is unavailable", async () => {
  const db = getDb();
  await storePdfNotices(db, [notice]);
  await markPdfNotice(db, notice.id, "acknowledged");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 503 })),
  );
  await expect(syncPdfNotices(db, async () => "token")).rejects.toThrow(
    "NOTICE_UNAVAILABLE",
  );
  expect(
    (await db.meta.get(PDF_NOTICE_PREFIX + notice.id))?.value,
  ).toMatchObject({ dirty: "acknowledged" });
});
it("omits incomplete PDF card URL snapshots", () => {
  const card = { ...payload().collections[0].books[0], pdfImport: pdfStatus };
  expect(getLibraryBookInfoHref("book", { card })).toBe(
    "/app/library/books/book",
  );
});
