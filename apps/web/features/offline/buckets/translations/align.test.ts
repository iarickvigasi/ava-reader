import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import type { SentenceAlignment } from "@/lib/api-types/bilingual";
import { ensureSentenceAlignments } from "./align";
import { applyTranslationChapter } from "./sync";
import {
  awaitTranslationPersistDrain,
  clearAllTranslationBuckets,
  getTranslationBucket,
} from "./bucket";
import {
  chapter,
  deferred,
  translationTestLifecycle,
  validatedBucket,
} from "./test-fixtures";

translationTestLifecycle();
const saved = { ...chapter, translations: { s0: "Primera frase." } };
const alignment: SentenceAlignment = {
  version: 2,
  sourceText: chapter.units[0].text,
  translatedText: saved.translations.s0,
  groups: [
    {
      id: "0",
      source: [{ start: 0, end: 5 }],
      translation: [{ start: 0, end: 7 }],
    },
  ],
};
const signal = () => new AbortController().signal;

describe("alignment enrichment", () => {
  it("aligns a saved translation once and reuses the map after offline reload", async () => {
    const bucket = await validatedBucket(saved);
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ ...chapter, alignments: { s0: alignment } }),
      );
    vi.stubGlobal("fetch", fetcher);
    await ensureSentenceAlignments(saved, ["s0"], signal());
    expect(bucket.snapshot.chapter?.translations).toEqual(saved.translations);
    expect(fetcher.mock.calls[0][0]).toContain("/translations/align");
    await awaitTranslationPersistDrain();
    clearAllTranslationBuckets();
    const reopened = getTranslationBucket(saved);
    await reopened.hydrated;
    expect(reopened.snapshot.chapter?.alignments?.s0).toEqual(alignment);
    await ensureSentenceAlignments(saved, ["s0"], signal());
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("keeps translations readable if alignment fails or refers to a different text", async () => {
    const bucket = await validatedBucket(saved);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          ...chapter,
          alignments: { s0: { ...alignment, translatedText: "Changed" } },
        }),
      ),
    );
    await expect(
      ensureSentenceAlignments(saved, ["s0"], signal()),
    ).rejects.toThrow("incomplete");
    expect(bucket.snapshot.status).toBe("ready");
    expect(bucket.snapshot.chapter?.translations).toEqual(saved.translations);
    expect(bucket.snapshot.chapter?.alignments).toBeUndefined();
  });

  it("keeps partial alignments and requests only missing sentences on retry", async () => {
    const two = {
      ...saved,
      translations: { ...saved.translations, s1: "Segunda frase." },
    };
    const bucket = await validatedBucket(two);
    const second = {
      ...alignment,
      sourceText: chapter.units[1].text,
      translatedText: two.translations.s1,
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ ...chapter, alignments: { s0: alignment } }),
      )
      .mockResolvedValueOnce(
        Response.json({ ...chapter, alignments: { s1: second } }),
      );
    vi.stubGlobal("fetch", fetcher);
    await expect(
      ensureSentenceAlignments(two, ["s0", "s1"], signal()),
    ).rejects.toThrow("incomplete");
    expect(bucket.snapshot.chapter?.alignments?.s0).toEqual(alignment);
    await ensureSentenceAlignments(two, ["s0", "s1"], signal());
    expect(JSON.parse(fetcher.mock.calls[1][1].body).sentenceIds).toEqual([
      "s1",
    ]);
    expect(bucket.snapshot.chapter?.alignments).toEqual({
      s0: alignment,
      s1: second,
    });
  });

  it("invalidates stale maps when a persisted translation changes", async () => {
    const bucket = await validatedBucket({
      ...saved,
      alignments: { s0: alignment },
    });
    applyTranslationChapter(bucket, {
      ...saved,
      translations: { s0: "Different translation." },
    });
    expect(bucket.snapshot.chapter?.alignments).toEqual({});
  });

  it("deduplicates overlapping requests", async () => {
    await validatedBucket(saved);
    const response = deferred<Response>();
    const fetcher = vi.fn().mockReturnValue(response.promise);
    vi.stubGlobal("fetch", fetcher);
    const first = ensureSentenceAlignments(saved, ["s0"], signal());
    const second = ensureSentenceAlignments(saved, ["s0"], signal());
    response.resolve(
      Response.json({ ...chapter, alignments: { s0: alignment } }),
    );
    await Promise.all([first, second]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
