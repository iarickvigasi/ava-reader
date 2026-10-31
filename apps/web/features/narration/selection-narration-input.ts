import type {
  ReaderBookPayload,
  ReaderChapterPayload,
  ReaderRangeLocator,
} from "@/lib/api-types";
import { selectionSentenceContext } from "@/features/reader/selection-sentence-context";

export type NarrationInput = {
  text: string;
  context?: string;
  languageHint?: string;
};
const MAX_CONTEXT_CHARS = 8192;

export function selectionNarrationInput(input: {
  book: ReaderBookPayload;
  chapters: ReaderChapterPayload[];
  text: string | null;
  locator: ReaderRangeLocator | null;
  context: string | null;
}): NarrationInput {
  const text = input.text?.trim() ?? "";
  const languageHint = (
    input.locator?.translation?.targetLang ?? input.book.language
  )?.slice(0, 128);
  const context = input.locator?.translation
    ? input.context?.replace(/^Selected text language: [^\n]*\n/, "")
    : containingSentences(input.chapters, input.locator, text);
  return {
    text,
    languageHint: languageHint || undefined,
    context: context?.slice(0, MAX_CONTEXT_CHARS) || undefined,
  };
}

function containingSentences(
  chapters: ReaderChapterPayload[],
  locator: ReaderRangeLocator | null,
  selectedText: string,
) {
  if (!locator) return undefined;
  const blocks = chapters.find(
    (chapter) => chapter.chapterId === locator.chapterId,
  )?.blocks;
  if (!blocks) return undefined;
  const first = blocks.findIndex((block) => block.id === locator.startBlockId);
  const last = blocks.findIndex((block) => block.id === locator.endBlockId);
  if (first < 0 || last < first) return undefined;
  const selectedBlocks = blocks.slice(first, last + 1);
  if (selectedBlocks.some((block) => block.kind === "image")) return undefined;
  const text = selectedBlocks.map((block) => block.text).join("\n");
  const end = text.length - blocks[last].text.length + locator.endOffset;
  return selectionSentenceContext({
    text,
    selectedText,
    start: locator.startOffset,
    end,
    maxChars: MAX_CONTEXT_CHARS,
  });
}
