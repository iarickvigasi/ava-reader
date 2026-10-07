export function isHrefLabel(label: string, href: string | null): boolean {
  if (!href) return false;
  const path = href.split('#')[0];
  return [href, path, path.split('/').at(-1)].includes(label.trim());
}
