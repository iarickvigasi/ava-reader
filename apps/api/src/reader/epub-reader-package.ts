import JSZip from 'jszip';
import { resolveZipPath } from '../shared/zip-utils';
import type { ReaderChapter, ReaderPackage } from './reader-types';
import {
  xmlParser,
  orderedXmlParser,
  firstAsArray,
  findFirstNodeByTag,
  getNodeChildren,
} from './epub/xml-utils';
import {
  readZipText,
  readPackagePath,
  readEpubAssetAsDataUrl,
  readEpubAssetAsText,
} from './epub/archive';
import { loadChapterStylesheetHints } from './epub/css/load-chapter-stylesheets';
import {
  parseManifestItems,
  buildManifestById,
  resolveReadingOrderItems,
} from './epub/manifest';
import {
  readTocEntries,
  findTocLabelForChapterCoord,
  createFallbackToc,
  resolveTocNodes,
} from './epub/toc';
import {
  collectTocAnchorsBySpinePath,
  createChapterId,
  getChapterTitleFromBlocks,
  resolveChapterFallbackLabel,
  splitBlocksAtTocAnchors,
} from './epub/chapters';
import { normalizeBlocksFromNodes } from './epub/blocks';
import { normalizeHrefForLookup } from './epub/archive';

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
      ) as import('./epub/xml-utils').OrderedNode[];
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

  // Second pass: split each spine document at TOC-anchor boundaries (so that
  // EPUBs which pack many logical chapters into one big XHTML still produce
  // one ReaderChapter per chapter), then assign sequential IDs and labels.
  const tocAnchorsBySpinePath = collectTocAnchorsBySpinePath(parsedToc);
  let totalBlocks = 0;
  const chapters: ReaderChapter[] = [];

  for (const raw of nonEmptyRawChapters) {
    const spineKey = normalizeHrefForLookup(raw.href);
    const tocAnchors = tocAnchorsBySpinePath.get(spineKey) ?? new Set<string>();
    const segments = splitBlocksAtTocAnchors(raw.blocks, tocAnchors);

    for (const segment of segments) {
      const segmentIndex = chapters.length;
      const chapterId = createChapterId(
        segmentIndex,
        raw.href,
        segment.leadingAnchorId,
      );
      const chapterHref = segment.leadingAnchorId
        ? `${raw.href}#${segment.leadingAnchorId}`
        : raw.href;
      const segmentTitle = getChapterTitleFromBlocks(segment.blocks);
      const fallbackLabel = resolveChapterFallbackLabel({
        bookTitle: input.title,
        candidateLabel: findTocLabelForChapterCoord(
          parsedToc,
          raw.href,
          segment.leadingAnchorId,
        ),
        chapterTitle: segmentTitle,
        spineIndex: segmentIndex,
      });

      // Re-number each segment's blocks from 1 so that every chapter's blocks
      // are numbered `chapterId::b1, ::b2, …` regardless of where the segment
      // started inside its source spine doc.
      const segmentBlocks = segment.blocks.map((block, blockIndex) =>
        block.id.startsWith('temp-id')
          ? { ...block, id: `${chapterId}::b${blockIndex + 1}` }
          : block,
      );

      totalBlocks += segmentBlocks.length;

      chapters.push({
        blocks: segmentBlocks,
        chapterId,
        href: chapterHref,
        label: fallbackLabel,
        nextChapterId: null,
        previousChapterId: null,
        spineIndex: segmentIndex,
        title: segmentTitle ?? fallbackLabel,
      });
    }
  }

  for (let index = 0; index < chapters.length; index += 1) {
    chapters[index] = {
      ...chapters[index],
      nextChapterId: chapters[index + 1]?.chapterId ?? null,
      previousChapterId: chapters[index - 1]?.chapterId ?? null,
    };
  }

  const resolvedToc = resolveTocNodes(
    parsedToc.length > 0 ? parsedToc : createFallbackToc(chapters),
    chapters,
  );

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
