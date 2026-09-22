import { describe, expect, it } from "vitest";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import type { ReaderBlock, ReaderInline } from "@/lib/api-types/reader";
import { flowSentenceParts } from "./flow-sentence-parts";
import { groupFlowContent } from "./group-flow-content";

const block: ReaderBlock = {
  id: "p",
  kind: "paragraph",
  text: "normalized text",
  inlines: [
    { kind: "text", text: "One." },
    { kind: "text", text: "\n\n", italic: true },
    { kind: "text", text: "😀 Two.", bold: true },
  ],
};
const chapter: BilingualChapter = {
  libraryItemId: "book",
  chapterId: "chapter",
  contentRevision: "r",
  translationVersion: 1,
  targetLang: "es",
  translations: { two: " Dos. " },
  units: [
    {
      id: "one",
      blockId: "p",
      kind: "sentence",
      text: "One.",
      startOffset: 0,
      endOffset: 4,
    },
    {
      id: "two",
      blockId: "p",
      kind: "sentence",
      text: "😀 Two.",
      startOffset: 6,
      endOffset: 13,
    },
  ],
};
const text = (inlines: ReaderInline[]) =>
  inlines.map((inline) => (inline.kind === "text" ? inline.text : "")).join("");

describe("sentence assembly inside original block flow", () => {
  it("preserves exact raw spacing and UTF-16 offsets between catalog units", () => {
    const group = groupFlowContent(chapter.units, [block], [0, 1])[0];
    const parts = flowSentenceParts(group.units, block, chapter, "source");
    expect(
      parts.map((part) => text([...part.before, ...part.inlines])).join(""),
    ).toBe("One.\n\n😀 Two.");
    expect(parts[1].before).toEqual([
      { kind: "text", text: "\n\n", italic: true },
    ]);
    expect(parts[1].inlines).toEqual([
      { kind: "text", text: "😀 Two.", bold: true },
    ]);
  });

  it("reserves separators around missing sentences without inventing translated text", () => {
    const group = groupFlowContent(chapter.units, [block], [0, 1])[0];
    const parts = flowSentenceParts(group.units, block, chapter, "translation");
    expect(parts[0].missing).toBe(true);
    expect(
      parts.map((part) => text([...part.before, ...part.inlines])).join(""),
    ).toBe(" Dos.");
    expect(parts[1].missing).toBe(false);
  });

  it("starts a later sentence without pulling unselected preceding text into its paragraph", () => {
    const group = groupFlowContent(chapter.units, [block], [1])[0];
    expect(
      flowSentenceParts(group.units, block, chapter, "source")[0].before,
    ).toEqual([]);
  });
});
