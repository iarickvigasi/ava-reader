import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";

import { ensureSentenceTranslations } from "./mutations";
import { TranslationRequestError } from "./request-error";
import { revalidateTranslationChapter } from "./sync";
import {
  chapter,
  deferred,
  translated,
  translationTestLifecycle,
  validatedBucket,
} from "./test-fixtures";

translationTestLifecycle();

describe("saved translation read failures", () => {
  it("never falls through to AI after a failed GET, even if an earlier read succeeded", async () => {
    const bucket = await validatedBucket();
    const response = deferred<Response>();
    const started = deferred<void>();
    const fetcher = vi.fn().mockImplementation(() => {
      started.resolve();
      return response.promise;
    });
    vi.stubGlobal("fetch", fetcher);
    const read = revalidateTranslationChapter(bucket, true);
    const demand = ensureSentenceTranslations(chapter, ["s0"]).catch(
      (error) => error,
    );
    await started.promise;
    response.resolve(
      Response.json({ message: "Database unavailable" }, { status: 503 }),
    );
    await read;
    const error = await demand;
    expect(error).toBeInstanceOf(TranslationRequestError);
    expect(error.retryable).toBe(true);
    expect(bucket.revalidated).toBe(false);
    expect(bucket.snapshot.error).toBe("Database unavailable");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1].method).toBe("GET");
  });

  it("cancels abandoned demand during GET while allowing the bulk read to warm the cache", async () => {
    const bucket = await validatedBucket();
    const response = deferred<Response>();
    const started = deferred<void>();
    const fetcher = vi.fn().mockImplementation(() => {
      started.resolve();
      return response.promise;
    });
    vi.stubGlobal("fetch", fetcher);
    const read = revalidateTranslationChapter(bucket, true);
    const controller = new AbortController();
    const demand = ensureSentenceTranslations(
      chapter,
      ["s0"],
      controller.signal,
    ).catch((error) => error);
    await started.promise;
    controller.abort();
    expect((await demand).name).toBe("AbortError");
    response.resolve(
      Response.json({ ...chapter, ...translated(["s0", "s1", "s2"]) }),
    );
    await read;
    expect(Object.keys(bucket.snapshot.chapter!.translations)).toHaveLength(3);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
