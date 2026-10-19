import { it, expect, vi } from "vitest";
import { chapter, translationTestLifecycle } from "./test-fixtures";
import { getDb } from "../../db";
import { getTranslationBucket } from "./bucket";
import { revalidateTranslationChapter } from "./sync";
import { validateTranslationChapter } from "./validate";
translationTestLifecycle();
it("refuses a cached other revision and aborts an old scope when accepted identity is supplied", async () => {
  await getDb().translations.put({
    ...chapter,
    fetchedAt: new Date().toISOString(),
  });
  const old = getTranslationBucket(chapter);
  await old.hydrated;
  expect(old.snapshot.chapter).not.toBeNull();
  const controller = new AbortController();
  old.fetchRun = { controller, promise: Promise.resolve() };
  const current = getTranslationBucket({
    ...chapter,
    expectedContentRevision: "accepted-final",
  });
  await current.hydrated;
  expect(old.disposed).toBe(true);
  expect(controller.signal.aborted).toBe(true);
  expect(current.snapshot.chapter).toBeNull();
  expect(getTranslationBucket(chapter)).toBe(current);
});
it("rejects wrong-revision server responses and negotiates the real reader build", async () => {
  const bucket = getTranslationBucket({
    ...chapter,
    expectedContentRevision: "accepted-final",
  });
  await bucket.hydrated;
  bucket.getToken = async () => "token";
  const fetcher = vi.fn().mockResolvedValue(Response.json(chapter));
  vi.stubGlobal("fetch", fetcher);
  await revalidateTranslationChapter(bucket);
  expect(bucket.snapshot.chapter).toBeNull();
  expect(bucket.snapshot.status).toBe("error");
  expect(fetcher.mock.calls[0][1].headers["X-AVA-Reader-Schema"]).toBe(
    "ava-reader-3",
  );
});
it("accepts literal source units but never accepts generated translations for them", () => {
  const value = {
    ...chapter,
    units: [{ ...chapter.units[0], kind: "literal" }],
    translations: {},
  };
  expect(validateTranslationChapter(value, chapter)).toEqual(value);
  expect(() =>
    validateTranslationChapter(
      { ...value, translations: { s0: "Changed code" } },
      chapter,
    ),
  ).toThrow();
});
