import { describe, expect, it, vi } from "vitest";
import { bilingualReaderStatus } from "./bilingual-reader-status";

type Input = Parameters<typeof bilingualReaderStatus>[0];
const input = (): Input => ({
  chapter: {
    libraryItemId: "book",
    chapterId: "chapter",
    contentRevision: "v1",
    translationVersion: 1,
    targetLang: "French",
    translations: {},
    units: ["visible", "upcoming"].map((id) => ({
      id,
      kind: "sentence",
      blockId: id,
      text: "Hello",
      startOffset: 0,
      endOffset: 5,
    })),
  },
  page: {
    unitIndexes: [0],
    startUnitId: "visible",
    usedHeight: 100,
    isComplete: true,
  },
  cache: { chapter: null, status: "ready", error: null, retry: vi.fn() },
  demand: { available: true, activeIds: [], error: null, retry: vi.fn() },
  alignmentDemand: { activeIds: [], error: null, retry: vi.fn() },
  regeneration: {
    busy: null,
    error: null,
    alignmentFailed: false,
    hasSentences: true,
    redoTranslation: vi.fn(),
    redoPairs: vi.fn(),
    retry: vi.fn(),
  },
});

describe("bilingual footer generation status", () => {
  it("shows independent activity for visible translation and matching", () => {
    const state = input();
    state.demand.activeIds = ["visible"];
    expect(bilingualReaderStatus(state).generation).toEqual({
      translation: true,
      pairs: false,
    });
    state.alignmentDemand.activeIds = ["visible", "upcoming"];
    expect(bilingualReaderStatus(state).generation).toEqual({
      translation: true,
      pairs: true,
    });
    state.demand.activeIds = [];
    expect(bilingualReaderStatus(state).generation).toEqual({
      translation: false,
      pairs: true,
    });
  });
  it("ignores prefetch and follows the current page after navigation", () => {
    const state = input();
    state.demand.activeIds = ["upcoming"];
    state.alignmentDemand.activeIds = ["upcoming"];
    expect(bilingualReaderStatus(state).generation).toEqual({
      translation: false,
      pairs: false,
    });
    state.page!.unitIndexes = [1];
    expect(bilingualReaderStatus(state).generation).toEqual({
      translation: true,
      pairs: true,
    });
  });
  it.each(["translation", "pairs"] as const)(
    "keeps manual %s regeneration busy",
    (kind) => {
      const state = input();
      state.regeneration.busy = kind;
      expect(bilingualReaderStatus(state).generation[kind]).toBe(true);
      state.regeneration.busy = null;
      expect(bilingualReaderStatus(state).generation[kind]).toBe(false);
    },
  );
  it("missing content alone does not imply an active request offline or after failure", () => {
    const state = input();
    state.demand.available = false;
    state.demand.error = "Failed";
    const status = bilingualReaderStatus(state);
    expect(status.pending).toBe(true);
    expect(status.error).toBe("Failed");
    expect(status.generation).toEqual({ translation: false, pairs: false });
  });
});
