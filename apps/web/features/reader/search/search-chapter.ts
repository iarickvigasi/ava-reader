import { segmentSentences } from "../sentence-segments";
import { blockSearchUnits } from "./block-search-units";
import { findMatches } from "./find-matches";
import type { BookSearchResult, SearchChapter } from "./types";

export function searchChapter(
  chapter: SearchChapter,
  query: string,
): BookSearchResult[] {
  return chapter.blocks.flatMap((block) =>
    blockSearchUnits(block).flatMap((unit) => {
      const matches = findMatches(unit.text, query);
      if (!matches.length) return [];
      const sentences = segmentSentences(unit.text.replace(/\s/gu, " ")) ?? [
        { text: unit.text, start: 0, end: unit.text.length },
      ];
      return sentences.flatMap((sentence): BookSearchResult[] => {
        const hits = matches.filter(
          (match) => match.start >= sentence.start && match.end <= sentence.end,
        );
        if (!hits.length) return [];
        const original = unit.text.slice(sentence.start, sentence.end);
        const leading = original.length - original.trimStart().length;
        const text = original.trim();
        const start = sentence.start + leading;
        const startOffset = unit.offset + start;
        return [
          {
            id: `${chapter.chapterId}:${block.id}:${startOffset}`,
            text,
            chapterLabel: chapter.label,
            locator: {
              chapterId: chapter.chapterId,
              startBlockId: block.id,
              endBlockId: block.id,
              startOffset,
              endOffset: startOffset + text.length,
              contextBefore: unit.text.slice(Math.max(0, start - 40), start),
              contextAfter: unit.text.slice(
                start + text.length,
                start + text.length + 40,
              ),
            },
            matchOffset: unit.offset + hits[0].start,
            matches: hits.map((hit) => ({
              start: hit.start - start,
              end: hit.end - start,
            })),
          },
        ];
      });
    }),
  );
}
