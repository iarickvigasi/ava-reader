import type {
  ReaderBlock,
  ReaderInline,
  ReaderListItem,
} from '../../reader-types';
import type { EpubAsset } from '../archive';
import { OrderedNode, getNodeTagName } from '../xml-utils';
import { flattenInlineContent } from '../node-utils';
import { normalizeInlineNodes, buildInlineText } from './inline';
import type { ReaderTextAlign } from './text-align';

// Inline images at or above this natural width are promoted out of the
// surrounding paragraph and rendered as standalone block images so text
// flows above/below them rather than wrapping a small inline element.
// Below this we treat them as drop-caps or glyph-sized graphics that
// belong inline with the text they decorate.
const LARGE_INLINE_IMAGE_WIDTH_PX = 200;

function isLargeInlineImage(
  inline: ReaderInline,
): inline is Extract<ReaderInline, { kind: 'image' }> {
  return (
    inline.kind === 'image' &&
    typeof inline.naturalWidth === 'number' &&
    inline.naturalWidth >= LARGE_INLINE_IMAGE_WIDTH_PX
  );
}

// Visual-only hints lifted from the source HTML/CSS for a single block.
// Bundled together so we can extend it (margin, color, leading…)
// without a parameter explosion across every builder.
export type BlockStyleHints = {
  align?: ReaderTextAlign | null;
  fontSizeScale?: number | null;
  // Numeric CSS font-weight (100..900). Null/undefined means the
  // publisher didn't specify one and the renderer should use whatever
  // is appropriate for the block kind (e.g. headings stay bold-by-default).
  fontWeight?: number | null;
  // First-line indent in em (so it scales with font size on render).
  // 0 means "explicitly no indent" — distinct from undefined which
  // means "publisher said nothing, use the frontend default".
  textIndent?: number | null;
};

function applyBlockStyleHints<T extends Record<string, unknown>>(
  block: T,
  hints: BlockStyleHints | undefined,
): T {
  if (!hints) {
    return block;
  }

  const result: Record<string, unknown> = { ...block };

  if (hints.fontSizeScale != null) {
    result.fontSizeScale = hints.fontSizeScale;
  }

  if (hints.align != null) {
    result.align = hints.align;
  }

  if (hints.textIndent != null) {
    result.textIndent = hints.textIndent;
  }

  if (hints.fontWeight != null) {
    result.fontWeight = hints.fontWeight;
  }

  return result as T;
}

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
  resolveAsset: (assetPath: string) => Promise<EpubAsset | null>,
  anchorId: string | null,
): Promise<ReaderBlock | null> {
  const src = attrs['@_src'];
  if (!src) {
    return null;
  }

  const resolved = await resolveAsset(src);
  if (!resolved) {
    return null;
  }

  return {
    alt: attrs['@_alt'] ?? null,
    anchorId,
    id: createBlockId(),
    kind: 'image',
    src: resolved.src,
    text: attrs['@_alt'] ?? '',
  };
}

export async function buildTextBlock(
  children: OrderedNode[],
  createBlockId: () => string,
  resolveAsset: (assetPath: string) => Promise<EpubAsset | null>,
  anchorId: string | null,
  kind: 'paragraph' | 'blockquote',
  hints?: BlockStyleHints,
): Promise<ReaderBlock | ReaderBlock[] | null> {
  return buildInlineBlock(
    children,
    createBlockId,
    resolveAsset,
    anchorId,
    kind,
    undefined,
    hints,
  );
}

export async function buildHeadingBlock(
  children: OrderedNode[],
  createBlockId: () => string,
  resolveAsset: (assetPath: string) => Promise<EpubAsset | null>,
  anchorId: string | null,
  level: number,
  hints?: BlockStyleHints,
): Promise<ReaderBlock | ReaderBlock[] | null> {
  return buildInlineBlock(
    children,
    createBlockId,
    resolveAsset,
    anchorId,
    'heading',
    level,
    hints,
  );
}

