import JSZip from 'jszip';
import mime from 'mime-types';
import { ParsedTocNode } from './toc';
import { firstAsArray } from './xml-utils';
import {
  normalizeArchiveLookupPath,
  normalizeArchivePath,
  dirnameOfZipPath,
  toPackageRelativeHref,
  hasReadableDocumentExtension,
  normalizeHrefForLookup,
} from './archive';

export type ManifestItem = {
  href: string;
  id: string | null;
  mediaType?: string;
  properties?: string;
};

const readableDocumentMediaTypes = new Set([
  'application/xhtml+xml',
  'application/xml',
  'text/html',
]);

export function parseManifestItems(
  items: Record<string, string> | Array<Record<string, string>> | undefined,
): ManifestItem[] {
  return firstAsArray(items)
    .map(
      (item) =>
        ({
          href: item['@_href'] ?? '',
          id: item['@_id'] ?? null,
          mediaType: item['@_media-type'],
          properties: item['@_properties'],
        }) satisfies ManifestItem,
    )
    .filter((item) => item.href);
}

export function buildManifestById(manifestItems: ManifestItem[]) {
  return new Map<string, ManifestItem>(
    manifestItems.flatMap((item) =>
      item.id ? [[item.id, item] as const] : [],
    ),
  );
}

export function resolveReadingOrderItems(input: {
  packagePath: string;
  manifestById: Map<string, ManifestItem>;
  manifestItems: ManifestItem[];
  parsedToc: ParsedTocNode[];
  spineItemRefs: string[];
  zip: JSZip;
}) {
  const spineItems = input.spineItemRefs
    .map((idref) => input.manifestById.get(idref))
    .filter((item): item is ManifestItem => item !== undefined);

  if (spineItems.length > 0) {
    return spineItems;
  }

  const tocItems = resolveReadingOrderItemsFromToc(
    input.parsedToc,
    input.manifestItems,
  );
  if (tocItems.length > 0) {
    return tocItems;
  }

  const manifestFallbackItems = input.manifestItems.filter(
    isReadableContentManifestItem,
  );
  if (manifestFallbackItems.length > 0) {
    return manifestFallbackItems;
  }

  return discoverReadableArchiveItems(input.zip, input.packagePath);
}

function resolveReadingOrderItemsFromToc(
  toc: ParsedTocNode[],
  manifestItems: ManifestItem[],
) {
  const manifestItemByHref = new Map(
    manifestItems.map((item) => [normalizeHrefForLookup(item.href), item]),
  );
  const seen = new Set<string>();
  const orderedItems: ManifestItem[] = [];

  for (const href of flattenTocHrefs(toc)) {
    const normalizedHref = normalizeHrefForLookup(href);

    if (seen.has(normalizedHref)) {
      continue;
    }

    const manifestItem = manifestItemByHref.get(normalizedHref);
    if (!manifestItem || !isReadableContentManifestItem(manifestItem)) {
      continue;
    }

    seen.add(normalizedHref);
    orderedItems.push(manifestItem);
  }

  return orderedItems;
}

function flattenTocHrefs(toc: ParsedTocNode[]): string[] {
  const hrefs: string[] = [];

  for (const node of toc) {
    if (node.href) {
      hrefs.push(node.href);
    }

    hrefs.push(...flattenTocHrefs(node.children));
  }

  return hrefs;
}

function isReadableContentManifestItem(item: ManifestItem) {
  if (!item.href || item.properties?.split(/\s+/).includes('nav')) {
    return false;
  }

  if (item.mediaType === 'application/x-dtbncx+xml') {
    return false;
  }

  return (
    readableDocumentMediaTypes.has(item.mediaType ?? '') ||
    hasReadableDocumentExtension(item.href)
  );
}

function discoverReadableArchiveItems(zip: JSZip, packagePath: string) {
  const packageDirectory = normalizeArchivePath(dirnameOfZipPath(packagePath));

  return Object.values(zip.files)
    .filter((file) => !file.dir)
    .map((file, index) => ({
      href: toPackageRelativeHref(file.name, packageDirectory),
      id: `archive-${index}`,
      mediaType: mime.lookup(file.name) || undefined,
      properties: undefined,
    }))
    .filter((item) => isReadableArchiveItem(item, packageDirectory));
}

function isReadableArchiveItem(item: ManifestItem, packageDirectory: string) {
  if (!item.href || !hasReadableDocumentExtension(item.href)) {
    return false;
  }

  const normalizedHref = normalizeArchiveLookupPath(item.href);
  const normalizedPackageDirectory =
    normalizeArchiveLookupPath(packageDirectory);

  if (
    normalizedHref.startsWith('meta-inf/') ||
    normalizedHref.endsWith('.opf') ||
    normalizedHref.endsWith('.ncx') ||
    normalizedHref.includes('/toc.') ||
    normalizedHref.includes('/nav.')
  ) {
    return false;
  }

  if (!normalizedPackageDirectory) {
    return true;
  }

  return (
    normalizedHref.startsWith(`${normalizedPackageDirectory}/`) ||
    !normalizedHref.includes('/')
  );
}
