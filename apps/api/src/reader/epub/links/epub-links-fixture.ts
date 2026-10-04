import JSZip from 'jszip';
import { buildReaderPackageFromEpub } from '../epub-reader-package';

export async function importedReferences(
  note = '<p id="note">The distant note. <a href="../body.xhtml#call">Return</a></p>',
  body?: string,
) {
  const zip = new JSZip();
  zip.file(
    'META-INF/container.xml',
    '<container><rootfiles><rootfile full-path="OEBPS/package.opf"/></rootfiles></container>',
  );
  zip.file(
    'OEBPS/package.opf',
    `<package><manifest>
    <item id="body" href="body.xhtml" media-type="application/xhtml+xml"/>
    <item id="middle" href="middle.xhtml" media-type="application/xhtml+xml"/>
    <item id="notes" href="notes/end.xhtml" media-type="application/xhtml+xml"/>
    <item id="image" href="large.png" media-type="image/png"/>
  </manifest><spine><itemref idref="body"/><itemref idref="middle"/><itemref idref="notes"/></spine></package>`,
  );
  zip.file(
    'OEBPS/body.xhtml',
    body
      ? `<html><body><h1>Body</h1>${body}</body></html>`
      : `<html><body><h1>Body</h1>
    <p id="same">A😀B <a id="call" href="notes/end.xhtml#note"><sup>1</sup></a> follows.</p>
    <p><a href="https://example.invalid/#note">External</a></p>
  </body></html>`,
  );
  zip.file(
    'OEBPS/middle.xhtml',
    '<html><body><h1>Middle</h1><p id="same">A distinct paragraph.</p></body></html>',
  );
  zip.file(
    'OEBPS/notes/end.xhtml',
    `<html><body><h1>Notes</h1>${note}</body></html>`,
  );
  zip.file(
    'OEBPS/large.png',
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAASwAAAAUCAIAAAC4QZdWAAAAVElEQVR4nO3VMREAIAADsYJ/zyDjl8RAp7+e7Q3o3HAbECH0PCHERAgxEUJMhBATIcRECDERQkyEEBMhxEQIMRFCTIQQEyHERAgxEUJMhBATIaz1AeU4AScvZtPtAAAAAElFTkSuQmCC',
      'base64',
    ),
  );
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  return buildReaderPackageFromEpub({
    buffer,
    checksum: 'fixture',
    title: 'References',
    authors: [],
    language: 'en',
  });
}
