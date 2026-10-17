import JSZip from 'jszip';
import { buildReaderPackageFromEpub } from './epub-reader-package';

export async function finiteStyleFixture(css: string, body: string) {
  const zip = new JSZip();
  zip.file(
    'META-INF/container.xml',
    '<container><rootfiles><rootfile full-path="package.opf"/></rootfiles></container>',
  );
  zip.file(
    'package.opf',
    '<package><manifest><item id="text" href="text.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="text"/></spine></package>',
  );
  zip.file(
    'text.xhtml',
    `<html xmlns="http://www.w3.org/1999/xhtml"><head><style>${css}</style></head><body>${body}</body></html>`,
  );
  return buildReaderPackageFromEpub({
    buffer: await zip.generateAsync({ type: 'nodebuffer' }),
    checksum: 'finite-style-source',
    title: 'Styles',
    authors: [],
    language: 'en',
  });
}
