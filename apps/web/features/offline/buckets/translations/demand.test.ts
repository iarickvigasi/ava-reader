import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";

import { ensureSentenceTranslations } from "./mutations";
import {
  chapter,
  deferred,
  readyBucket,
  translated,
  translationTestLifecycle,
  validatedBucket,
} from "./test-fixtures";

translationTestLifecycle();

describe("translation demand", () => {
  it("keeps each generation batch within the API sentence limit", async () => {
    const large = {
      ...chapter,
      units: Array.from({ length: 66 }, (_, index) => ({
        ...chapter.units[0],
        id: `s${index}`,
        text: `Sentence ${index}.`,
      })),
    };
    const fetcher = vi
      .fn()
      .mockImplementation((_url: string, init: RequestInit) => {
        const { sentenceIds } = JSON.parse(init.body as string) as {
          sentenceIds: string[];
        };
        return Promise.resolve(Response.json(translated(sentenceIds)));
      });
    vi.stubGlobal("fetch", fetcher);
    const bucket = await validatedBucket(large);
    await ensureSentenceTranslations(
      large,
      large.units.map((unit) => unit.id),
    );
    expect(
      fetcher.mock.calls.map(
        (call) => JSON.parse(call[1].body as string).sentenceIds.length,
      ),
    ).toEqual([64, 2]);
    expect(Object.keys(bucket.snapshot.chapter!.translations)).toHaveLength(66);
  });

  it("coalesces overlapping requests and generates only missing sentence IDs", async () => {
    const response = deferred<Response>();
    const started = deferred<void>();
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => {
        started.resolve();
        return response.promise;
      })
      .mockResolvedValueOnce(Response.json(translated(["s2"])));
    vi.stubGlobal("fetch", fetcher);
    const bucket = await validatedBucket();
    const first = ensureSentenceTranslations(chapter, ["s0", "s1"]);
    await started.promise;
    const second = ensureSentenceTranslations(chapter, ["s1", "s2"]);
    response.resolve(Response.json(translated(["s0", "s1"])));
    await Promise.all([first, second]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).sentenceIds).toEqual([
      "s0",
      "s1",
    ]);
    expect(JSON.parse(fetcher.mock.calls[1][1].body).sentenceIds).toEqual([
      "s2",
    ]);
    expect(Object.keys(bucket.snapshot.chapter!.translations)).toEqual([
      "s0",
      "s1",
      "s2",
    ]);
  });

  it("abandons cancelled navigation without caching its late response or queuing more work", async () => {
    const response = deferred<Response>();
    const started = deferred<void>();
    const fetcher = vi.fn().mockImplementation(() => {
      started.resolve();
      return response.promise;
    });
    vi.stubGlobal("fetch", fetcher);
    const bucket = await validatedBucket();
    const aborter = new AbortController();
    const request = ensureSentenceTranslations(chapter, ["s0"], aborter.signal);
    await started.promise;
    aborter.abort();
    response.resolve(Response.json(translated(["s0"])));
    await expect(request).rejects.toThrow();
    expect(bucket.snapshot.chapter?.translations).toEqual({});
    expect(bucket.generationRun).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects wrong-language results and keeps separate language caches", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(translated(["s0"], { targetLang: "French" })),
        ),
    );
    const bucket = await validatedBucket();
    await expect(ensureSentenceTranslations(chapter, ["s0"])).rejects.toThrow(
      "did not match",
    );
    const french = await readyBucket({ ...chapter, targetLang: "French" });
    expect(french.snapshot.chapter).toBeNull();
    expect(bucket.snapshot.chapter?.translations).toEqual({});
  });
});
