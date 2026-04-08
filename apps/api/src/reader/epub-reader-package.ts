import { extname } from 'path';
import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';
import mime from 'mime-types';
import type {
  ReaderBlock,
  ReaderChapter,
  ReaderInline,
  ReaderListItem,
  ReaderPackage,
  ReaderTocEntry,
} from './reader-types';

type OrderedNode = Record<string, unknown>;
type ManifestItem = {
  href: string;
  id: string;
  mediaType?: string;
  properties?: string;
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

export async function buildReaderPackageFromEpub(input: {
  author: string | null;
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
          id: item['@_id'] ?? '',
          mediaType: item['@_media-type'],
          properties: item['@_properties'],
        }) satisfies ManifestItem,
    )
    .filter((item) => item.id && item.href);
  const manifestById = new Map<string, ManifestItem>(
    manifestItems.map((item) => [item.id, item]),
  );
  const spineItems = firstAsArray(packageDocument.package?.spine?.itemref)
    .map((item) => manifestById.get(item['@_idref'] ?? ''))
    .filter((item): item is ManifestItem => item !== undefined);

  if (spineItems.length === 0) {
    throw new Error('The EPUB does not contain a readable spine.');
  }

  const tocEntries = await readTocEntries(zip, packagePath, {
    manifestItems,
    ncxId: packageDocument.package?.spine?.['@_toc'] ?? null,
  });
  const tocByHref = new Map(
    tocEntries.map((entry) => [normalizeHrefForLookup(entry.href), entry]),
  );

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
        return createEmptyChapter({
          chapterId,
          href,
          label:
            tocByHref.get(normalizeHrefForLookup(href))?.label ??
            `Chapter ${spineIndex + 1}`,
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
      const fallbackLabel =
        tocByHref.get(normalizeHrefForLookup(href))?.label ??
        getChapterTitleFromBlocks(blocks) ??
        `Chapter ${spineIndex + 1}`;

      return {
        blocks,
        chapterId,
        href,
        label: fallbackLabel,
        nextChapterId: null,
        previousChapterId: null,
        spineIndex,
        title: getChapterTitleFromBlocks(blocks) ?? fallbackLabel,
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

  const resolvedToc =
    tocEntries.length > 0
      ? chapters.map((chapter) => ({
          chapterId: chapter.chapterId,
          href: chapter.href,
          label:
            tocByHref.get(normalizeHrefForLookup(chapter.href))?.label ??
            chapter.label,
          spineIndex: chapter.spineIndex,
        }))
      : chapters.map((chapter) => ({
          chapterId: chapter.chapterId,
          href: chapter.href,
          label: chapter.label,
          spineIndex: chapter.spineIndex,
        }));

  const chapterIdByHref = new Map(
    chapters.map((chapter) => [
      normalizeHrefForLookup(chapter.href),
      chapter.chapterId,
    ]),
  );

  return {
    chapters,
    manifest: {
      author: input.author,
      language: input.language,
      sourceChecksum: input.checksum,
      title: input.title,
      totalBlocks,
      totalChapters: chapters.length,
    },
    toc: resolvedToc.map((entry) => ({
      ...entry,
      chapterId:
        chapterIdByHref.get(normalizeHrefForLookup(entry.href)) ??
        entry.chapterId,
    })),
    version: 1,
  };
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
): Promise<ReaderTocEntry[]> {
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
        return entries.map((entry, index) => ({
          chapterId: '',
          href: entry.href,
          label: entry.label,
          spineIndex: index,
        }));
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

  return flattenNcxEntries(firstAsArray(ncxDocument.ncx?.navMap?.navPoint)).map(
    (entry, index) => ({
      chapterId: '',
      href: entry.href,
      label: entry.label,
      spineIndex: index,
    }),
  );
}

type NcxNode = {
  content?: { ['@_src']?: string };
  navLabel?: { text?: string };
  navPoint?: NcxNode | NcxNode[];
};

function flattenNcxEntries(nodes: NcxNode[]) {
  const entries: Array<{ href: string; label: string }> = [];

  for (const node of nodes) {
    const href = node.content?.['@_src'] ?? '';
    const label =
      typeof node.navLabel?.text === 'string' ? node.navLabel.text : '';

    if (href && label) {
      entries.push({ href, label });
    }

    entries.push(...flattenNcxEntries(firstAsArray(node.navPoint)));
  }

  return entries;
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
): Array<{ href: string; label: string }> {
  const entries: Array<{ href: string; label: string }> = [];

  for (const node of nodes) {
    const tagName = getNodeTagName(node);

    if (tagName === 'a') {
      const href = getNodeAttributes(node)['@_href'];
      const label = inlineNodesToText(getNodeChildren(node));
      if (href && label) {
        entries.push({ href, label });
      }
    }

    if (tagName === 'li' || tagName === 'ol' || tagName === 'nav') {
      entries.push(...readNavEntries(getNodeChildren(node)));
    }
  }

  return dedupeNavEntries(entries);
}

function dedupeNavEntries(entries: Array<{ href: string; label: string }>) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = normalizeHrefForLookup(entry.href);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizeBlocksFromNodes(
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

  return reduceAsync(nodes, async (_ignored, node) => {
    await pushBlock(node);
  }).then(() => blocks);
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

function resolveZipPath(baseFilePath: string, relativeAssetPath: string) {
  const baseSegments = baseFilePath.split('/').slice(0, -1);
  const assetSegments = relativeAssetPath.split('/');
  const resolved = [...baseSegments];

  for (const segment of assetSegments) {
    if (!segment || segment === '.') {
      continue;
    }

    if (segment === '..') {
      resolved.pop();
      continue;
    }

    resolved.push(segment);
  }

  return resolved.join('/');
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
