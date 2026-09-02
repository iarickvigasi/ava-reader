import { useMemo } from "react";
import { extractSelectionContext } from "@/features/reader/selection-context";
import type { ReaderBookPayload, ReaderChapterPayload } from "@/lib/api-types";
import { useReaderSelectionContext } from "../../../selection/reader-selection-context";

// The server's Zod schemas reject (not truncate) oversized metadata, so cap
// pathological titles/author lists client-side. Mirrors META_MAX_LENGTH in
// the API's ai-comments dto.
const META_FIELD_MAX_CHARS = 200;

export type ToolRequestFields = {
  selection: string;
  locator: string | undefined;
  context: string | undefined;
  bookTitle: string | undefined;
  author: string | undefined;
};

// Everything a tool item needs to build its generate payload, derived from
// the current selection and the book: the trimmed selection, the serialized
// locator, the sentence context around the selection (spec 5.2), and the book
// metadata. Optional fields degrade to undefined — the request then behaves
// as if the feature didn't exist.
export function useToolRequestFields(
  book: ReaderBookPayload,
  chapters: ReaderChapterPayload[],
): ToolRequestFields {
  const { text: selectedText, locator: selectedLocator } =
    useReaderSelectionContext();

  // Serialise once per selection. The server stores this string verbatim in
  // AiComment.locator so it can re-anchor the highlight on a future read.
  const locator = useMemo(
    () => (selectedLocator ? JSON.stringify(selectedLocator) : undefined),
    [selectedLocator],
  );
  const context = useMemo(
    () => extractSelectionContext(chapters, selectedLocator) ?? undefined,
    [chapters, selectedLocator],
  );

  return {
    selection: (selectedText ?? "").trim(),
    locator,
    context,
    bookTitle: book.title.slice(0, META_FIELD_MAX_CHARS) || undefined,
    author: book.authors.join(", ").slice(0, META_FIELD_MAX_CHARS) || undefined,
  };
}
