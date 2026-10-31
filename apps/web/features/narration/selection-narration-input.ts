import type {
  ReaderBookPayload,
  ReaderChapterPayload,
  ReaderRangeLocator,
} from "@/lib/api-types";
import { selectionSentenceWindow } from "@/features/reader/selection-sentence-context";

export type NarrationInput = {
  text: string;
  context?: string;
  contextOffset?: number;
  languageHint?: string;
  translationLanguage?: string;
};
const MAX_CONTEXT_CHARS = 8192;

export function selectionNarrationInput(input: {
  book: ReaderBookPayload;
  chapters: ReaderChapterPayload[];
  text: string | null;
  locator: ReaderRangeLocator | null;
  context: string | null;
  contextOffset?: number | null;
}): NarrationInput {
  const text = input.text?.trim() ?? "";
  const languageHint = (
    input.locator?.translation?.targetLang ?? input.book.language
  )?.slice(0, 128);
  const prefix =
    input.context?.match(/^Selected text language: [^\n]*\n/)?.[0] ?? "";
  const window = input.locator?.translation
    ? {
        context: input.context?.slice(prefix.length),
        contextOffset:
          input.contextOffset == null
            ? undefined
            : input.contextOffset - prefix.length,
      }
    : containingSentences(input.chapters, input.locator, text);
  const context = window?.context?.slice(0, MAX_CONTEXT_CHARS);
  const offset = window?.contextOffset;
  const contextOffset =
    offset !== undefined &&
    offset >= 0 &&
    context?.slice(offset, offset + text.length) === text
      ? offset
      : undefined;
  return {
    text,
    languageHint: languageHint || undefined,
    context: context || undefined,
    ...(contextOffset === undefined ? {} : { contextOffset }),
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
  return selectionSentenceWindow({
    text,
    selectedText,
    start: locator.startOffset,
    end,
    maxChars: MAX_CONTEXT_CHARS,
  });
}
