import type {
  ReaderBookPayload,
  ReaderChapterPayload,
  ReaderRangeLocator,
} from "@/lib/api-types";
export const sentence =
  "She greeted her host with bonsoir before sitting down.";
export const passage = `The evening began. ${sentence} Dinner was ready.`;
export const book = { language: "en" } as ReaderBookPayload;
export const chapters = [
  {
    chapterId: "one",
    blocks: [{ id: "first", kind: "paragraph", text: passage }],
  },
] as ReaderChapterPayload[];
export const locator = {
  chapterId: "one",
  startBlockId: "first",
  endBlockId: "first",
  startOffset: passage.indexOf("bonsoir"),
  endOffset: passage.indexOf("bonsoir") + 7,
} as ReaderRangeLocator;
