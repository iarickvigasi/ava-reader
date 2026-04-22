import JSZip from 'jszip';
import {
  OrderedNode,
  xmlParser,
  orderedXmlParser,
  getNodeTagName,
  getNodeChildren,
  getNodeAttributes,
  firstAsArray,
} from './xml-utils';
import { readZipText } from './archive';
import { resolveZipPath } from '../../shared/zip-utils';
import type {
  ReaderBlock,
  ReaderChapter,
  ReaderTocNode,
} from '../reader-types';

export type ParsedTocNode = {
  children: ParsedTocNode[];
  href: string | null;
  id: string;
  label: string;
};

type NcxNode = {
  content?: { ['@_src']?: string };
  navLabel?: { text?: string };
  navPoint?: NcxNode | NcxNode[];
};

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

function findTocNavNode(nodes: OrderedNode[]): OrderedNode | null {
  for (const node of nodes) {
    const tagName = getNodeTagName(node);

    if (!tagName) {
      continue;
    }

    const attrs = getNodeAttributes(node);
    const typeValue = Object.entries(attrs).find(([key]) =>
      key.endsWith('type'),
    )?.[1];

    if (
      tagName === 'nav' &&
      typeof typeValue === 'string' &&
      typeValue.includes('toc')
    ) {
      return node;
    }

    const childMatch = findTocNavNode(getNodeChildren(node));
    if (childMatch) {
      return childMatch;
    }
  }

  return null;
}

function readNavEntries(
  nodes: OrderedNode[],
  path: number[] = [],
): ParsedTocNode[] {
  const listItems = nodes.filter((node) => getNodeTagName(node) === 'li');

  if (listItems.length > 0) {
    return listItems.flatMap((node, index) => {
      const entry = readNavListItem(node, [...path, index]);
      return entry ? [entry] : [];
    });
  }

  const nestedLists = nodes.filter((node) => {
    const tagName = getNodeTagName(node);
    return tagName === 'ol' || tagName === 'ul';
  });

  if (nestedLists.length > 0) {
    return nestedLists.flatMap((node) =>
      readNavEntries(getNodeChildren(node), path),
    );
  }

  return [];
}

function readNavListItem(
  node: OrderedNode,
  path: number[],
): ParsedTocNode | null {
  const children = getNodeChildren(node);
  const linkNode = children.find((child) => getNodeTagName(child) === 'a');
  const href = linkNode
    ? (getNodeAttributes(linkNode)['@_href'] ?? null)
    : null;
  const label = inlineNodesToText(flattenInlineContent(node));
  const nestedEntries = children.flatMap((child) => {
    const tagName = getNodeTagName(child);
    if (tagName !== 'ol' && tagName !== 'ul') {
      return [];
    }
    return readNavEntries(getNodeChildren(child), path);
  });

  if (!label && !href && nestedEntries.length === 0) {
    return null;
  }

  return {
    children: nestedEntries,
    href,
    id: createTocNodeId(path),
    label: label || href || 'Untitled section',
  };
}

function readNcxEntries(
  nodes: NcxNode[],
  path: number[] = [],
): ParsedTocNode[] {
  return nodes.flatMap((node, index) => {
    const href = node.content?.['@_src'] ?? null;
    const label =
      typeof node.navLabel?.text === 'string' ? node.navLabel.text.trim() : '';
    const children = readNcxEntries(firstAsArray(node.navPoint), [
      ...path,
      index,
    ]);

    if (!label && !href && children.length === 0) {
      return [];
    }

    return [
      {
        children,
        href,
        id: createTocNodeId([...path, index]),
        label: label || href || 'Untitled section',
      },
    ];
  });
}

function createTocNodeId(path: number[]) {
  return `toc:${path.join('.')}`;
}

function flattenInlineContent(node: OrderedNode): OrderedNode[] {
  const children = getNodeChildren(node);
  if (children.length === 0) {
    return [];
  }

  return children.flatMap((child) => {
    const tagName = getNodeTagName(child);
    if (tagName === 'ol' || tagName === 'ul') {
      return [];
    }
    return [child];
  });
}

function inlineNodesToText(nodes: OrderedNode[]): string {
  return nodes
    .map((node) => {
      const tagName = getNodeTagName(node);
      if (tagName === '#text') {
        const rawText = node['#text'];
        return typeof rawText === 'string' || typeof rawText === 'number'
          ? normalizeInlineText(String(rawText))
          : '';
      }
      return inlineNodesToText(getNodeChildren(node));
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeInlineText(value: string) {
  if (!value) {
    return '';
  }

  return value.replace(/\s+/g, ' ');
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

export function resolveTocNodes(
  nodes: ParsedTocNode[],
  chapters: ReaderChapter[],
): ReaderTocNode[] {
  const chapterByHref = new Map(
    chapters.map((chapter) => [normalizeHrefForLookup(chapter.href), chapter]),
  );
  const anchorBlockIdByChapterId = new Map(
    chapters.map((chapter) => [
      chapter.chapterId,
      createAnchorBlockIdLookup(chapter.blocks),
    ]),
  );

  return nodes.flatMap((node) => {
    const resolved = resolveTocNode(
      node,
      chapterByHref,
      anchorBlockIdByChapterId,
    );
    return resolved ? [resolved] : [];
  });
}

function resolveTocNode(
  node: ParsedTocNode,
  chapterByHref: Map<string, ReaderChapter>,
  anchorBlockIdByChapterId: Map<string, Map<string, string>>,
): ReaderTocNode | null {
  const resolvedChildren = node.children.flatMap((child) => {
    const resolved = resolveTocNode(
      child,
      chapterByHref,
      anchorBlockIdByChapterId,
    );
    return resolved ? [resolved] : [];
  });

  const href = node.href;
  const chapter = href
    ? (chapterByHref.get(normalizeHrefForLookup(href)) ?? null)
    : null;
  const anchorId = href ? extractAnchorIdFromHref(href) : null;
  const blockId =
    chapter?.chapterId && anchorId
      ? (anchorBlockIdByChapterId
          .get(chapter.chapterId)
          ?.get(normalizeAnchorForLookup(anchorId)) ?? null)
      : null;

  if (!chapter && resolvedChildren.length === 0) {
    return null;
  }

  return {
    anchorId,
    blockId,
    chapterId: chapter?.chapterId ?? null,
    children: resolvedChildren,
    href,
    id: node.id,
    label: node.label,
    spineIndex: chapter?.spineIndex ?? null,
  };
}

function createAnchorBlockIdLookup(blocks: ReaderBlock[]) {
  const anchorBlockIdByAnchor = new Map<string, string>();

  for (const block of blocks) {
    if (!block.anchorId) {
      continue;
    }

    anchorBlockIdByAnchor.set(
      normalizeAnchorForLookup(block.anchorId),
      block.id,
    );
  }

  return anchorBlockIdByAnchor;
}

function extractAnchorIdFromHref(href: string) {
  const fragment = href.split('#').slice(1).join('#').trim();
  return fragment.length > 0 ? decodeURIComponent(fragment) : null;
}

function normalizeAnchorForLookup(anchorId: string) {
  return decodeURIComponent(anchorId).trim().toLowerCase();
}

function normalizeHrefForLookup(href: string) {
  return decodeURIComponent(href.split('#')[0] ?? href).toLowerCase();
}
