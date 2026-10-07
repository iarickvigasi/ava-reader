import type JSZip from 'jszip';
import { resolveZipPath } from '../../shared/zip-utils';
import {
  readZipText,
  readEpubAssetAsDataUrl,
  readEpubAssetAsText,
} from './archive';
import {
  orderedXmlParser,
  findFirstNodeByTag,
  getNodeChildren,
  type OrderedNode,
} from './xml-utils';
import { loadChapterStylesheetHints } from './css/load-chapter-stylesheets';
import { normalizeBlocksFromNodes } from './blocks';
import { getChapterTitleFromBlocks } from './get-chapter-title-from-blocks';

export async function readRawChapters(
  zip: JSZip,
  packagePath: string,
  items: { href: string }[],
) {
  const chapters = await Promise.all(
    items.map(async ({ href }) => {
      const text = await readZipText(zip, resolveZipPath(packagePath, href));
      const document = orderedXmlParser.parse(text) as OrderedNode[];
      const body = findFirstNodeByTag(document, 'body');
      if (!body) return null;
      const hints = await loadChapterStylesheetHints(document, (path) =>
        readEpubAssetAsText(zip, packagePath, href, path),
      );
      const blocks = await normalizeBlocksFromNodes(
        getNodeChildren(body),
        'temp-id',
        (path) => readEpubAssetAsDataUrl(zip, packagePath, href, path),
        hints,
      );
      return blocks.length
        ? { blocks, href, chapterTitle: getChapterTitleFromBlocks(blocks) }
        : null;
    }),
  );
  return chapters.filter((chapter) => chapter !== null);
}
