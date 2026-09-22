import { describe, expect, it } from "vitest";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import { resolveMeasurementSnapshot } from "./measurement-snapshot";

const chapter: BilingualChapter = {
  libraryItemId: "book",
  chapterId: "chapter",
  contentRevision: "revision",
  targetLang: "es",
  translationVersion: 1,
  translations: { first: "Primera." },
  units: [
    {
      id: "first",
      blockId: "p",
      kind: "sentence",
      text: "First.",
      startOffset: 0,
      endOffset: 6,
    },
    {
      id: "second",
      blockId: "p",
      kind: "sentence",
      text: "Second.",
      startOffset: 7,
      endOffset: 14,
    },
  ],
};
const snapshot = { chapter, key: "320:600:1", result: { pageCount: 2 } };

describe("bilingual measurement snapshots", () => {
  it("keeps both measured chapter and geometry when the next sentence arrives", () => {
    const incoming = {
      ...chapter,
      translations: { ...chapter.translations, second: "Segunda." },
    };
    const pending = resolveMeasurementSnapshot(
      snapshot,
      incoming,
      snapshot.key,
    );
    expect(pending.measuredChapter).toBe(chapter);
    expect(pending.measurement).toBe(snapshot.result);
    expect(pending.isMeasuring).toBe(true);
    expect(pending.measuredChapter?.translations.second).toBeUndefined();
  });

  it("replaces translated text and geometry atomically after measuring the new content", () => {
    const incoming = {
      ...chapter,
      translations: { first: "A much longer replacement translation." },
    };
    const pending = resolveMeasurementSnapshot(
      snapshot,
      incoming,
      snapshot.key,
    );
    expect(pending.measuredChapter?.translations.first).toBe("Primera.");
    expect(pending.measurement?.pageCount).toBe(2);
    expect(pending.isMeasuring).toBe(true);
    const next = {
      chapter: incoming,
      key: snapshot.key,
      result: { pageCount: 4 },
    };
    const committed = resolveMeasurementSnapshot(next, incoming, snapshot.key);
    expect(committed.measuredChapter).toBe(incoming);
    expect(committed.measurement).toBe(next.result);
    expect(committed.isMeasuring).toBe(false);
  });

  it("keeps the same snapshot through several arrivals before their measurement runs", () => {
    const incoming = {
      ...chapter,
      translations: { first: "Uno.", second: "Dos." },
    };
    const latest = {
      ...incoming,
      translations: { ...incoming.translations, second: "Otra traducción." },
    };
    expect(
      resolveMeasurementSnapshot(snapshot, incoming, snapshot.key).measurement,
    ).toBe(snapshot.result);
    expect(
      resolveMeasurementSnapshot(snapshot, latest, snapshot.key)
        .measuredChapter,
    ).toBe(chapter);
  });

  it.each([
    "libraryItemId",
    "chapterId",
    "contentRevision",
    "targetLang",
    "translationVersion",
  ])("never displays a previous snapshot after %s changes", (field) => {
    const incoming = {
      ...chapter,
      [field]: field === "translationVersion" ? 2 : "different",
    };
    expect(
      resolveMeasurementSnapshot(snapshot, incoming, snapshot.key),
    ).toEqual({
      measuredChapter: null,
      measurement: null,
      isMeasuring: true,
    });
  });

  it.each(["300:600:1", "320:400:1", "320:600:1.2"])(
    "invalidates old content geometry after layout becomes %s",
    (key) => {
      expect(resolveMeasurementSnapshot(snapshot, chapter, key)).toEqual({
        measuredChapter: null,
        measurement: null,
        isMeasuring: true,
      });
    },
  );

  it("keeps the normal ready state stable and distinguishes loading from absent content", () => {
    expect(resolveMeasurementSnapshot(snapshot, chapter, snapshot.key)).toEqual(
      {
        measuredChapter: chapter,
        measurement: snapshot.result,
        isMeasuring: false,
      },
    );
    expect(resolveMeasurementSnapshot(null, chapter, snapshot.key)).toEqual({
      measuredChapter: null,
      measurement: null,
      isMeasuring: true,
    });
    expect(resolveMeasurementSnapshot(snapshot, null, snapshot.key)).toEqual({
      measuredChapter: null,
      measurement: null,
      isMeasuring: false,
    });
  });
});
