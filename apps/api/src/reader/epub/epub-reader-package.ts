import { readEpubSpine } from './read-epub-spine';
import { normalizeEpubChapters } from './normalize-epub-chapters';
import JSZip from 'jszip';
import type { ReaderPackage } from '../reader-types';
import { readRawChapters } from './read-raw-chapters';
import { countParsedTocNodes } from './count-parsed-toc-nodes';
import { createFallbackToc, resolveTocNodes } from './toc';
import { buildReaderChapters } from './build-reader-chapters';

export async function buildReaderPackageFromEpub(input: {
  authors: string[];
  buffer: Buffer;
  checksum: string;
  language: string | null;
  title: string;
}): Promise<ReaderPackage> {
  const zip = await JSZip.loadAsync(input.buffer);
  const { packagePath, parsedToc, spineItems } = await readEpubSpine(zip);

  if (spineItems.length === 0) {
    throw new Error('The EPUB does not contain readable chapter documents.');
  }

  const nonEmptyRawChapters = await readRawChapters(
    zip,
    packagePath,
    spineItems,
  );

  if (nonEmptyRawChapters.length === 0) {
    throw new Error('The EPUB does not contain readable chapter documents.');
  }

  const parsedTocNodeCount = countParsedTocNodes(parsedToc);
  const isParsedTocRichEnough =
    parsedTocNodeCount >= nonEmptyRawChapters.length;

  const CHAPTER_TITLE_COVERAGE_THRESHOLD = 0.8;
  const titleExtractionCoverage =
    nonEmptyRawChapters.length === 0
      ? 0
      : nonEmptyRawChapters.filter((raw) => raw.chapterTitle !== null).length /
        nonEmptyRawChapters.length;
  const useExtractedChapterTitles =
    isParsedTocRichEnough ||
    titleExtractionCoverage >= CHAPTER_TITLE_COVERAGE_THRESHOLD;

  const chapters = buildReaderChapters({
    rawChapters: nonEmptyRawChapters,
    parsedToc,
    trustTocLabels: isParsedTocRichEnough,
    allowParagraphTitles: useExtractedChapterTitles,
    bookTitle: input.title,
    language: input.language,
  });
  const totalBlocks = chapters.reduce(
    (sum, chapter) => sum + chapter.blocks.length,
    0,
  );

  const resolvedToc = isParsedTocRichEnough
    ? resolveTocNodes(parsedToc, chapters)
    : resolveTocNodes(createFallbackToc(chapters), chapters);

  return normalizeEpubChapters(
    input.buffer,
    {
      chapters,
      manifest: {
        authors: input.authors,
        language: input.language,
        sourceChecksum: input.checksum,
        title: input.title,
        totalBlocks,
        totalChapters: chapters.length,
      },
      toc: resolvedToc,
      version: 2,
    },
    isParsedTocRichEnough,
  );
}
