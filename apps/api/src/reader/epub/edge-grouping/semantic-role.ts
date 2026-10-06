import {
  getNodeAttributes,
  getNodeChildren,
  getNodeTagName,
  type OrderedNode,
} from '../xml-utils';
import type { EdgeRole } from './types';

// A nested epigraph/footnote does not classify the surrounding chapter.
export function semanticRole(body: OrderedNode): EdgeRole {
  const roles = new Set<EdgeRole>();
  visit(body, 'unknown');
  return roles.size === 1 ? [...roles][0] : 'unknown';

  function visit(node: OrderedNode, inherited: EdgeRole) {
    const attrs = getNodeAttributes(node);
    const tokens = `${attrs['@_epub:type'] ?? ''} ${attrs['@_role'] ?? ''}`
      .split(/\s+/)
      .map((t) => t.replace(/^doc-/, ''));
    const own = tokens.map(tokenRole).find((role) => role !== 'unknown');
    const role = own ?? inherited;
    const tag = getNodeTagName(node);
    if (tag === 'script' || tag === 'style') return;
    if (
      (tag === '#text' && String(node['#text']).trim()) ||
      tag === 'img' ||
      tag === 'svg'
    )
      roles.add(role);
    getNodeChildren(node).forEach((child) => visit(child, role));
  }
}

function tokenRole(type: string): EdgeRole {
  if (type === 'toc') return 'contents';
  if (type === 'footnote') return 'footnote';
  if (
    /^(cover|titlepage|halftitlepage|copyright-page|dedication|epigraph)$/.test(
      type,
    )
  )
    return 'front';
  if (
    /^(bibliography|index|glossary|acknowledgments|afterword|appendix|endnotes|contributors|colophon)$/.test(
      type,
    )
  )
    return 'back';
  return 'unknown';
}
