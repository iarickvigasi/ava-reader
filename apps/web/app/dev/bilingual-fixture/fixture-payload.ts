import type { ReaderStatusPayload } from "@/lib/api-types/reader";
import type {
  BilingualChapter,
  BilingualUnit,
} from "@/lib/api-types/bilingual";
import { fixtureBlocks, LONG_TRANSLATION } from "./fixture-blocks";

export const FIXTURE_ID = "bilingual-fixture";
const CHAPTER_ID = "bilingual-fixture-chapter";
export const fixturePayload: ReaderStatusPayload = {
  status: "READY",
  activeChapterId: CHAPTER_ID,
  book: {
    libraryItemId: FIXTURE_ID,
    slug: FIXTURE_ID,
    title: "Bilingual fixture",
    authors: ["Fixture Writer"],
    language: "en",
    primaryFormat: "EPUB",
  },
  chapters: [
    {
      chapterId: CHAPTER_ID,
      blocks: fixtureBlocks,
      title: "Bilingual fixture",
      label: "Fixture chapter",
      href: "#fixture",
      spineIndex: 0,
      previousChapterId: null,
      nextChapterId: null,
    },
  ],
  progress: {
    chapterLabel: "Fixture chapter",
    completionPercent: 0,
    lastReadAt: null,
    locator: null,
  },
  toc: [
    {
      id: "fixture-toc",
      chapterId: CHAPTER_ID,
      blockId: "fixture-heading",
      anchorId: null,
      children: [],
      href: "#fixture",
      label: "Fixture chapter",
      spineIndex: 0,
    },
  ],
};

export function fixtureTranslation(targetLang: string): BilingualChapter {
  const units: BilingualUnit[] = fixtureBlocks.flatMap((block) => {
    if (block.kind === "image")
      return [
        {
          id: block.id,
          blockId: block.id,
          startOffset: 0,
          endOffset: 0,
          text: "",
          kind: "image",
        },
      ];
    if (block.kind !== "list") return sentences(block.text, block.id);
    let offset = 0;
    return block.items
      .map((item) => {
        const units = sentences(item.text, block.id, offset, item.id);
        offset += item.text.length;
        return units;
      })
      .flat();
  });
  return {
    libraryItemId: FIXTURE_ID,
    chapterId: CHAPTER_ID,
    contentRevision: "fixture-revision-2",
    translationVersion: 1,
    targetLang,
    units,
    translations: Object.fromEntries(
      units
        .filter((unit) => unit.kind === "sentence")
        .map((unit) => [unit.id, translatedText(unit)]),
    ),
  };
}

function sentences(
  text: string,
  blockId: string,
  offset = 0,
  itemId?: string,
): BilingualUnit[] {
  const segments = Array.from(
    new Intl.Segmenter("en", { granularity: "sentence" }).segment(text),
  );
  return segments.map(({ segment, index }, ordinal) => ({
    id:
      segments.length === 1
        ? (itemId ?? blockId)
        : `${itemId ?? blockId}-${ordinal}`,
    blockId,
    ...(itemId ? { itemId } : {}),
    startOffset: offset + index,
    endOffset: offset + index + segment.length,
    text: segment,
    kind: "sentence",
  }));
}

function translatedText(unit: BilingualUnit): string {
  if (unit.id === "fixture-long") return LONG_TRANSLATION;
  const opening: Record<string, string> = {
    "fixture-opening-0": "We left the quiet village before the first light. ",
    "fixture-opening-1": "A pale dawn slowly brightened the valley. ",
    "fixture-opening-2": "Birds began to sing among the trees. ",
    "fixture-opening-3": "The wide river crossed the valley below us.",
  };
  return opening[unit.id] ?? `Translated: ${unit.text}`;
}
