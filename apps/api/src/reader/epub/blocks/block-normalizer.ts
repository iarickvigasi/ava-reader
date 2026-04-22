import type { ReaderBlock } from '../../reader-types';
import {
  getNodeAttributes,
  getNodeChildren,
  getNodeTagName,
  OrderedNode,
} from '../xml-utils';
import {
  buildHeadingBlock,
  buildImageBlock,
  buildListBlock,
  buildTextBlock,
  buildWrappedInlineBlock,
  hasDirectBlockChildren,
  isBlockContainerTag,
  isInlineContainerTag,
} from './block-builders';

export async function normalizeBlockNode(
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
    return buildImageBlock(attrs, createBlockId, resolveAsset, anchorId);
  }

  if (tagName === 'p' || tagName === 'blockquote') {
    const kind = tagName === 'p' ? 'paragraph' : 'blockquote';
    return buildTextBlock(
      children,
      createBlockId,
      resolveAsset,
      anchorId,
      kind,
    );
  }

  if (tagName.match(/^h[1-6]$/)) {
    return buildHeadingBlock(
      children,
      createBlockId,
      resolveAsset,
      anchorId,
      Number(tagName.slice(1)),
    );
  }

  if (tagName === 'ol' || tagName === 'ul') {
    return buildListBlock(
      children,
      chapterId,
      createBlockId,
      resolveAsset,
      anchorId,
      tagName === 'ol',
    );
  }

  if (isBlockContainerTag(tagName)) {
    if (hasDirectBlockChildren(children)) {
      return await normalizeChildren(
        children,
        chapterId,
        createBlockId,
        resolveAsset,
      );
    }

    return buildTextBlock(
      children,
      createBlockId,
      resolveAsset,
      anchorId,
      'paragraph',
    );
  }

  if (isInlineContainerTag(tagName)) {
    return buildWrappedInlineBlock(node, createBlockId, resolveAsset, anchorId);
  }

  return normalizeChildren(children, chapterId, createBlockId, resolveAsset);
}

async function normalizeChildren(
  children: OrderedNode[],
  chapterId: string,
  createBlockId: () => string,
  resolveAsset: (assetPath: string) => Promise<string | null>,
): Promise<ReaderBlock[]> {
  const results = await Promise.all(
    children.map((child) =>
      normalizeBlockNode(child, chapterId, createBlockId, resolveAsset),
    ),
  );

  return flattenBlockResults(results);
}

function flattenBlockResults(
  results: Array<ReaderBlock | ReaderBlock[] | null>,
): ReaderBlock[] {
  return results.flatMap((entry) =>
    Array.isArray(entry) ? entry : entry ? [entry] : [],
  );
}
