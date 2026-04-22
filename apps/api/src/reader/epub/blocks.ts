import type {
  ReaderBlock,
  ReaderInline,
  ReaderListItem,
} from '../reader-types';
import {
  OrderedNode,
  getNodeTagName,
  getNodeChildren,
  getNodeAttributes,
} from './xml-utils';

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

export async function normalizeBlocksFromNodes(
  nodes: OrderedNode[],
  chapterId: string,
  resolveAsset: (assetPath: string) => Promise<string | null>,
) {
  let blockIndex = 0;
  const blocks: ReaderBlock[] = [];

  const createBlockId = () => {
    blockIndex += 1;
    return `${chapterId}::b${blockIndex}`;
  };

  for (const node of nodes) {
    const normalized = await normalizeBlockNode(
      node,
      chapterId,
      createBlockId,
      resolveAsset,
    );

    if (Array.isArray(normalized)) {
      blocks.push(...normalized);
    } else if (normalized) {
      blocks.push(normalized);
    }
  }

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
