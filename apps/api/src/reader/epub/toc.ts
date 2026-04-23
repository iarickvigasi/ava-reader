import JSZip from 'jszip';
import {
  OrderedNode,
  orderedXmlParser,
  xmlParser,
  firstAsArray,
  getNodeChildren,
} from './xml-utils';
import { readZipText, normalizeHrefForLookup } from './archive';
import { resolveZipPath } from '../../shared/zip-utils';
import type { ReaderChapter } from '../reader-types';
import type { ParsedTocNode, NcxNode } from './toc/types';
import { findTocNavNode, readNavEntries } from './toc/nav-parser';
import { readNcxEntries } from './toc/ncx-parser';
import { resolveTocNodes } from './toc/resolver';
import { createTocNodeId } from './toc/utils';

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
  const navItem = input.manifestItems.find((item) =>
    item.properties?.split(/\s+/).includes('nav'),
  );

  if (navItem) {
    const navXml = await readZipText(
      zip,
      resolveZipPath(packagePath, navItem.href),
    );
    const orderedNav = orderedXmlParser.parse(navXml) as OrderedNode[];
    const navNode = findTocNavNode(orderedNav);

    if (navNode) {
      const entries = readNavEntries(getNodeChildren(navNode));
      if (entries.length > 0) {
        return entries;
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

  const ncxXml = await readZipText(
    zip,
    resolveZipPath(packagePath, ncxItem.href),
  );
  const ncxDocument = xmlParser.parse(ncxXml) as {
    ncx?: {
      navMap?: {
        navPoint?: NcxNode | NcxNode[];
      };
    };
  };

  return readNcxEntries(firstAsArray(ncxDocument.ncx?.navMap?.navPoint));
}

export function findFirstTocLabelForHref(
  nodes: ParsedTocNode[],
  href: string,
): string | null {
  const targetHref = normalizeHrefForLookup(href);

  for (const node of nodes) {
    if (node.href && normalizeHrefForLookup(node.href) === targetHref) {
      return node.label;
    }

    const nestedMatch = findFirstTocLabelForHref(node.children, href);
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

export { resolveTocNodes };
