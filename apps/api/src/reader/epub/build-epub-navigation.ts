import type { ReaderBlock } from '../reader-types';
import { buildReaderChapters } from './build-reader-chapters';
import { createFallbackToc, resolveTocNodes, type ParsedTocNode } from './toc';
import { countParsedTocNodes } from './count-parsed-toc-nodes';

export function buildEpubNavigation(input: {
  rawChapters: {
    blocks: ReaderBlock[];
    href: string;
    chapterTitle: string | null;
  }[];
  parsedToc: ParsedTocNode[];
  title: string;
  language: string | null;
}) {
  const { rawChapters, parsedToc } = input;
  const richToc = countParsedTocNodes(parsedToc) >= rawChapters.length;
  const coverage =
    rawChapters.filter((chapter) => chapter.chapterTitle !== null).length /
    rawChapters.length;
  const chapters = buildReaderChapters({
    rawChapters,
    parsedToc,
    trustTocLabels: richToc,
    allowParagraphTitles: richToc || coverage >= 0.8,
    bookTitle: input.title,
    language: input.language,
  });
  const toc = resolveTocNodes(
    richToc ? parsedToc : createFallbackToc(chapters),
    chapters,
  );
  return { chapters, toc, authoredToc: richToc };
}
