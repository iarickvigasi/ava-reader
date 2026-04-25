/**
 * For a single chapter document: walk the <head>, find every CSS source
 * we can extract (linked stylesheets + inline <style> blocks), pull
 * their text out of the EPUB zip, and compile them into a hint map.
 *
 * Errors and missing files are tolerated — a broken stylesheet must
 * never break chapter parsing. We just skip whatever doesn't load.
 */

import {
  findFirstNodeByTag,
  getNodeAttributes,
  getNodeChildren,
  getNodeTagName,
  type OrderedNode,
} from '../xml-utils';
import {
  buildStylesheetHintMap,
  createEmptyStylesheetHintMap,
  type StylesheetHintMap,
} from './build-stylesheet-hints';

export type StylesheetTextLoader = (
  hrefRelativeToChapter: string,
) => Promise<string | null>;

export async function loadChapterStylesheetHints(
  parsedChapter: OrderedNode[],
  loadStylesheetText: StylesheetTextLoader,
): Promise<StylesheetHintMap> {
  const headNode = findFirstNodeByTag(parsedChapter, 'head');
  if (!headNode) {
    return createEmptyStylesheetHintMap();
  }

  const headChildren = getNodeChildren(headNode);
  const inlineStyles = collectInlineStyles(headChildren);
  const linkedHrefs = collectLinkedStylesheetHrefs(headChildren);

  const linkedTexts = await Promise.all(
    linkedHrefs.map((href) => safeLoad(loadStylesheetText, href)),
  );

  const cssTexts = [
    ...linkedTexts.filter((text): text is string => Boolean(text)),
    ...inlineStyles,
  ];

  return buildStylesheetHintMap(cssTexts);
}

async function safeLoad(
  loader: StylesheetTextLoader,
  href: string,
): Promise<string | null> {
  try {
    return await loader(href);
  } catch {
    return null;
  }
}

function collectLinkedStylesheetHrefs(headChildren: OrderedNode[]): string[] {
  const hrefs: string[] = [];

  for (const node of headChildren) {
    if (getNodeTagName(node) !== 'link') {
      continue;
    }

    const attrs = getNodeAttributes(node);
    const rel = (attrs['@_rel'] ?? '').toLowerCase();
    const type = (attrs['@_type'] ?? '').toLowerCase();
    const href = attrs['@_href'];

    if (!href) {
      continue;
    }

    // Accept either rel="stylesheet" or type="text/css" — some EPUBs
    // omit one or the other.
    if (rel === 'stylesheet' || type === 'text/css') {
      hrefs.push(href);
    }
  }

  return hrefs;
}

function collectInlineStyles(headChildren: OrderedNode[]): string[] {
  const texts: string[] = [];

  for (const node of headChildren) {
    if (getNodeTagName(node) !== 'style') {
      continue;
    }

    const text = collectTextContent(node);
    if (text.trim().length > 0) {
      texts.push(text);
    }
  }

  return texts;
}

function collectTextContent(node: OrderedNode): string {
  let out = '';
  for (const child of getNodeChildren(node)) {
    if (getNodeTagName(child) === '#text') {
      const value = (child as { '#text'?: unknown })['#text'];
      if (typeof value === 'string') {
        out += value;
      } else if (typeof value === 'number') {
        out += String(value);
      }
      continue;
    }

    out += collectTextContent(child);
  }
  return out;
}
