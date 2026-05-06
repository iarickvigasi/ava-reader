import JSZip from 'jszip';
import {
  OrderedNode,
  orderedXmlParser,
  xmlParser,
  firstAsArray,
  getNodeChildren,
} from './xml-utils';
import {
  readZipText,
  normalizeHrefForLookup,
  dirnameOfZipPath,
  toPackageRelativeHref,
} from './archive';
import { resolveZipPath } from '../../shared/zip-utils';
import type { ReaderChapter } from '../reader-types';
import type { ParsedTocNode, NcxNode } from './toc/types';
import { findTocNavNode, readNavEntries } from './toc/nav-parser';
import { readNcxEntries } from './toc/ncx-parser';
import { resolveTocNodes } from './toc/resolver';
import {
  createTocNodeId,
  extractAnchorIdFromHref,
  normalizeAnchorForLookup,
} from './toc/utils';

export type { ParsedTocNode } from './toc/types';

export async function readTocEntries(
  zip: JSZip,
  packagePath: string,
  input: {
    manifestItems: Array<{
      href: string;
      id: string | null;
      mediaType?: string;
      properties?: string;
    }>;
    ncxId: string | null;
  },
): Promise<ParsedTocNode[]> {
  const packageDirectory = dirnameOfZipPath(packagePath);

  const navItem = input.manifestItems.find((item) =>
    item.properties?.split(/\s+/).includes('nav'),
  );

  if (navItem) {
    const navFilePath = resolveZipPath(packagePath, navItem.href);
    const navXml = await readZipText(zip, navFilePath);
    const orderedNav = orderedXmlParser.parse(navXml) as OrderedNode[];
    const navNode = findTocNavNode(orderedNav);

    if (navNode) {
      const entries = readNavEntries(getNodeChildren(navNode));
      if (entries.length > 0) {
        return resolveTocNodeHrefs(entries, navFilePath, packageDirectory);
      }
    }
  }

  const ncxItem =
    (input.ncxId
      ? input.manifestItems.find((item) => item.id === input.ncxId)
      : null) ??
    input.manifestItems.find(
      (item) => item.mediaType === 'application/x-dtbncx+xml',
    );

  if (!ncxItem) {
    return [];
  }

  const ncxFilePath = resolveZipPath(packagePath, ncxItem.href);
  const ncxXml = await readZipText(zip, ncxFilePath);
  const ncxDocument = xmlParser.parse(ncxXml) as {
    ncx?: {
      navMap?: {
        navPoint?: NcxNode | NcxNode[];
      };
    };
  };

  const ncxEntries = readNcxEntries(
    firstAsArray(ncxDocument.ncx?.navMap?.navPoint),
  );
  return resolveTocNodeHrefs(ncxEntries, ncxFilePath, packageDirectory);
}
/**
 * Find the TOC label for a chapter at a specific (spinePath, anchorId)
 * coordinate. We need this when a single spine doc is split into multiple
 * logical chapters by anchor — `findFirstTocLabelForHref` would happily
 * return the first matching path-only label for every segment.
 */
export function findTocLabelForChapterCoord(
  nodes: ParsedTocNode[],
  spinePath: string,
  anchorId: string | null,
): string | null {
  const targetPath = normalizeHrefForLookup(spinePath);
  const targetAnchor = anchorId ? normalizeAnchorForLookup(anchorId) : null;

  for (const node of nodes) {
    if (node.href) {
      const nodePath = normalizeHrefForLookup(node.href);
      const nodeAnchorRaw = extractAnchorIdFromHref(node.href);
      const nodeAnchor = nodeAnchorRaw
        ? normalizeAnchorForLookup(nodeAnchorRaw)
        : null;

      if (nodePath === targetPath && nodeAnchor === targetAnchor) {
        return node.label;
      }
    }

    const nestedMatch = findTocLabelForChapterCoord(
      node.children,
      spinePath,
      anchorId,
    );
    if (nestedMatch) {
      return nestedMatch;
    }
  }

  return null;
}

export function createFallbackToc(chapters: ReaderChapter[]): ParsedTocNode[] {
  return chapters.map((chapter, index) => ({
    children: [],
    href: chapter.href,
    id: createTocNodeId([index]),
    label: chapter.label,
  }));
}

function resolveTocNodeHrefs(
  nodes: ParsedTocNode[],
  baseFilePath: string,
  packageDirectory: string,
): ParsedTocNode[] {
  return nodes.map((node) => ({
    ...node,
    href: resolveTocHref(node.href, baseFilePath, packageDirectory),
    children: resolveTocNodeHrefs(
      node.children,
      baseFilePath,
      packageDirectory,
    ),
  }));
}

function resolveTocHref(
  href: string | null,
  baseFilePath: string,
  packageDirectory: string,
): string | null {
  if (!href) return null;
  if (href.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(href)) {
    return href;
  }

  const hashIndex = href.indexOf('#');
  const pathPart = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const hashPart = hashIndex >= 0 ? href.slice(hashIndex) : '';
  const resolvedPath = resolveZipPath(baseFilePath, pathPart);
  const packageRelative = toPackageRelativeHref(resolvedPath, packageDirectory);
  return hashPart ? `${packageRelative}${hashPart}` : packageRelative;
}

export { resolveTocNodes };
