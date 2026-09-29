import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../../../db";
import { markPdfNotice, storePdfNotices } from "./storage";
import { syncPdfNotices } from "./sync";
import { PDF_NOTICE_PREFIX, type PdfNotice } from "./types";
const notice: PdfNotice = {
  id: "notice",
  operationId: "op",
  libraryItemId: "item",
  kind: "pdf_import_failed",
  createdAt: "2026-09-29T12:00:00Z",
  deliveredAt: null,
};
beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
});
afterEach(() => {
  vi.unstubAllGlobals();
  __resetDbForTests();
});
it("an old response in another tab cannot reopen an acknowledged notice", async () => {
  const db = getDb();
  await storePdfNotices(db, [notice]);
  let release!: (response: Response) => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const firstResponse = new Promise<Response>((resolve) => {
    release = resolve;
  });
  let gets = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "POST")
        return Promise.resolve(Response.json({ ok: true }));
      if (++gets === 1) {
        entered();
        return firstResponse;
      }
      return Promise.resolve(
        Response.json({ notifications: [], complete: true }),
      );
    }),
  );
  const stale = syncPdfNotices(db, async () => "token");
  await started;
  await markPdfNotice(db, notice.id, "acknowledged");
  await syncPdfNotices(db, async () => "token");
  release(Response.json({ notifications: [notice], complete: true }));
  await stale;
  const stored = (await db.meta.get(PDF_NOTICE_PREFIX + notice.id))
    ?.value as PdfNotice;
  expect(stored.acknowledgedAt).toBeTruthy();
  expect(stored.dirty).toBeNull();
});
it("a truncated server page cannot silently acknowledge omitted notices", async () => {
  const db = getDb();
  await storePdfNotices(db, [notice]);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ notifications: [], complete: false })),
  );
  await syncPdfNotices(db, async () => "token");
  expect(
    ((await db.meta.get(PDF_NOTICE_PREFIX + notice.id))?.value as PdfNotice)
      .acknowledgedAt,
  ).toBeUndefined();
});
it("a notice created locally after the request began is not acknowledged by old absence", async () => {
  const db = getDb();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      await storePdfNotices(db, [notice]);
      return Response.json({ notifications: [], complete: true });
    }),
  );
  await syncPdfNotices(db, async () => "token");
  expect(
    ((await db.meta.get(PDF_NOTICE_PREFIX + notice.id))?.value as PdfNotice)
      .acknowledgedAt,
  ).toBeUndefined();
});
