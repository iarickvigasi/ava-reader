export function getNoteRole(
  attrs: Record<string, string>,
): 'footnote' | 'endnote' | undefined {
  const types = (attrs['@_epub:type'] ?? '').split(/\s+/);
  if (types.includes('endnote')) return 'endnote';
  if (types.includes('footnote')) return 'footnote';
  const roles = (attrs['@_role'] ?? '').split(/\s+/);
  if (roles.includes('doc-endnote')) return 'endnote';
  if (roles.includes('doc-footnote')) return 'footnote';
  return undefined;
}
