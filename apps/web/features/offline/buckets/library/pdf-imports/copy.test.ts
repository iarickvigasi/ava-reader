import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../../db";
import { importPdfFile } from "./mutations";
import { pdfStatus } from "./test-fixture";
import { storePdfUploadIntent, settlePdfUploadIntent } from "./storage";
vi.mock("../revalidate", () => ({ revalidateLibrary: vi.fn() }));
beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
});
afterEach(() => {
  __resetDbForTests();
  vi.unstubAllGlobals();
});
const file = () =>
  new File(["%PDF-copy"], "Book.pdf", { type: "application/pdf" });
it("offers a duplicate without automatic navigation/copy; explicit copy posts once and a lost response reconciles that new request", async () => {
  let copyKey: string | undefined;
  let copyAccepted = false;
  const fetcher = vi.fn(async (url: string, init: RequestInit) => {
    if (init.method === "POST") {
      const form = init.body as FormData;
      if (!form.get("copyOfOperationId"))
        return Response.json(
          {
            code: "PDF_ALREADY_IMPORTED",
            operationId: pdfStatus.operationId,
            libraryItemId: pdfStatus.libraryItemId,
          },
          { status: 409 },
        );
      expect(form.get("copyOfOperationId")).toBe(pdfStatus.operationId);
      copyKey = (init.headers as Record<string, string>)["Idempotency-Key"];
      copyAccepted = true;
      throw Error("copy response lost");
    }
    if (url.endsWith("/" + pdfStatus.operationId))
      return Response.json(pdfStatus);
    if (copyAccepted && url.endsWith("/" + copyKey))
      return Response.json({
        ...pdfStatus,
        operationId: "pdf-copy",
        libraryItemId: "copy-item",
      });
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);
  const duplicate = await importPdfFile(file(), async () => "token");
  expect(duplicate).toMatchObject({
    state: "duplicate",
    operationId: pdfStatus.operationId,
  });
  expect(await importPdfFile(file(), async () => "token")).toMatchObject({
    state: "duplicate",
    operationId: pdfStatus.operationId,
  });
  const choice = {
    operationId: duplicate.operationId!,
    requestKey: duplicate.requestKey!,
  };
  expect(
    await importPdfFile(file(), async () => "token", choice),
  ).toMatchObject({ state: "uncertain" });
  expect(copyKey).not.toBe(duplicate.requestKey);
  expect(
    await importPdfFile(file(), async () => "token", choice),
  ).toMatchObject({ state: "existing", libraryItemId: "copy-item" });
  expect(fetcher.mock.calls.filter((x) => x[1].method === "POST")).toHaveLength(
    2,
  );
});
it("concurrent copy confirmations share one replacement, and late old receipt writes cannot change it", async () => {
  const db = getDb(),
    original = {
      requestKey: "first",
      sourceSha256: "a".repeat(64),
      filename: "Book.pdf",
      createdAt: new Date().toISOString(),
    };
  await storePdfUploadIntent(db, original);
  await settlePdfUploadIntent(db, original, "original-item");
  const results = await Promise.all(
    ["copy-a", "copy-b"].map((requestKey) =>
      storePdfUploadIntent(
        db,
        { ...original, requestKey, copyOfOperationId: "pdf-original" },
        original.requestKey,
      ),
    ),
  );
  expect(results[0]?.requestKey).toBe(results[1]?.requestKey);
  expect(results[0]?.requestKey).not.toBe(original.requestKey);
  expect(await settlePdfUploadIntent(db, original, "wrong")).toBe(false);
  expect(
    await storePdfUploadIntent(db, { ...original, requestKey: "third" }),
  ).toEqual(results[0]);
});
it("never replaces an unresolved original intent merely because a copy was requested", async () => {
  const db = getDb(),
    original = {
      requestKey: "pending",
      sourceSha256: "a".repeat(64),
      filename: "Book.pdf",
      createdAt: new Date().toISOString(),
    };
  await storePdfUploadIntent(db, original);
  expect(
    await storePdfUploadIntent(
      db,
      { ...original, requestKey: "copy", copyOfOperationId: "pdf-original" },
      original.requestKey,
    ),
  ).toEqual(original);
});
