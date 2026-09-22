import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";

import { getDb, setActiveUser } from "../../db";
import { clearAllTranslationBuckets } from "./bucket";
import { ensureSentenceTranslations } from "./mutations";
import { applyTranslationChapter, revalidateTranslationChapter } from "./sync";
import {
  chapter,
  deferred,
  readyBucket,
  translated,
  translationTestLifecycle,
  validatedBucket,
} from "./test-fixtures";

translationTestLifecycle();

describe("translation identity fences", () => {
  it("drops a generation result whose source revision was replaced", async () => {
    const response = deferred<Response>();
    const started = deferred<void>();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        started.resolve();
        return response.promise;
      }),
    );
    const bucket = await validatedBucket();
    const generation = ensureSentenceTranslations(chapter, ["s0"]);
    await started.promise;
    applyTranslationChapter(bucket, {
      ...chapter,
      contentRevision: "revision-2",
    });
    response.resolve(Response.json(translated(["s0"])));
    await generation;
    expect(bucket.snapshot.chapter?.contentRevision).toBe("revision-2");
    expect(bucket.snapshot.chapter?.translations).toEqual({});
  });

  it("cannot publish or persist an old account's GET after switching", async () => {
    const response = deferred<Response>();
    const started = deferred<void>();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        started.resolve();
        return response.promise;
      }),
    );
    const previous = await readyBucket();
    const request = revalidateTranslationChapter(previous);
    await started.promise;
    clearAllTranslationBuckets();
    setActiveUser("new-user");
    const next = await readyBucket();
    response.resolve(Response.json(chapter));
    await request;
    expect(previous.snapshot.chapter).toBeNull();
    expect(next.snapshot.chapter).toBeNull();
    expect(await getDb().translations.count()).toBe(0);
  });

  it("cannot persist an old account's completed POST after switching", async () => {
    const response = deferred<Response>();
    const started = deferred<void>();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        started.resolve();
        return response.promise;
      }),
    );
    const previous = await validatedBucket();
    await previous.pendingPersist;
    const request = ensureSentenceTranslations(chapter, ["s0"]);
    await started.promise;
    clearAllTranslationBuckets();
    setActiveUser("new-user");
    response.resolve(Response.json(translated(["s0"])));
    await expect(request).rejects.toThrow();
    expect(await getDb().translations.count()).toBe(0);
  });
});
