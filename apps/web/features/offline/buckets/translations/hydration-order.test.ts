import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";

import { getDb } from "../../db";
import { getTranslationBucket } from "./bucket";
import { ensureSentenceTranslations } from "./mutations";
import { revalidateTranslationChapter } from "./sync";
import {
  chapter,
  deferred,
  translated,
  translationTestLifecycle,
} from "./test-fixtures";
import type { TranslationChapterRow } from "./types";

translationTestLifecycle();

describe("translation hydration order", () => {
  it("finishes IndexedDB hydration before requesting the saved chapter from the server", async () => {
    const db = getDb();
    const localRead = deferred<TranslationChapterRow>();
    const readSpy = vi
      .spyOn(db.translations, "get")
      .mockImplementationOnce(
        () => localRead.promise as ReturnType<typeof db.translations.get>,
      );
    const saved = { ...chapter, ...translated(["s0", "s1", "s2"]) };
    const fetcher = vi.fn().mockResolvedValue(Response.json(saved));
    vi.stubGlobal("fetch", fetcher);
    const bucket = getTranslationBucket(chapter);
    bucket.getToken = async () => "token";
    const revalidation = revalidateTranslationChapter(bucket);
    const demand = ensureSentenceTranslations(chapter, ["s0", "s1", "s2"]);
    await Promise.resolve();
    expect(fetcher).not.toHaveBeenCalled();
    expect(bucket.snapshot.chapter).toBeNull();
    localRead.resolve({
      ...chapter,
      fetchedAt: "saved",
      translations: { s0: "Cached" },
    });
    await Promise.all([revalidation, demand]);
    readSpy.mockRestore();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1].method).toBe("GET");
    expect(bucket.snapshot.chapter?.translations).toEqual(saved.translations);
  });
});