export async function buildListBlock(
  children: OrderedNode[],
  chapterId: string,
  createBlockId: () => string,
  resolveAsset: (assetPath: string) => Promise<EpubAsset | null>,
  anchorId: string | null,
  ordered: boolean,
  hints?: BlockStyleHints,
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

  return applyBlockStyleHints(
    {
      anchorId,
      id: createBlockId(),
      items: meaningfulItems,
      kind: 'list' as const,
      ordered,
      text: meaningfulItems.map((item) => item.text).join('\n'),
    },
    hints,
  );
}

export async function buildWrappedInlineBlock(
  node: OrderedNode,
  createBlockId: () => string,
  resolveAsset: (assetPath: string) => Promise<EpubAsset | null>,
  anchorId: string | null,
  hints?: BlockStyleHints,
): Promise<ReaderBlock | ReaderBlock[] | null> {
  return buildInlineBlock(
    [node],
    createBlockId,
    resolveAsset,
    anchorId,
    'paragraph',
    undefined,
    hints,
  );
}

async function buildInlineBlock(
  children: OrderedNode[],
  createBlockId: () => string,
  resolveAsset: (assetPath: string) => Promise<EpubAsset | null>,
  anchorId: string | null,
  kind: 'paragraph' | 'blockquote' | 'heading',
  level: number | undefined,
  hints: BlockStyleHints | undefined,
): Promise<ReaderBlock | ReaderBlock[] | null> {
  const inlines = await normalizeInlineNodes(children, resolveAsset);
  const text = buildInlineText(inlines);

  if (!text && !hasInlineImages(inlines)) {
    return null;
  }

  if (!text && hasInlineImages(inlines)) {
    return buildImageBlocksFromInlines(inlines, createBlockId, anchorId);
  }

  // When a block mixes text with a large illustration, split the
  // illustration out as its own image block so it lays out at full
  // width instead of trying to flow inline with text. Drop-cap-sized
  // images (below the threshold) stay inline. Applies to headings too:
  // chapter titles often bundle a decorative illustration ahead of the
  // heading text in a single <h1>.
  if (inlines.some(isLargeInlineImage)) {
    return splitInlinesAroundLargeImages(
      inlines,
      createBlockId,
      anchorId,
      kind,
      level,
      hints,
    );
  }

  if (kind === 'heading') {
    return applyBlockStyleHints(
      {
        anchorId,
        id: createBlockId(),
        inlines,
        kind: 'heading' as const,
        level: level!,
        text,
      },
      hints,
    );
  }

  return applyBlockStyleHints(
    {
      anchorId,
      id: createBlockId(),
      inlines,
      kind,
      text,
    },
    hints,
  );
}

function splitInlinesAroundLargeImages(
  inlines: ReaderInline[],
  createBlockId: () => string,
  anchorId: string | null,
  kind: 'paragraph' | 'blockquote' | 'heading',
  level: number | undefined,
  hints: BlockStyleHints | undefined,
): ReaderBlock[] {
  const blocks: ReaderBlock[] = [];
  let pending: ReaderInline[] = [];
  let pendingAnchorId: string | null = anchorId;

  const flushPending = () => {
    const pendingText = buildInlineText(pending);
    if (!pendingText && !hasInlineImages(pending)) {
      pending = [];
      return;
    }
    const baseBlock =
      kind === 'heading'
        ? {
            anchorId: pendingAnchorId,
            id: createBlockId(),
            inlines: pending,
            kind: 'heading' as const,
            level: level!,
            text: pendingText,
          }
        : {
            anchorId: pendingAnchorId,
            id: createBlockId(),
            inlines: pending,
            kind,
            text: pendingText,
          };
    blocks.push(applyBlockStyleHints(baseBlock, hints));
    pending = [];
    pendingAnchorId = null;
  };

  for (const inline of inlines) {
    if (isLargeInlineImage(inline)) {
      flushPending();
      blocks.push({
        alt: inline.alt,
        anchorId: pendingAnchorId,
        id: createBlockId(),
        kind: 'image' as const,
        src: inline.src,
        text: inline.alt ?? '',
      });
      pendingAnchorId = null;
      continue;
    }
    pending.push(inline);
  }

  flushPending();
  return blocks;
}
