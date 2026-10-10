import JSZip from 'jszip';
import { xmlParser, firstAsArray } from './xml-utils';
import { readPackagePath, readZipText } from './archive';
import {
  parseManifestItems,
  buildManifestById,
  resolveReadingOrderItems,
} from './manifest';
import { readTocEntries } from './toc';

type PackageDocument = {
  package?: {
    manifest?: { item?: Record<string, string> | Record<string, string>[] };
    spine?: {
      ['@_toc']?: string;
      itemref?: Record<string, string> | Record<string, string>[];
    };
  };
};
export async function readEpubPackageInput(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const packagePath = await readPackagePath(zip);
  const document = xmlParser.parse(
    await readZipText(zip, packagePath),
  ) as PackageDocument;
  const manifestItems = parseManifestItems(document.package?.manifest?.item);
  const manifestById = buildManifestById(manifestItems);
  const parsedToc = await readTocEntries(zip, packagePath, {
    manifestItems,
    ncxId: document.package?.spine?.['@_toc'] ?? null,
  });
  const spineItems = resolveReadingOrderItems({
    packagePath,
    manifestItems,
    manifestById,
    parsedToc,
    spineItemRefs: firstAsArray(document.package?.spine?.itemref).map(
      (item) => item['@_idref'] ?? '',
    ),
    zip,
  });
  if (!spineItems.length)
    throw new Error('The EPUB does not contain readable chapter documents.');
  return { zip, packagePath, parsedToc, spineItems };
}
