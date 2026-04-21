import { extname } from 'path';
import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';
import mime from 'mime-types';
import { resolveZipPath } from '../shared/zip-utils';
import type {
  ReaderBlock,
  ReaderChapter,
  ReaderInline,
  ReaderListItem,
  ReaderPackage,
  ReaderTocNode,
} from './reader-types';

type OrderedNode = Record<string, unknown>;
type ManifestItem = {
  href: string;
  id: string | null;
  mediaType?: string;
  properties?: string;
};
type ParsedTocNode = {
  children: ParsedTocNode[];
  href: string | null;
  id: string;
  label: string;
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: false,
  trimValues: true,
});

const orderedXmlParser = new XMLParser({
  ignoreAttributes: false,
  preserveOrder: true,
  removeNSPrefix: false,
  trimValues: false,
});

const blockContainerTags = new Set([
  'article',
  'body',
  'div',
  'main',
  'section',
]);

const inlineContainerTags = new Set([
  'a',
  'b',
  'br',
  'cite',
  'code',
  'em',
  'i',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
]);
const readableDocumentMediaTypes = new Set([
  'application/xhtml+xml',
  'application/xml',
  'text/html',
]);

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

  const manifestItems = firstAsArray(packageDocument.package?.manifest?.item)
    .map(
      (item) =>
        ({
          href: item['@_href'] ?? '',
          id: item['@_id'] ?? null,
          mediaType: item['@_media-type'],
          properties: item['@_properties'],
        }) satisfies ManifestItem,
    )
    .filter((item) => item.href);
  const manifestById = new Map<string, ManifestItem>(
    manifestItems.flatMap((item) =>
      item.id ? [[item.id, item] as const] : [],
    ),
  );
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

  let totalBlocks = 0;
  const chapters = await Promise.all(
    spineItems.map(async (item, spineIndex) => {
      const href = item.href;
      const chapterId = createChapterId(spineIndex, href);
      const chapterText = await readZipText(
        zip,
        resolveZipPath(packagePath, href),
      );
      const parsedChapter = orderedXmlParser.parse(
        chapterText,
      ) as OrderedNode[];
      const bodyNode = findFirstNodeByTag(parsedChapter, 'body');

      if (!bodyNode) {
        const fallbackLabel = resolveChapterFallbackLabel({
          bookTitle: input.title,
          candidateLabel: findFirstTocLabelForHref(parsedToc, href),
          chapterTitle: null,
          spineIndex,
        });

        return createEmptyChapter({
          chapterId,
          href,
          label: fallbackLabel,
          spineIndex,
        });
      }

      const blocks = await normalizeBlocksFromNodes(
        getNodeChildren(bodyNode),
        chapterId,
        (assetPath) =>
          readEpubAssetAsDataUrl(zip, packagePath, href, assetPath),
      );

      totalBlocks += blocks.length;
      const chapterTitle = getChapterTitleFromBlocks(blocks);
      const fallbackLabel = resolveChapterFallbackLabel({
        bookTitle: input.title,
        candidateLabel: findFirstTocLabelForHref(parsedToc, href),
        chapterTitle,
        spineIndex,
      });

      return {
        blocks,
        chapterId,
        href,
        label: fallbackLabel,
        nextChapterId: null,
        previousChapterId: null,
        spineIndex,
        title: chapterTitle ?? fallbackLabel,
      } satisfies ReaderChapter;
    }),
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

function createFallbackToc(chapters: ReaderChapter[]): ParsedTocNode[] {
  return chapters.map((chapter, index) => ({
    children: [],
    href: chapter.href,
    id: createTocNodeId([index]),
    label: chapter.label,
  }));
}

function resolveChapterFallbackLabel(input: {
  bookTitle: string;
  candidateLabel: string | null;
  chapterTitle: string | null;
  spineIndex: number;
}) {
  const normalizedBookTitle = normalizeTitleForComparison(input.bookTitle);
  const candidateLabels = [input.candidateLabel, input.chapterTitle];

  for (const candidate of candidateLabels) {
    if (!candidate) {
      continue;
    }

    if (normalizeTitleForComparison(candidate) === normalizedBookTitle) {
      continue;
    }

    return candidate;
  }

  return `Chapter ${input.spineIndex + 1}`;
}

function normalizeTitleForComparison(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function resolveReadingOrderItems(input: {
  packagePath: string;
  manifestById: Map<string, ManifestItem>;
  manifestItems: ManifestItem[];
  parsedToc: ParsedTocNode[];
  spineItemRefs: string[];
  zip: JSZip;
}) {
  const spineItems = input.spineItemRefs
    .map((idref) => input.manifestById.get(idref))
    .filter((item): item is ManifestItem => item !== undefined);

  if (spineItems.length > 0) {
    return spineItems;
  }

  const tocItems = resolveReadingOrderItemsFromToc(
    input.parsedToc,
    input.manifestItems,
  );
  if (tocItems.length > 0) {
    return tocItems;
  }

  const manifestFallbackItems = input.manifestItems.filter(
    isReadableContentManifestItem,
  );
  if (manifestFallbackItems.length > 0) {
    return manifestFallbackItems;
  }

  return discoverReadableArchiveItems(input.zip, input.packagePath);
}

function resolveReadingOrderItemsFromToc(
  toc: ParsedTocNode[],
  manifestItems: ManifestItem[],
) {
  const manifestItemByHref = new Map(
    manifestItems.map((item) => [normalizeHrefForLookup(item.href), item]),
  );
  const seen = new Set<string>();
  const orderedItems: ManifestItem[] = [];

  for (const href of flattenTocHrefs(toc)) {
    const normalizedHref = normalizeHrefForLookup(href);

    if (seen.has(normalizedHref)) {
      continue;
    }

    const manifestItem = manifestItemByHref.get(normalizedHref);
    if (!manifestItem || !isReadableContentManifestItem(manifestItem)) {
      continue;
    }

    seen.add(normalizedHref);
    orderedItems.push(manifestItem);
  }

  return orderedItems;
}

function flattenTocHrefs(toc: ParsedTocNode[]): string[] {
  const hrefs: string[] = [];

  for (const node of toc) {
    if (node.href) {
      hrefs.push(node.href);
    }

    hrefs.push(...flattenTocHrefs(node.children));
  }

  return hrefs;
}

function isReadableContentManifestItem(item: ManifestItem) {
  if (!item.href || item.properties?.split(/\s+/).includes('nav')) {
    return false;
  }

  if (item.mediaType === 'application/x-dtbncx+xml') {
    return false;
  }

  return (
    readableDocumentMediaTypes.has(item.mediaType ?? '') ||
    hasReadableDocumentExtension(item.href)
  );
}

function discoverReadableArchiveItems(zip: JSZip, packagePath: string) {
  const packageDirectory = normalizeArchivePath(dirnameOfZipPath(packagePath));

  return Object.values(zip.files)
    .filter((file) => !file.dir)
    .map((file, index) => ({
      href: toPackageRelativeHref(file.name, packageDirectory),
      id: `archive-${index}`,
      mediaType: mime.lookup(file.name) || undefined,
      properties: undefined,
    }))
    .filter((item) => isReadableArchiveItem(item, packageDirectory));
}

function isReadableArchiveItem(item: ManifestItem, packageDirectory: string) {
  if (!item.href || !hasReadableDocumentExtension(item.href)) {
    return false;
  }

  const normalizedHref = normalizeArchiveLookupPath(item.href);
  const normalizedPackageDirectory =
    normalizeArchiveLookupPath(packageDirectory);

  if (
    normalizedHref.startsWith('meta-inf/') ||
    normalizedHref.endsWith('.opf') ||
    normalizedHref.endsWith('.ncx') ||
    normalizedHref.includes('/toc.') ||
    normalizedHref.includes('/nav.')
  ) {
    return false;
  }

  if (!normalizedPackageDirectory) {
    return true;
  }

  return (
    normalizedHref.startsWith(`${normalizedPackageDirectory}/`) ||
    !normalizedHref.includes('/')
  );
}

function toPackageRelativeHref(archivePath: string, packageDirectory: string) {
  const normalizedPath = normalizeArchivePath(archivePath);

  if (packageDirectory && normalizedPath.startsWith(`${packageDirectory}/`)) {
    return normalizedPath.slice(packageDirectory.length + 1);
  }

  return normalizedPath;
}

function dirnameOfZipPath(path: string) {
  const normalizedPath = normalizeArchivePath(path);
  const lastSlashIndex = normalizedPath.lastIndexOf('/');
  return lastSlashIndex === -1 ? '' : normalizedPath.slice(0, lastSlashIndex);
}

function normalizeArchivePath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\.?\//, '');
}

function normalizeArchiveLookupPath(path: string) {
  return normalizeArchivePath(path).toLowerCase();
}

function hasReadableDocumentExtension(path: string) {
  const extension = extname(path).toLowerCase();
  return (
    extension === '.xhtml' ||
    extension === '.html' ||
    extension === '.htm' ||
    extension === '.xml'
  );
}

function findFirstTocLabelForHref(
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

function resolveTocNodes(
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

async function readPackagePath(zip: JSZip) {
  const containerXml = await readZipText(zip, 'META-INF/container.xml');
  const container = xmlParser.parse(containerXml) as {
    container?: {
      rootfiles?: {
        rootfile?:
          | { ['@_full-path']?: string }
          | Array<{ ['@_full-path']?: string }>;
      };
    };
  };
  const rootfile = firstAsArray(container.container?.rootfiles?.rootfile)[0];
  const packagePath = rootfile?.['@_full-path'];

  if (!packagePath) {
    throw new Error('The EPUB container does not point to a package document.');
  }

  return packagePath;
}

async function readTocEntries(
  zip: JSZip,
  packagePath: string,
  input: {
    manifestItems: ManifestItem[];
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

type NcxNode = {
  content?: { ['@_src']?: string };
  navLabel?: { text?: string };
  navPoint?: NcxNode | NcxNode[];
};

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

async function normalizeBlocksFromNodes(
  nodes: OrderedNode[],
  chapterId: string,
  resolveAsset: (assetPath: string) => Promise<string | null>,
) {
  let blockIndex = 0;
  const blocks: ReaderBlock[] = [];

  const pushBlock = async (node: OrderedNode) => {
    const normalized = await normalizeBlockNode(
      node,
      chapterId,
      () => {
        blockIndex += 1;
        return `${chapterId}::b${blockIndex}`;
      },
      resolveAsset,
    );

    if (Array.isArray(normalized)) {
      blocks.push(...normalized);
      return;
    }

    if (normalized) {
      blocks.push(normalized);
    }
  };

  await reduceAsync(nodes, async (_ignored, node_3) => {
    await pushBlock(node_3);
  });
  return blocks;
}

async function normalizeBlockNode(
  node: OrderedNode,
  chapterId: string,
  createBlockId: () => string,
  resolveAsset: (assetPath: string) => Promise<string | null>,
): Promise<ReaderBlock | ReaderBlock[] | null> {
  const tagName = getNodeTagName(node);

  if (!tagName) {
    return null;
  }

  const attrs = getNodeAttributes(node);
  const anchorId = attrs['@_id'] ?? attrs['@_name'] ?? null;
  const children = getNodeChildren(node);

  if (tagName === 'img') {
    const src = attrs['@_src'];
    if (!src) {
      return null;
    }
    const resolvedSrc = await resolveAsset(src);
    if (!resolvedSrc) {
      return null;
    }
    return {
      alt: attrs['@_alt'] ?? null,
      anchorId,
      id: createBlockId(),
      kind: 'image',
      src: resolvedSrc,
      text: attrs['@_alt'] ?? '',
    };
  }

  if (tagName === 'p' || tagName === 'blockquote') {
    const inlines = await normalizeInlineNodes(children, resolveAsset);
    const text = buildInlineText(inlines);

    if (!text && !hasInlineImages(inlines)) {
      return null;
    }

    return {
      anchorId,
      id: createBlockId(),
      inlines,
      kind: tagName === 'p' ? 'paragraph' : 'blockquote',
      text,
    };
  }

  if (tagName.match(/^h[1-6]$/)) {
    const inlines = await normalizeInlineNodes(children, resolveAsset);
    const text = buildInlineText(inlines);

    if (!text && !hasInlineImages(inlines)) {
      return null;
    }

    return {
      anchorId,
      id: createBlockId(),
      inlines,
      kind: 'heading',
      level: Number(tagName.slice(1)),
      text,
    };
  }

  if (tagName === 'ol' || tagName === 'ul') {
    const items = await Promise.all(
      children
        .filter((child) => getNodeTagName(child) === 'li')
        .map(async (itemNode, index) => {
          const inlines = await normalizeInlineNodes(
            flattenInlineContent(itemNode),
            resolveAsset,
          );
          return {
            id: `${chapterId}::li${createBlockId()}-${index + 1}`,
            inlines,
            text: buildInlineText(inlines),
          } satisfies ReaderListItem;
        }),
    );

    const meaningfulItems = items.filter(
      (item) => item.text || hasInlineImages(item.inlines),
    );

    if (meaningfulItems.length === 0) {
      return null;
    }

    return {
      anchorId,
      id: createBlockId(),
      items: meaningfulItems,
      kind: 'list',
      ordered: tagName === 'ol',
      text: meaningfulItems.map((item) => item.text).join('\n'),
    };
  }

  if (blockContainerTags.has(tagName)) {
    if (hasDirectBlockChildren(children)) {
      const nested = await Promise.all(
        children.map((child) =>
          normalizeBlockNode(child, chapterId, createBlockId, resolveAsset),
        ),
      );

      return nested.flatMap((entry) =>
        Array.isArray(entry) ? entry : entry ? [entry] : [],
      );
    }

    const inlines = await normalizeInlineNodes(children, resolveAsset);
    const text = buildInlineText(inlines);

    if (!text && !hasInlineImages(inlines)) {
      return null;
    }

    return {
      anchorId,
      id: createBlockId(),
      inlines,
      kind: 'paragraph',
      text,
    };
  }

  if (inlineContainerTags.has(tagName)) {
    const inlines = await normalizeInlineNodes([node], resolveAsset);
    const text = buildInlineText(inlines);

    if (!text && !hasInlineImages(inlines)) {
      return null;
    }

    return {
      anchorId,
      id: createBlockId(),
      inlines,
      kind: 'paragraph',
      text,
    };
  }

  const fallbackBlocks = await Promise.all(
    children.map((child) =>
      normalizeBlockNode(child, chapterId, createBlockId, resolveAsset),
    ),
  );

  return fallbackBlocks.flatMap((entry) =>
    Array.isArray(entry) ? entry : entry ? [entry] : [],
  );
}

async function normalizeInlineNodes(
  nodes: OrderedNode[],
  resolveAsset: (assetPath: string) => Promise<string | null>,
  state: {
    bold?: boolean;
    href?: string;
    italic?: boolean;
  } = {},
): Promise<ReaderInline[]> {
  const inlines: ReaderInline[] = [];

  for (const node of nodes) {
    const tagName = getNodeTagName(node);

    if (!tagName) {
      continue;
    }

    if (tagName === '#text') {
      const rawText = node['#text'];
      const value =
        typeof rawText === 'string' || typeof rawText === 'number'
          ? normalizeInlineText(String(rawText))
          : '';
      if (value.length > 0) {
        inlines.push({
          bold: state.bold,
          href: state.href,
          italic: state.italic,
          kind: 'text',
          text: value,
        });
      }
      continue;
    }

    const attrs = getNodeAttributes(node);
    const nextState = {
      bold: state.bold || tagName === 'b' || tagName === 'strong',
      href: tagName === 'a' ? (attrs['@_href'] ?? state.href) : state.href,
      italic: state.italic || tagName === 'em' || tagName === 'i',
    };

    if (tagName === 'br') {
      inlines.push({
        bold: nextState.bold,
        href: nextState.href,
        italic: nextState.italic,
        kind: 'text',
        text: '\n',
      });
      continue;
    }

    if (tagName === 'img') {
      const src = attrs['@_src'];
      if (!src) {
        continue;
      }

      const resolvedSrc = await resolveAsset(src);
      if (!resolvedSrc) {
        continue;
      }

      inlines.push({
        alt: attrs['@_alt'] ?? null,
        href: nextState.href,
        kind: 'image',
        src: resolvedSrc,
      });
      continue;
    }

    inlines.push(
      ...(await normalizeInlineNodes(
        getNodeChildren(node),
        resolveAsset,
        nextState,
      )),
    );
  }

  return compactInlines(inlines);
}

function compactInlines(inlines: ReaderInline[]) {
  const compacted: ReaderInline[] = [];

  for (const inline of inlines) {
    if (inline.kind === 'image') {
      compacted.push(inline);
      continue;
    }

    const previous = compacted.at(-1);
    if (
      previous &&
      previous.kind === 'text' &&
      previous.bold === inline.bold &&
      previous.italic === inline.italic &&
      previous.href === inline.href
    ) {
      previous.text = `${previous.text}${inline.text}`;
      continue;
    }

    compacted.push({ ...inline });
  }

  return compacted.filter((inline) =>
    inline.kind === 'image' ? true : inline.text.length > 0,
  );
}

function buildInlineText(inlines: ReaderInline[]) {
  return inlines
    .filter(
      (inline): inline is Extract<ReaderInline, { kind: 'text' }> =>
        inline.kind === 'text',
    )
    .map((inline) => inline.text)
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
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

function hasDirectBlockChildren(children: OrderedNode[]) {
  return children.some((child) => {
    const tagName = getNodeTagName(child);
    return Boolean(
      tagName &&
      (tagName === 'img' ||
        tagName === 'blockquote' ||
        tagName === 'ol' ||
        tagName === 'p' ||
        tagName === 'ul' ||
        tagName.match(/^h[1-6]$/) ||
        blockContainerTags.has(tagName)),
    );
  });
}

function hasInlineImages(inlines: ReaderInline[]) {
  return inlines.some((inline) => inline.kind === 'image');
}

function createEmptyChapter(input: {
  chapterId: string;
  href: string;
  label: string;
  spineIndex: number;
}): ReaderChapter {
  return {
    blocks: [],
    chapterId: input.chapterId,
    href: input.href,
    label: input.label,
    nextChapterId: null,
    previousChapterId: null,
    spineIndex: input.spineIndex,
    title: input.label,
  };
}

function getChapterTitleFromBlocks(blocks: ReaderBlock[]) {
  for (const block of blocks) {
    if (block.kind === 'heading' && block.text.trim().length > 0) {
      return block.text.trim();
    }
  }

  return null;
}

async function readEpubAssetAsDataUrl(
  zip: JSZip,
  packagePath: string,
  chapterHref: string,
  assetPath: string,
) {
  const chapterPath = resolveZipPath(packagePath, chapterHref);
  const resolvedPath = resolveZipPath(chapterPath, assetPath);
  const assetFile = zip.file(resolvedPath);

  if (!assetFile) {
    return null;
  }

  const bytes = await assetFile.async('nodebuffer');
  const mimeType =
    mime.lookup(resolvedPath) || inferMimeTypeFromPath(resolvedPath);
  return `data:${mimeType};base64,${bytes.toString('base64')}`;
}

function inferMimeTypeFromPath(path: string) {
  const extension = extname(path).toLowerCase();

  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg';
  }

  if (extension === '.png') {
    return 'image/png';
  }

  if (extension === '.gif') {
    return 'image/gif';
  }

  if (extension === '.svg') {
    return 'image/svg+xml';
  }

  return 'application/octet-stream';
}

async function readZipText(zip: JSZip, path: string) {
  const file = zip.file(path);

  if (!file) {
    throw new Error(`The EPUB is missing ${path}.`);
  }

  return file.async('text');
}

function createChapterId(spineIndex: number, href: string) {
  const base =
    href
      .split('/')
      .at(-1)
      ?.replace(/\.[^.]+$/, '') ?? 'chapter';
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `chapter-${spineIndex + 1}${slug ? `-${slug}` : ''}`;
}

function createTocNodeId(path: number[]) {
  return `toc:${path.join('.')}`;
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

function findFirstNodeByTag(
  nodes: OrderedNode[],
  tagName: string,
): OrderedNode | null {
  for (const node of nodes) {
    const currentTag = getNodeTagName(node);
    if (currentTag === tagName) {
      return node;
    }

    const nestedMatch = findFirstNodeByTag(getNodeChildren(node), tagName);
    if (nestedMatch) {
      return nestedMatch;
    }
  }

  return null;
}

function getNodeTagName(node: OrderedNode) {
  return Object.keys(node)
    .find((key) => key !== ':@')
    ?.split(':')
    .at(-1);
}

function getNodeChildren(node: OrderedNode) {
  const tagName = Object.keys(node).find((key) => key !== ':@');
  if (!tagName) {
    return [];
  }

  const value = node[tagName];
  return Array.isArray(value) ? (value as OrderedNode[]) : [];
}

function getNodeAttributes(node: OrderedNode) {
  return (node[':@'] ?? {}) as Record<string, string>;
}

function firstAsArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

async function reduceAsync<T>(
  items: T[],
  callback: (accumulator: undefined, item: T, index: number) => Promise<void>,
) {
  for (let index = 0; index < items.length; index += 1) {
    await callback(undefined, items[index], index);
  }
}
