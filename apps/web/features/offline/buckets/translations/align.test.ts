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
  version: 1,
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
      vi
        .fn()
        .mockResolvedValue(
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
