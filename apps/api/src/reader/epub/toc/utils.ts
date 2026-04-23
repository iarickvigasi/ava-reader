export function createTocNodeId(path: number[]): string {
  return `toc:${path.join('.')}`;
}

export function extractAnchorIdFromHref(href: string): string | null {
  const fragment = href.split('#').slice(1).join('#').trim();
  return fragment.length > 0 ? decodeURIComponent(fragment) : null;
}

export function normalizeAnchorForLookup(anchorId: string): string {
  return decodeURIComponent(anchorId).trim().toLowerCase();
}
