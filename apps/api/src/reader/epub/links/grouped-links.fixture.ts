import JSZip from 'jszip';
import { buildReaderPackageFromEpub } from '../epub-reader-package';

export async function groupedLinks(documents: Record<string, string>) {
  const zip = new JSZip();
  zip.file(
    'META-INF/container.xml',
    '<container><rootfiles><rootfile full-path="package.opf"/></rootfiles></container>',
  );
  const paths = Object.keys(documents);
  zip.file(
    'package.opf',
    `<package><manifest>${paths
      .map(
        (href, i) =>
          `<item id="c${i}" href="${href}" media-type="application/xhtml+xml"/>`,
      )
      .join(
        '',
      )}</manifest><spine>${paths.map((_, i) => `<itemref idref="c${i}"/>`).join('')}</spine></package>`,
  );
  for (const [path, body] of Object.entries(documents))
    zip.file(
      path,
      `<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body>${body}</body></html>`,
    );
  return buildReaderPackageFromEpub({
    buffer: await zip.generateAsync({ type: 'nodebuffer' }),
    authors: [],
    checksum: 'grouped-links-fixture',
    title: 'References',
    language: 'en',
  });
}
