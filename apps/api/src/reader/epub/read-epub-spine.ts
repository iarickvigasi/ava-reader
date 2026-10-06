import type JSZip from 'jszip';
import { xmlParser, firstAsArray } from './xml-utils';
import { readZipText, readPackagePath } from './archive';
import {
  parseManifestItems,
  buildManifestById,
  resolveReadingOrderItems,
} from './manifest';
import { readTocEntries } from './toc';

export async function readEpubSpine(zip: JSZip) {
  const packagePath = await readPackagePath(zip);
  const packageXml = await readZipText(zip, packagePath);
  const packageDocument = xmlParser.parse(packageXml) as {
    package?: {
      manifest?: {
        item?: Record<string, string> | Array<Record<string, string>>;
      };
      spine?: {
        ['@_toc']?: string;
        itemref?: Record<string, string> | Array<Record<string, string>>;
      };
    };
  };

  const manifestItems = parseManifestItems(
    packageDocument.package?.manifest?.item,
  );
  const manifestById = buildManifestById(manifestItems);
  const parsedToc = await readTocEntries(zip, packagePath, {
    manifestItems,
    ncxId: packageDocument.package?.spine?.['@_toc'] ?? null,
  });
  const spineItems = resolveReadingOrderItems({
    packagePath,
    manifestItems,
    manifestById,
    parsedToc,
    spineItemRefs: firstAsArray(packageDocument.package?.spine?.itemref).map(
      (item) => item['@_idref'] ?? '',
    ),
    zip,
  });

  return { packagePath, parsedToc, spineItems };
}
