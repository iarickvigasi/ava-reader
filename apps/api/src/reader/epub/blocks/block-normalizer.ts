import type { ReaderBlock } from '../../reader-types';
import {
  createEmptyStylesheetHintMap,
  mergeStylesheetClassHints,
  type StylesheetClassHints,
  type StylesheetHintMap,
} from '../css/build-stylesheet-hints';
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
  type BlockStyleHints,
} from './block-builders';
import { resolveFontSizeScaleFromStyle } from './font-size';
import { resolveFontWeightFromStyle } from './font-weight';
import { resolveTextAlignFromAttrs } from './text-align';
import { resolveTextIndentFromStyle } from './text-indent';

// Visual hints carried down through nested block containers. CSS
// inheritance behaviour: text-align, font-size and font-weight all
// inherit, so a <div style="text-align:center; font-size:0.85em">
// wrapping multiple <p>s should apply to every paragraph.
//
// text-indent does NOT inherit through arbitrary nesting in real CSS,
// but for our purposes the difference doesn't matter: <div> wrappers
// in EPUBs that set text-indent always intend it for the paragraphs
// inside. We propagate it the same way for simplicity.
type InheritedStyleHints = {
  align: BlockStyleHints['align'];
  fontSizeScale: BlockStyleHints['fontSizeScale'];
  fontWeight: BlockStyleHints['fontWeight'];
  textIndent: BlockStyleHints['textIndent'];
};

const EMPTY_HINTS: InheritedStyleHints = {
  align: null,
  fontSizeScale: null,
  fontWeight: null,
  textIndent: null,
};

export type NormalizeBlockOptions = {
  chapterId: string;
  createBlockId: () => string;
  resolveAsset: (assetPath: string) => Promise<string | null>;
  stylesheetHints?: StylesheetHintMap;
  inheritedHints?: InheritedStyleHints;
};

function lookupStylesheetHints(
  tagName: string,
  attrs: Record<string, string>,
  stylesheetHints: StylesheetHintMap,
): StylesheetClassHints | undefined {
  let result: StylesheetClassHints | undefined =
    stylesheetHints.tagHints.get(tagName);

  // Each class layered on, in document order — later classes override
  // earlier ones for any property they set.
  const classNames = (attrs['@_class'] ?? '').split(/\s+/).filter(Boolean);

  for (const className of classNames) {
    const classHint = stylesheetHints.classHints.get(className);
    if (classHint) {
      result = mergeStylesheetClassHints(result, classHint);
    }
  }

  return result;
}

function resolveOwnStyleHints(
  tagName: string,
  attrs: Record<string, string>,
  inherited: InheritedStyleHints,
  stylesheetHints: StylesheetHintMap,
): InheritedStyleHints {
  // Cascade: stylesheet (tag + classes) → inline style → inherited
  // fallback. Inline style="…" wins over external CSS, matching the
  // CSS specificity intuition publishers rely on.
  const fromStylesheet =
    lookupStylesheetHints(tagName, attrs, stylesheetHints) ?? {};
  const inlineAlign = resolveTextAlignFromAttrs(attrs);
  const inlineFontSizeScale = resolveFontSizeScaleFromStyle(attrs['@_style']);
  const inlineFontWeight = resolveFontWeightFromStyle(attrs['@_style']);
  const inlineTextIndent = resolveTextIndentFromStyle(attrs['@_style']);

  return {
    align: inlineAlign ?? fromStylesheet.align ?? inherited.align ?? null,
    fontSizeScale:
      inlineFontSizeScale ??
      fromStylesheet.fontSizeScale ??
      inherited.fontSizeScale ??
      null,
    fontWeight:
      inlineFontWeight ??
      fromStylesheet.fontWeight ??
      inherited.fontWeight ??
      null,
    textIndent:
      inlineTextIndent ??
      fromStylesheet.textIndent ??
      inherited.textIndent ??
      null,
  };
}

function toBuilderHints(
  hints: InheritedStyleHints,
): BlockStyleHints | undefined {
  if (
    hints.align == null &&
    hints.fontSizeScale == null &&
    hints.fontWeight == null &&
    hints.textIndent == null
  ) {
    return undefined;
  }
  return hints;
}

export async function normalizeBlockNode(
  node: OrderedNode,
  options: NormalizeBlockOptions,
): Promise<ReaderBlock | ReaderBlock[] | null> {
  const tagName = getNodeTagName(node);
  if (!tagName) {
    return null;
  }

  const stylesheetHints =
    options.stylesheetHints ?? createEmptyStylesheetHintMap();
  const inheritedHints = options.inheritedHints ?? EMPTY_HINTS;

  const attrs = getNodeAttributes(node);
  const anchorId = attrs['@_id'] ?? attrs['@_name'] ?? null;
  const children = getNodeChildren(node);

  const hints = resolveOwnStyleHints(
    tagName,
    attrs,
    inheritedHints,
    stylesheetHints,
  );
  const builderHints = toBuilderHints(hints);
  const childOptions: NormalizeBlockOptions = {
    ...options,
    stylesheetHints,
    inheritedHints: hints,
  };

  const { createBlockId, resolveAsset, chapterId } = options;

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
      builderHints,
    );
  }

  if (tagName.match(/^h[1-6]$/)) {
    return buildHeadingBlock(
      children,
      createBlockId,
      resolveAsset,
      anchorId,
      Number(tagName.slice(1)),
      builderHints,
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
      builderHints,
    );
  }

  if (isBlockContainerTag(tagName)) {
    if (hasDirectBlockChildren(children)) {
      // Pass hints down so e.g. <div style="text-align:center"> with
      // multiple <p> children applies the alignment to each child.
      return await normalizeChildren(children, childOptions);
    }

    return buildTextBlock(
      children,
      createBlockId,
      resolveAsset,
      anchorId,
      'paragraph',
      builderHints,
    );
  }

  if (isInlineContainerTag(tagName)) {
    return buildWrappedInlineBlock(
      node,
      createBlockId,
      resolveAsset,
      anchorId,
      builderHints,
    );
  }

  return normalizeChildren(children, childOptions);
}

async function normalizeChildren(
  children: OrderedNode[],
  options: NormalizeBlockOptions,
): Promise<ReaderBlock[]> {
  const results = await Promise.all(
    children.map((child) => normalizeBlockNode(child, options)),
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
