import JSZip from 'jszip';
import { buildReaderPackageFromEpub } from './epub-reader-package';

export async function importSourceFindingFixture(
  body: string,
  assets: Record<string, Buffer> = {},
) {
  const zip = new JSZip();
  for (const [path, bytes] of Object.entries(assets)) zip.file(path, bytes);
  zip.file(
    'META-INF/container.xml',
    '<container><rootfiles><rootfile full-path="OEBPS/package.opf"/></rootfiles></container>',
  );
  zip.file(
    'OEBPS/package.opf',
    '<package><manifest><item id="body" href="text/body.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="body"/></spine></package>',
  );
  zip.file(
    'OEBPS/text/body.xhtml',
    `<html><body><h1>Chapter</h1>${body}</body></html>`,
  );
  return buildReaderPackageFromEpub({
    buffer: await zip.generateAsync({ type: 'nodebuffer' }),
    authors: [],
    checksum: 'source-fixture',
    language: 'en',
    title: 'Source finding fixture',
  });
}
