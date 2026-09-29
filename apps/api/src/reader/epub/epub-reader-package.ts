import JSZip from 'jszip';
import { resolveZipPath } from '../../shared/zip-utils';
import type { ReaderPackage } from '../reader-types';
import {
  xmlParser,
  orderedXmlParser,
  firstAsArray,
  findFirstNodeByTag,
  getNodeChildren,
} from './xml-utils';
import {
  readZipText,
  readPackagePath,
  readEpubAssetAsDataUrl,
  readEpubAssetAsText,
} from './archive';
import { loadChapterStylesheetHints } from './css/load-chapter-stylesheets';
import {
  parseManifestItems,
  buildManifestById,
  resolveReadingOrderItems,
} from './manifest';
import { readTocEntries, createFallbackToc, resolveTocNodes } from './toc';
import type { ParsedTocNode } from './toc';
import { buildReaderChapters } from './build-reader-chapters';
import { getChapterTitleFromBlocks } from './get-chapter-title-from-blocks';
import { normalizeBlocksFromNodes } from './blocks';

export async function buildReaderPackageFromEpub(input: {
  authors: string[];
  buffer: Buffer;
  checksum: string;
  language: string | null;
  title: string;
}): Promise<ReaderPackage> {
  const zip = await JSZip.loadAsync(input.buffer);
  const packagePath = await readPackagePath(zip);
  const packageXml = await readZipText(zip, packagePath);
  const packageDocument = xmlParser.parse(packageXml) as {
    package?: {
      manifest?: {
        item?: Record<string, string> | Array<Record<string, string>>;
      };
      spine?: {
        ['@_toc']?: string;
        itemref?: Record<string, string> | Array<Record<string, string>>;
      };
    };
  };

  const manifestItems = parseManifestItems(
    packageDocument.package?.manifest?.item,
  );
  const manifestById = buildManifestById(manifestItems);
  const parsedToc = await readTocEntries(zip, packagePath, {
    manifestItems,
    ncxId: packageDocument.package?.spine?.['@_toc'] ?? null,
  });
  const spineItems = resolveReadingOrderItems({
    packagePath,
    manifestItems,
    manifestById,
    parsedToc,
    spineItemRefs: firstAsArray(packageDocument.package?.spine?.itemref).map(
      (item) => item['@_idref'] ?? '',
    ),
    zip,
  });

  if (spineItems.length === 0) {
    throw new Error('The EPUB does not contain readable chapter documents.');
  }

  // First pass: parse every spine document and extract blocks.
  // Documents with no <body> or zero readable blocks are discarded.
  const rawChapters = await Promise.all(
    spineItems.map(async (item) => {
      const href = item.href;
      const chapterText = await readZipText(
        zip,
        resolveZipPath(packagePath, href),
      );
      const parsedChapter = orderedXmlParser.parse(
        chapterText,
      ) as import('./xml-utils').OrderedNode[];
      const bodyNode = findFirstNodeByTag(parsedChapter, 'body');

      if (!bodyNode) {
        return null;
      }

      // Compile this chapter's stylesheets (linked + inline <style>)
      // into a tag/class hint lookup. The block normalizer then matches
      // each block element against it, before applying any inline
      // style="…" overrides.
      const stylesheetHints = await loadChapterStylesheetHints(
        parsedChapter,
        (cssHref) => readEpubAssetAsText(zip, packagePath, href, cssHref),
      );

      const blocks = await normalizeBlocksFromNodes(
        getNodeChildren(bodyNode),
        'temp-id',
        (assetPath) =>
          readEpubAssetAsDataUrl(zip, packagePath, href, assetPath),
        stylesheetHints,
      );

      if (blocks.length === 0) {
        return null;
      }

      const chapterTitle = getChapterTitleFromBlocks(blocks);

      return {
        blocks,
        chapterTitle,
        href,
      };
    }),
  );

  const nonEmptyRawChapters = rawChapters.filter(
    (c): c is NonNullable<(typeof rawChapters)[0]> => c !== null,
  );

  if (nonEmptyRawChapters.length === 0) {
    throw new Error('The EPUB does not contain readable chapter documents.');
  }

  // Decide upfront whether the parsed TOC is rich enough to be authoritative.
  // A degenerate NCX (Calibre "Start" entry, ukrlib 2-entry NCX) covers far
  // fewer items than the spine has. Its labels tend to be structural noise
  // ("Start", "Текст твору") rather than real chapter titles, so we treat it
  // as untrusted for BOTH structure and labels.
  const parsedTocNodeCount = countParsedTocNodes(parsedToc);
  const isParsedTocRichEnough =
    parsedTocNodeCount >= nonEmptyRawChapters.length;

  // Only paragraph guesses need book-wide consistency; explicit opening
  // headings remain trustworthy even among untitled front matter.
  const CHAPTER_TITLE_COVERAGE_THRESHOLD = 0.8;
  const titleExtractionCoverage =
    nonEmptyRawChapters.length === 0
      ? 0
      : nonEmptyRawChapters.filter((raw) => raw.chapterTitle !== null).length /
        nonEmptyRawChapters.length;
  const useExtractedChapterTitles =
    isParsedTocRichEnough ||
    titleExtractionCoverage >= CHAPTER_TITLE_COVERAGE_THRESHOLD;

  // Split at TOC anchors and label each logical chapter independently.
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

  // Use the parsed TOC if it was rich enough to trust (Pride & Prejudice-style
  // EPUBs where TOC anchors already drove chapter splitting). Otherwise, build
  // a fallback TOC with one entry per chapter using each chapter's own label
  // — which by now reflects either its <h1> heading or a numbered opening excerpt.
  const resolvedToc = isParsedTocRichEnough
    ? resolveTocNodes(parsedToc, chapters)
    : resolveTocNodes(createFallbackToc(chapters), chapters);

  return {
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
  };
}

function countParsedTocNodes(toc: ParsedTocNode[]) {
  let count = 0;

  function walk(nodes: ParsedTocNode[]) {
    for (const node of nodes) {
      count += 1;
      walk(node.children);
    }
  }

  walk(toc);
  return count;
}
