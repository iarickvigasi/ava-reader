import type JSZip from 'jszip';
import { resolveZipPath } from '../../shared/zip-utils';
import {
  orderedXmlParser,
  findFirstNodeByTag,
  getNodeAttributes,
  type OrderedNode,
} from './xml-utils';
import {
  readZipText,
  readEpubAssetAsDataUrl,
  readEpubAssetAsText,
} from './archive';
import { loadChapterStylesheetHints } from './css/load-chapter-stylesheets';
import { normalizeBlocksFromNodes } from './blocks';
import { EpubSourceFindingError } from './source-finding';
import { preflightRequiredImages } from './preflight-required-images';
import { getChapterTitleFromBlocks } from './get-chapter-title-from-blocks';

export async function readEpubChapters(input: {
  zip: JSZip;
  packagePath: string;
  spineItems: { href: string }[];
  language: string | null;
}) {
  const { zip, packagePath } = input;
  const parsed = await Promise.all(
    input.spineItems.map(async (item) => {
      const href = item.href;
      const chapterText = await readZipText(
        zip,
        resolveZipPath(packagePath, href),
      );
      const document = orderedXmlParser.parse(chapterText) as OrderedNode[];
      const body = findFirstNodeByTag(document, 'body');
      if (!body) return null;
      const stylesheetHints = await loadChapterStylesheetHints(
        document,
        (cssHref) => readEpubAssetAsText(zip, packagePath, href, cssHref),
      );
      const html = findFirstNodeByTag(document, 'html');
      const attrs = html ? getNodeAttributes(html) : {};
      const language =
        attrs['@_xml:lang'] ?? attrs['@_lang'] ?? input.language ?? undefined;
      let blocks;
      try {
        const resolveAsset = await preflightRequiredImages(
          [body],
          (assetPath) =>
            readEpubAssetAsDataUrl(zip, packagePath, href, assetPath),
        );
        blocks = await normalizeBlocksFromNodes(
          [body],
          'temp-id',
          resolveAsset,
          stylesheetHints,
          language,
        );
      } catch (error) {
        if (error instanceof EpubSourceFindingError)
          throw error.withResourcePath(resolveZipPath(packagePath, href));
        throw error;
      }
      return blocks.length
        ? { blocks, chapterTitle: getChapterTitleFromBlocks(blocks), href }
        : null;
    }),
  );
  const chapters = parsed.filter(
    (chapter): chapter is NonNullable<typeof chapter> => chapter !== null,
  );
  if (!chapters.length)
    throw new Error('The EPUB does not contain readable chapter documents.');
  return chapters;
}
