import JSZip from 'jszip';
import { buildReaderPackageFromEpub } from './epub-reader-package';

const ART_FILE = 'art.png';

export async function picturePackage(bodies: string[], authoredToc = false) {
  const zip = new JSZip();
  zip.file(
    'META-INF/container.xml',
    '<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>',
  );
  zip.file(
    'book.opf',
    `<package><manifest>${bodies
      .map(
        (_, i) =>
          `<item id="c${i}" href="${i}.xhtml" media-type="application/xhtml+xml"/>`,
      )
      .join('')}
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    </manifest><spine>${bodies.map((_, i) => `<itemref idref="c${i}"/>`).join('')}</spine></package>`,
  );
  bodies.forEach((body, i) =>
    zip.file(
      `${i}.xhtml`,
      `<html lang="en" xmlns="http://www.w3.org/1999/xhtml"><body>${body}</body></html>`,
    ),
  );
  if (!authoredToc)
    zip.file(
      'nav.xhtml',
      '<html lang="en" xmlns="http://www.w3.org/1999/xhtml"><body/></html>',
    );
  if (authoredToc)
    zip.file(
      'nav.xhtml',
      // EPUB extends XHTML with this namespaced navigation attribute.
      //noinspection HtmlUnknownAttribute
      // language=XML
      `<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol>${bodies
        .map((_, i) => `<li><a href="${i}.xhtml">Section ${i}</a></li>`)
        .join('')}</ol></nav></body></html>`,
    );
  zip.file(ART_FILE, Buffer.from('png-bits'));
  return buildReaderPackageFromEpub({
    buffer: await zip.generateAsync({ type: 'nodebuffer' }),
    authors: [],
    checksum: 'fixture',
    title: 'Fixture',
    language: 'en',
  });
}

export const picture = `<p><img src="${ART_FILE}" alt="Illustration description"/></p>`;
export const prose = '<h1>Story</h1><p>Once upon a time.</p>';
