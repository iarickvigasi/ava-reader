import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";

import { getDb } from "../../db";
import {
  awaitTranslationPersistDrain,
  getTranslationBucket,
  subscribeToTranslations,
} from "./bucket";
import { ensureSentenceTranslations } from "./mutations";
import { revalidateTranslationChapter } from "./sync";
import {
  chapter,
  deferred,
  translated,
  translationTestLifecycle,
  validatedBucket,
} from "./test-fixtures";

translationTestLifecycle();

describe("local cache, saved database, then AI", () => {
  it("hydrates a saved chapter from IndexedDB at once and serves it while GET is pending", async () => {
    const saved = {
      ...chapter,
      translations: translated(["s0", "s1", "s2"]).translations,
    };
    await getDb().translations.put({ ...saved, fetchedAt: "saved" });
    const response = deferred<Response>();
    const fetcher = vi.fn().mockReturnValue(response.promise);
    vi.stubGlobal("fetch", fetcher);
    const bucket = getTranslationBucket(chapter);
    bucket.getToken = async () => "token";
    await bucket.hydrated;
    const read = revalidateTranslationChapter(bucket, true);
    await ensureSentenceTranslations(chapter, ["s0", "s1", "s2"]);
    expect(bucket.snapshot.chapter).toEqual(saved);
    expect(fetcher.mock.calls.every((call) => call[1].method === "GET")).toBe(
      true,
    );
    response.resolve(Response.json(saved));
    await read;
  });

  it("waits for a reopening GET and hydrates all saved sentences before considering AI", async () => {
    const bucket = await validatedBucket({
      ...chapter,
      translations: { s0: "Saved locally" },
    });
    const response = deferred<Response>();
    const started = deferred<void>();
    const fetcher = vi.fn().mockImplementation(() => {
      started.resolve();
      return response.promise;
    });
    vi.stubGlobal("fetch", fetcher);
    const counts: number[] = [];
    const unsubscribe = subscribeToTranslations(() =>
      counts.push(Object.keys(bucket.snapshot.chapter!.translations).length),
    );
    const read = revalidateTranslationChapter(bucket, true);
    const demand = ensureSentenceTranslations(chapter, ["s0", "s1", "s2"]);
    await started.promise;
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1].method).toBe("GET");
    expect(bucket.snapshot.chapter?.translations).toEqual({
      s0: "Saved locally",
    });
    response.resolve(
      Response.json({ ...chapter, ...translated(["s0", "s1", "s2"]) }),
    );
    await Promise.all([read, demand]);
    await awaitTranslationPersistDrain();
    unsubscribe();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(counts).toContain(3);
    expect(counts).not.toContain(2);
    expect(
      Object.keys(
        (await getDb().translations.get(["book", "chapter", "Spanish"]))!
          .translations,
      ),
    ).toHaveLength(3);
  });

  it("starts GET itself for a local miss and generates only IDs still missing afterward", async () => {
    const bucket = await validatedBucket({
      ...chapter,
      translations: { s0: "Local" },
    });
    bucket.revalidated = false;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ ...chapter, ...translated(["s0", "s1"]) }),
      )
      .mockResolvedValueOnce(Response.json(translated(["s2"])));
    vi.stubGlobal("fetch", fetcher);
    await ensureSentenceTranslations(chapter, ["s1", "s2"]);
    expect(fetcher.mock.calls.map((call) => call[1].method)).toEqual([
      "GET",
      "POST",
    ]);
    expect(JSON.parse(fetcher.mock.calls[1][1].body).sentenceIds).toEqual([
      "s2",
    ]);
    expect(Object.keys(bucket.snapshot.chapter!.translations)).toHaveLength(3);
  });

  it("does not generate against an old source revision returned before GET completed", async () => {
    const bucket = await validatedBucket();
    bucket.revalidated = false;
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ ...chapter, contentRevision: "new-revision" }),
      );
    vi.stubGlobal("fetch", fetcher);
    await ensureSentenceTranslations(chapter, ["s0"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1].method).toBe("GET");
    expect(bucket.snapshot.chapter?.contentRevision).toBe("new-revision");
  });
});
