import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests, setActiveUser } from "../../../db";
import {
  PDF_REQUEST_PREFIX,
  storePdfUploadIntent,
  rejectPdfUploadIntent,
  settlePdfUploadIntent,
} from "./storage";
import { reconcilePdfRequest } from "./reconcile-request";
const original = {
  requestKey: "old-request",
  sourceSha256: "a".repeat(64),
  filename: "book.pdf",
  createdAt: "2026-10-12T00:00:00Z",
};
beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
});
afterEach(() => {
  __resetDbForTests();
  vi.unstubAllGlobals();
});
it("rotates only confirmed pre-admission refusal and shares the replacement across concurrent explicit selections", async () => {
  const db = getDb();
  await storePdfUploadIntent(db, original);
  await rejectPdfUploadIntent(db, original);
  expect(
    (
      await storePdfUploadIntent(db, {
        ...original,
        requestKey: "not-confirmed",
      })
    )?.requestKey,
  ).toBe(original.requestKey);
  await rejectPdfUploadIntent(db, original, "PDF_ADMISSION_REFUSED");
  const next = await Promise.all([
    storePdfUploadIntent(db, { ...original, requestKey: "fresh-one" }),
    storePdfUploadIntent(db, { ...original, requestKey: "fresh-two" }),
  ]);
  expect(next[0]?.requestKey).not.toBe(original.requestKey);
  expect(next[0]?.requestKey).toBe(next[1]?.requestKey);
});
it("late old settle/reject cannot overwrite the replacement, and accepted content cannot be marked refused", async () => {
  const db = getDb();
  await storePdfUploadIntent(db, original);
  await rejectPdfUploadIntent(db, original, "PDF_ADMISSION_REFUSED");
  const current = (await storePdfUploadIntent(db, {
    ...original,
    requestKey: "fresh",
  }))!;
  await settlePdfUploadIntent(db, original, "stale-library-item");
  await rejectPdfUploadIntent(db, original, "PDF_ADMISSION_REFUSED");
  expect(
    (await db.meta.get(PDF_REQUEST_PREFIX + original.sourceSha256))?.value,
  ).toEqual(current);
  await settlePdfUploadIntent(db, current, "accepted-item");
  await rejectPdfUploadIntent(db, current, "PDF_ADMISSION_REFUSED");
  expect(
    (await storePdfUploadIntent(db, { ...original, requestKey: "third" }))
      ?.libraryItemId,
  ).toBe("accepted-item");
});
it("drops a confirmed refusal delivered after an owner switch without touching either current intent", async () => {
  const db = getDb();
  await storePdfUploadIntent(db, original);
  let release!: (value: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    ),
  );
  const pending = reconcilePdfRequest(
    db,
    async () => "owner-a-token",
    original,
  );
  await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  setActiveUser("owner-b");
  await getDb().delete();
  await getDb().open();
  const other = { ...original, requestKey: "owner-b-request" };
  await storePdfUploadIntent(getDb(), other);
  release(
    Response.json(
      {
        code: "PDF_ADMISSION_REFUSED",
        investigationId: "pdf-refused",
        requestKey: original.requestKey,
        sourceSha256: original.sourceSha256,
        operationId: null,
      },
      { status: 410 },
    ),
  );
  await expect(pending).rejects.toThrow("ACCOUNT_CHANGED");
  expect(
    (await getDb().meta.get(PDF_REQUEST_PREFIX + other.sourceSha256))?.value,
  ).toEqual(other);
  setActiveUser("owner-b");
  await getDb().delete();
});

it("ignores a delayed old refusal body after another observer confirms refusal and an explicit selection replaces the key", async () => {
  const db = getDb();
  await storePdfUploadIntent(db, original);
  const body = {
    code: "PDF_ADMISSION_REFUSED",
    investigationId: "pdf-refused",
    requestKey: original.requestKey,
    sourceSha256: original.sourceSha256,
    operationId: null,
  };
  let release!: (body: unknown) => void;
  const delayed = Response.json(body, { status: 410 });
  vi.spyOn(delayed, "json").mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(delayed)
    .mockResolvedValueOnce(Response.json(body, { status: 410 }));
  vi.stubGlobal("fetch", fetcher);
  const stale = reconcilePdfRequest(db, async () => "token", original);
  await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  expect(
    await reconcilePdfRequest(db, async () => "token", original),
  ).toMatchObject({ state: "refused" });
  const fresh = (await storePdfUploadIntent(db, {
    ...original,
    requestKey: "new-selection",
  }))!;
  release(body);
  expect(await stale).toBeNull();
  expect(
    (await db.meta.get(PDF_REQUEST_PREFIX + original.sourceSha256))?.value,
  ).toEqual(fresh);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("does not let malformed cached source identity or truthy rejected fields authorize rotation or receipt writes", async () => {
  const db = getDb(),
    key = PDF_REQUEST_PREFIX + original.sourceSha256;
  const malformed = {
    ...original,
    sourceSha256: "b".repeat(64),
    rejected: true,
    refusalCode: "PDF_ADMISSION_REFUSED",
  };
  await db.meta.put({ key, value: malformed, updatedAt: original.createdAt });
  expect(
    await storePdfUploadIntent(db, { ...original, requestKey: "new" }),
  ).toBeNull();
  expect(await settlePdfUploadIntent(db, original, "wrong-item")).toBe(false);
  expect(
    await rejectPdfUploadIntent(db, original, "PDF_ADMISSION_REFUSED"),
  ).toBe(false);
  expect((await db.meta.get(key))?.value).toEqual(malformed);
  await db.meta.put({
    key,
    value: {
      ...original,
      rejected: "yes",
      refusalCode: "PDF_ADMISSION_REFUSED",
    },
    updatedAt: original.createdAt,
  });
  expect(
    (await storePdfUploadIntent(db, { ...original, requestKey: "new" }))
      ?.requestKey,
  ).toBe(original.requestKey);
});
