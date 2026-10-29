import JSZip from 'jszip';

export async function classicEpubFixture(language = 'en') {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  zip.file(
    'META-INF/container.xml',
    '<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>',
  );
  zip.file(
    'book.opf',
    `<package xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0">
    <metadata><dc:title>Classic</dc:title><dc:creator>Author</dc:creator><dc:language>${language}</dc:language></metadata>
    <manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest>
    <spine><itemref idref="chapter"/></spine></package>`,
  );
  const paragraph =
    'The reader followed the story through a quiet town, noticing the people and their choices. '.repeat(
      5,
    );
  zip.file(
    'chapter.xhtml',
    `<html><body><h1>Chapter One</h1>${Array.from({ length: 6 }, () => `<p>${paragraph}</p>`).join('')}</body></html>`,
  );
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
