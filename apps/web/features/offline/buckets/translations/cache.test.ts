import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";

import { getDb } from "../../db";
import { __setNetStateForTests } from "../../net/net-state";
import {
  awaitTranslationPersistDrain,
  clearAllTranslationBuckets,
  getTranslationBucket,
} from "./bucket";
import { ensureSentenceTranslations } from "./mutations";
import { applyTranslationChapter, revalidateTranslationChapter } from "./sync";
import {
  chapter,
  readyBucket,
  translated,
  translationTestLifecycle,
} from "./test-fixtures";

translationTestLifecycle();

describe("translation chapter cache", () => {
  it("merges a sparse revalidation without losing completed sentences", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        ...chapter,
        translations: { s1: "Second translation" },
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const bucket = await readyBucket();
    applyTranslationChapter(bucket, {
      ...chapter,
      translations: { s0: "First translation" },
    });
    await revalidateTranslationChapter(bucket);
    await awaitTranslationPersistDrain();
    expect(bucket.snapshot.chapter?.translations).toEqual({
      s0: "First translation",
      s1: "Second translation",
    });
    expect(
      (await getDb().translations.get(["book", "chapter", "Spanish"]))
        ?.translations,
    ).toEqual(bucket.snapshot.chapter?.translations);
  });

  it("reads chapter metadata without generating and revalidates only once per online session", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(chapter));
    vi.stubGlobal("fetch", fetcher);
    const bucket = await readyBucket();
    await revalidateTranslationChapter(bucket);
    await revalidateTranslationChapter(bucket);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toContain(
      "/translations/chapters/chapter?targetLang=Spanish",
    );
    expect(fetcher.mock.calls[0][1].method).toBe("GET");
    expect(bucket.snapshot.chapter).toEqual(chapter);
  });

  it("persists completed sentences and reuses them after reload offline", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(chapter))
      .mockResolvedValueOnce(Response.json(translated(["s0", "s1"])));
    vi.stubGlobal("fetch", fetcher);
    const bucket = await readyBucket();
    await revalidateTranslationChapter(bucket);
    await ensureSentenceTranslations(chapter, ["s0", "s1"]);
    await awaitTranslationPersistDrain();
    expect(
      (await getDb().translations.get(["book", "chapter", "Spanish"]))
        ?.translations,
    ).toEqual(translated(["s0", "s1"]).translations);
    clearAllTranslationBuckets();
    __setNetStateForTests(false);
    const reopened = getTranslationBucket(chapter);
    await reopened.hydrated;
    await ensureSentenceTranslations(chapter, ["s1", "s0"]);
    expect(reopened.snapshot.chapter?.translations.s0).toBe("Spanish s0");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps a complete cached page readable on network failure and retries on demand", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(chapter))
      .mockRejectedValueOnce(new Error("Unavailable"))
      .mockResolvedValueOnce(
        Response.json({ ...chapter, translations: { s0: "Saved elsewhere" } }),
      );
    vi.stubGlobal("fetch", fetcher);
    const bucket = await readyBucket();
    await revalidateTranslationChapter(bucket);
    await revalidateTranslationChapter(bucket, true);
    expect(bucket.snapshot.status).toBe("error");
    expect(bucket.snapshot.chapter).toEqual(chapter);
    await revalidateTranslationChapter(bucket, true);
    expect(bucket.snapshot.status).toBe("ready");
    expect(bucket.snapshot.chapter?.translations.s0).toBe("Saved elsewhere");
  });

  it("revalidates after offline and rejects an incomplete model response atomically", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(chapter))
      .mockResolvedValueOnce(Response.json(chapter))
      .mockResolvedValueOnce(Response.json(translated(["s0"])));
    vi.stubGlobal("fetch", fetcher);
    const bucket = await readyBucket();
    await revalidateTranslationChapter(bucket);
    __setNetStateForTests(false);
    await revalidateTranslationChapter(bucket);
    __setNetStateForTests(true);
    await revalidateTranslationChapter(bucket);
    await expect(
      ensureSentenceTranslations(chapter, ["s0", "s1"]),
    ).rejects.toThrow("did not match");
    await awaitTranslationPersistDrain();
    expect(bucket.snapshot.chapter?.translations).toEqual({});
    expect(
      (await getDb().translations.get(["book", "chapter", "Spanish"]))
        ?.translations,
    ).toEqual({});
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
