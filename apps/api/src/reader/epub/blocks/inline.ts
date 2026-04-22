import type { ReaderInline } from '../../reader-types';
import {
  OrderedNode,
  getNodeTagName,
  getNodeChildren,
  getNodeAttributes,
} from '../xml-utils';
import { normalizeInlineText } from '../node-utils';

type InlineState = {
  bold?: boolean;
  href?: string;
  italic?: boolean;
};

export async function normalizeInlineNodes(
  nodes: OrderedNode[],
  resolveAsset: (assetPath: string) => Promise<string | null>,
  state: InlineState = {},
): Promise<ReaderInline[]> {
  const inlines: ReaderInline[] = [];

  for (const node of nodes) {
    const tagName = getNodeTagName(node);
    if (!tagName) {
      continue;
    }

    if (tagName === '#text') {
      const textValue = extractTextValue(node);
      if (textValue.length > 0) {
        inlines.push({
          bold: state.bold,
          href: state.href,
          italic: state.italic,
          kind: 'text',
          text: textValue,
        });
      }
      continue;
    }

    const nextState = deriveInlineState(node, state);

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
      const imageInline = await tryResolveImageInline(
        node,
        nextState.href,
        resolveAsset,
      );
      if (imageInline) {
        inlines.push(imageInline);
      }
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

function extractTextValue(node: OrderedNode): string {
  const rawText = node['#text'];
  if (typeof rawText === 'string' || typeof rawText === 'number') {
    return normalizeInlineText(String(rawText));
  }
  return '';
}

function deriveInlineState(node: OrderedNode, state: InlineState): InlineState {
  const tagName = getNodeTagName(node);
  const attrs = getNodeAttributes(node);

  return {
    bold: state.bold || tagName === 'b' || tagName === 'strong',
    href: tagName === 'a' ? (attrs['@_href'] ?? state.href) : state.href,
    italic: state.italic || tagName === 'em' || tagName === 'i',
  };
}

async function tryResolveImageInline(
  node: OrderedNode,
  href: string | undefined,
  resolveAsset: (assetPath: string) => Promise<string | null>,
): Promise<ReaderInline | null> {
  const attrs = getNodeAttributes(node);
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
    href,
    kind: 'image',
    src: resolvedSrc,
  };
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

export function buildInlineText(inlines: ReaderInline[]) {
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
