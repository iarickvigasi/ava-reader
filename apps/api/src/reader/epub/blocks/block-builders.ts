import type {
  ReaderBlock,
  ReaderInline,
  ReaderListItem,
} from '../../reader-types';
import { OrderedNode, getNodeTagName } from '../xml-utils';
import { flattenInlineContent } from '../node-utils';
import { normalizeInlineNodes, buildInlineText } from './inline';

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

export function isBlockContainerTag(tagName: string): boolean {
  return blockContainerTags.has(tagName);
}

export function isInlineContainerTag(tagName: string): boolean {
  return inlineContainerTags.has(tagName);
}

export function hasDirectBlockChildren(children: OrderedNode[]) {
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

export function hasInlineImages(inlines: ReaderInline[]) {
  return inlines.some((inline) => inline.kind === 'image');
}

export function buildImageBlocksFromInlines(
  inlines: ReaderInline[],
  createBlockId: () => string,
  anchorId: string | null,
): ReaderBlock[] {
  return inlines
    .filter(
      (inline): inline is Extract<ReaderInline, { kind: 'image' }> =>
        inline.kind === 'image',
    )
    .map((inline) => ({
      alt: inline.alt,
      anchorId,
      id: createBlockId(),
      kind: 'image' as const,
      src: inline.src,
      text: inline.alt ?? '',
    }));
}

export async function buildImageBlock(
  attrs: Record<string, string>,
  createBlockId: () => string,
  resolveAsset: (assetPath: string) => Promise<string | null>,
  anchorId: string | null,
): Promise<ReaderBlock | null> {
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

export async function buildTextBlock(
  children: OrderedNode[],
  createBlockId: () => string,
  resolveAsset: (assetPath: string) => Promise<string | null>,
  anchorId: string | null,
  kind: 'paragraph' | 'blockquote',
): Promise<ReaderBlock | ReaderBlock[] | null> {
  return buildInlineBlock(
    children,
    createBlockId,
    resolveAsset,
    anchorId,
    kind,
  );
}

export async function buildHeadingBlock(
  children: OrderedNode[],
  createBlockId: () => string,
  resolveAsset: (assetPath: string) => Promise<string | null>,
  anchorId: string | null,
  level: number,
): Promise<ReaderBlock | ReaderBlock[] | null> {
  return buildInlineBlock(
    children,
    createBlockId,
    resolveAsset,
    anchorId,
    'heading',
    level,
  );
}

export async function buildListBlock(
  children: OrderedNode[],
  chapterId: string,
  createBlockId: () => string,
  resolveAsset: (assetPath: string) => Promise<string | null>,
  anchorId: string | null,
  ordered: boolean,
): Promise<ReaderBlock | null> {
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
    ordered,
    text: meaningfulItems.map((item) => item.text).join('\n'),
  };
}

export async function buildWrappedInlineBlock(
  node: OrderedNode,
  createBlockId: () => string,
  resolveAsset: (assetPath: string) => Promise<string | null>,
  anchorId: string | null,
): Promise<ReaderBlock | ReaderBlock[] | null> {
  return buildInlineBlock(
    [node],
    createBlockId,
    resolveAsset,
    anchorId,
    'paragraph',
  );
}

async function buildInlineBlock(
  children: OrderedNode[],
  createBlockId: () => string,
  resolveAsset: (assetPath: string) => Promise<string | null>,
  anchorId: string | null,
  kind: 'paragraph' | 'blockquote' | 'heading',
  level?: number,
): Promise<ReaderBlock | ReaderBlock[] | null> {
  const inlines = await normalizeInlineNodes(children, resolveAsset);
  const text = buildInlineText(inlines);

  if (!text && !hasInlineImages(inlines)) {
    return null;
  }

  if (!text && hasInlineImages(inlines)) {
    return buildImageBlocksFromInlines(inlines, createBlockId, anchorId);
  }

  if (kind === 'heading') {
    return {
      anchorId,
      id: createBlockId(),
      inlines,
      kind: 'heading',
      level: level!,
      text,
    };
  }

  return {
    anchorId,
    id: createBlockId(),
    inlines,
    kind,
    text,
  };
}
