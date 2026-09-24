import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import type { SentenceAlignment } from "@/lib/api-types/bilingual";
import { regeneratePage } from "./regenerate";
import {
  chapter,
  translationTestLifecycle,
  validatedBucket,
} from "./test-fixtures";

translationTestLifecycle();
const map = (index: number): SentenceAlignment => ({
  version: 3,
  sourceText: chapter.units[index].text,
  translatedText: "Old",
  groups: [
    {
      id: "0",
      source: [{ start: 0, end: 5 }],
      translation: [{ start: 0, end: 3 }],
    },
  ],
});
const saved = {
  ...chapter,
  translations: { s0: "Old", s1: "Old" },
  alignments: { s0: map(0), s1: map(1) },
};

describe("page regeneration", () => {
  it("regenerates just the selected translation and invalidates only its pairs even for identical text", async () => {
    const bucket = await validatedBucket(saved);
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ ...chapter, translations: { s0: "Old" } }),
      );
    vi.stubGlobal("fetch", fetcher);
    await regeneratePage(
      saved,
      ["s0"],
      "translation",
      new AbortController().signal,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
      sentenceIds: ["s0"],
      regenerate: true,
    });
    expect(bucket.snapshot.chapter?.translations).toEqual(saved.translations);
    expect(bucket.snapshot.chapter?.alignments).toEqual({ s1: map(1) });
  });

  it("forces only the selected pairs without regenerating translations", async () => {
    const bucket = await validatedBucket(saved);
    const replacement = {
      ...map(0),
      groups: [
        {
          id: "new",
          source: [{ start: 6, end: 14 }],
          translation: [{ start: 0, end: 3 }],
        },
      ],
    };
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ ...chapter, alignments: { s0: replacement } }),
      );
    vi.stubGlobal("fetch", fetcher);
    await regeneratePage(saved, ["s0"], "pairs", new AbortController().signal);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toContain("/align");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
      sentenceIds: ["s0"],
      regenerate: true,
    });
    expect(bucket.snapshot.chapter?.translations).toEqual(saved.translations);
    expect(bucket.snapshot.chapter?.alignments).toEqual({
      s0: replacement,
      s1: map(1),
    });
  });

  it("does not start a canceled regeneration", async () => {
    await validatedBucket(saved);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    controller.abort();
    await expect(
      regeneratePage(saved, ["s0"], "pairs", controller.signal),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
