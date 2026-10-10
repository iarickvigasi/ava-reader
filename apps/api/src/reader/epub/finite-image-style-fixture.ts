import JSZip from 'jszip';
import { buildReaderPackageFromEpub } from './epub-reader-package';

export const FINITE_FIGURE_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAASwAAAAUCAIAAAC4QZdWAAAAVElEQVR4nO3VMREAIAADsYJ/zyDjl8RAp7+e7Q3o3HAbECH0PCHERAgxEUJMhBATIcRECDERQkyEEBMhxEQIMRFCTIQQEyHERAgxEUJMhBATIaz1AeU4AScvZtPtAAAAAElFTkSuQmCC',
  'base64',
);
export async function finiteImageStyleFixture(
  css: string,
  body: string,
  imageBytes = FINITE_FIGURE_BYTES,
) {
  const zip = new JSZip();
  zip.file(
    'META-INF/container.xml',
    '<container><rootfiles><rootfile full-path="package.opf"/></rootfiles></container>',
  );
  zip.file(
    'package.opf',
    '<package><manifest><item id="text" href="text.xhtml" media-type="application/xhtml+xml"/><item id="image" href="figure.png" media-type="image/png"/></manifest><spine><itemref idref="text"/></spine></package>',
  );
  zip.file(
    'text.xhtml',
    `<html xmlns="http://www.w3.org/1999/xhtml"><head><style>${css}</style></head><body>${body}</body></html>`,
  );
  zip.file('figure.png', imageBytes);
  return buildReaderPackageFromEpub({
    buffer: await zip.generateAsync({ type: 'nodebuffer' }),
    checksum: 'finite-image-style-source',
    title: 'Image styles',
    authors: [],
    language: 'en',
  });
}
