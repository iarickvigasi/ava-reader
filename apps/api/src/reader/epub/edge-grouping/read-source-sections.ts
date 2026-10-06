import JSZip from 'jszip';
import {
  readPackagePath,
  readZipText,
  normalizeHrefForLookup,
} from '../archive';
import { firstAsArray, xmlParser } from '../xml-utils';
import { parseManifestItems } from '../manifest';
import { readTocEntries, type ParsedTocNode } from '../toc';
import { resolveZipPath } from '../../../shared/zip-utils';
import { classifyDocument } from './classify-document';
import type { ReaderPackage } from '../../reader-types';
import type { SourceSection } from './types';

export async function readSourceSections(buffer: Buffer, pkg: ReaderPackage) {
  const zip = await JSZip.loadAsync(buffer);
  const path = await readPackagePath(zip);
  const document = xmlParser.parse(await readZipText(zip, path)) as {
    package: {
      manifest?: { item?: Record<string, string>[] };
      spine?: { '@_toc'?: string };
      guide?: { reference?: Record<string, string>[] };
    };
  };
  const labels = new Map<string, string[]>();
  const toc = await readTocEntries(zip, path, {
    manifestItems: parseManifestItems(document.package.manifest?.item),
    ncxId: document.package.spine?.['@_toc'] ?? null,
  });
  collect(toc);
  for (const entry of firstAsArray(document.package.guide?.reference)) {
    if (entry['@_href']) add(entry['@_href'], entry['@_title'] ?? '');
  }
  const result = new Map<string, SourceSection>();
  for (const chapter of pkg.chapters) {
    const key = normalizeHrefForLookup(chapter.href);
    if (result.has(key)) continue;
    // Headings in the stored package are authored text; generated labels aren't evidence.
    const headings = chapter.blocks
      .filter((b) => b.kind === 'heading')
      .slice(0, 1)
      .map((b) => b.text);
    const xml = await readZipText(
      zip,
      resolveZipPath(path, chapter.href.split('#')[0]),
    );
    result.set(
      key,
      classifyDocument(xml, [...(labels.get(key) ?? []), ...headings]),
    );
  }
  return result;

  function add(href: string, label: string) {
    // Subsection labels do not classify their entire source document.
    if (href.includes('#')) return;
    const key = normalizeHrefForLookup(href);
    labels.set(key, [...(labels.get(key) ?? []), label]);
  }
  function collect(nodes: ParsedTocNode[]) {
    for (const node of nodes) {
      if (node.href) add(node.href, node.label);
      collect(node.children);
    }
  }
}
