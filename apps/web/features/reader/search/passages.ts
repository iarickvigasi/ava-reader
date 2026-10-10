import type {
  ReaderChapterPayload,
  ReaderStatusPayload,
} from "@/lib/api-types/reader";
import { readerLeaves } from "@/features/reader/jump-target";
import { indexCanonicalBook } from "@/features/reader/canonical/index-book";
import {
  MAX_SEARCH_CHARACTERS,
  MAX_SEARCH_PASSAGES,
  type SearchPassage,
} from "./types";

export function searchPassages(
  payload: Extract<ReaderStatusPayload, { status: "READY" }>,
  chapters: ReaderChapterPayload[] = payload.chapters,
): SearchPassage[] {
  const result: SearchPassage[] = [];
  let characters = 0;
  const append = (
    chapterId: string,
    chapterLabel: string,
    blockId: string,
    text: string,
  ) => {
    if (!text) return;
    characters += text.length;
    if (
      characters > MAX_SEARCH_CHARACTERS ||
      result.length >= MAX_SEARCH_PASSAGES
    )
      throw new Error("Book search limit exceeded");
    result.push({ chapterId, chapterLabel, blockId, text, textOffset: 0 });
  };
  const book = payload.readerPackage?.book;
  if (book) {
    const index = indexCanonicalBook(book);
    for (const id of book.spine) {
      const chapter = index.chapters.get(id);
      if (!chapter) throw new Error("Missing search chapter");
      for (const blockId of chapter.block_ids) {
        const block = index.blocks.get(blockId);
        if (!block) throw new Error("Missing search block");
        if (block.kind === "table") {
          for (const cell of [...block.cells].sort(
            (a, b) => a.row - b.row || a.column - b.column,
          ))
            append(id, chapter.title, cell.id, cell.content.text);
        } else if ("content" in block)
          append(id, chapter.title, block.id, block.content.text);
      }
    }
  } else {
    for (const chapter of chapters)
      for (const block of readerLeaves(chapter.blocks))
        append(chapter.chapterId, chapter.label, block.id, block.text);
  }
  return result;
}
