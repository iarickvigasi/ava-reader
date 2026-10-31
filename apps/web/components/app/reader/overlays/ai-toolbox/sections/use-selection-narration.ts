import type { ReaderBookPayload, ReaderChapterPayload } from "@/lib/api-types";
import { selectionNarrationInput } from "@/features/narration/selection-narration-input";
import { useMemo } from "react";
import { useTextNarration } from "@/features/narration/use-text-narration";
import { useReaderSelectionContext } from "../../../selection/reader-selection-context";

export function useSelectionNarration(
  libraryItemId: string,
  book: ReaderBookPayload,
  chapters: ReaderChapterPayload[],
) {
  const selection = useReaderSelectionContext();
  const { text, locator, context, contextOffset } = selection;
  const input = useMemo(
    () =>
      selectionNarrationInput({
        book,
        chapters,
        text,
        locator,
        context,
        contextOffset,
      }),
    [book, chapters, text, locator, context, contextOffset],
  );
  return useTextNarration({
    libraryItemId,
    input,
    scope: JSON.stringify(locator),
  });
}
