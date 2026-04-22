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
} from './epub/archive';
import {
  parseManifestItems,
  buildManifestById,
  resolveReadingOrderItems,
} from './epub/manifest';
import {
  readTocEntries,
  findFirstTocLabelForHref,
  createFallbackToc,
  resolveTocNodes,
} from './epub/toc';
import {
  createChapterId,
  getChapterTitleFromBlocks,
  resolveChapterFallbackLabel,
} from './epub/chapters';
import { normalizeBlocksFromNodes } from './epub/blocks';

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

      const blocks = await normalizeBlocksFromNodes(
        getNodeChildren(bodyNode),
        'temp-id',
        (assetPath) =>
          readEpubAssetAsDataUrl(zip, packagePath, href, assetPath),
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

  // Second pass: assign sequential IDs, labels, and navigation links.
  let totalBlocks = 0;
  const chapters: ReaderChapter[] = nonEmptyRawChapters.map(
    (raw, spineIndex) => {
      totalBlocks += raw.blocks.length;
      const chapterId = createChapterId(spineIndex, raw.href);
      const fallbackLabel = resolveChapterFallbackLabel({
        bookTitle: input.title,
        candidateLabel: findFirstTocLabelForHref(parsedToc, raw.href),
        chapterTitle: raw.chapterTitle,
        spineIndex,
      });

      return {
        blocks: raw.blocks.map((block) =>
          block.id.startsWith('temp-id')
            ? { ...block, id: block.id.replace('temp-id', chapterId) }
            : block,
        ),
        chapterId,
        href: raw.href,
        label: fallbackLabel,
        nextChapterId: null,
        previousChapterId: null,
        spineIndex,
        title: raw.chapterTitle ?? fallbackLabel,
      };
    },
  );

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
