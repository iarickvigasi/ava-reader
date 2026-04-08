import JSZip from 'jszip';
import { buildReaderPackageFromEpub } from './epub-reader-package';

describe('buildReaderPackageFromEpub', () => {
  it('builds a normalized reader package from EPUB spine chapters', async () => {
    const epubBuffer = await createReaderEpubBuffer();

    const readerPackage = await buildReaderPackageFromEpub({
      author: 'Example Author',
      buffer: epubBuffer,
      checksum: 'source-checksum',
      language: 'en',
      title: 'Example Title',
    });

    expect(readerPackage.version).toBe(1);
    expect(readerPackage.manifest.totalChapters).toBe(2);
    expect(readerPackage.toc).toHaveLength(2);
    expect(readerPackage.toc[0].label).toBe('Chapter One');
    expect(readerPackage.chapters[0].chapterId).toMatch(/^chapter-1-/);
    expect(readerPackage.chapters[0].blocks[0]).toMatchObject({
      kind: 'heading',
      text: 'Chapter One',
    });
    expect(readerPackage.chapters[0].blocks[1]).toMatchObject({
      kind: 'paragraph',
      text: 'Hello brave reader.',
    });
    expect(readerPackage.chapters[0].blocks[2]).toMatchObject({
      kind: 'image',
    });
    expect(
      (readerPackage.chapters[0].blocks[2] as { src: string }).src,
    ).toMatch(/^data:image\/png;base64,/);
    expect(readerPackage.chapters[1].blocks[1]).toMatchObject({
      kind: 'list',
      text: 'First\nSecond',
    });
  });

  it('throws on malformed EPUB archives', async () => {
    await expect(
      buildReaderPackageFromEpub({
        author: null,
        buffer: Buffer.from('not-an-epub'),
        checksum: 'bad',
        language: null,
        title: 'Broken',
      }),
    ).rejects.toBeInstanceOf(Error);
  });
});

async function createReaderEpubBuffer() {
  const zip = new JSZip();

  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );

  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0">
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chapter-1" href="text/chapter-1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter-2" href="text/chapter-2.xhtml" media-type="application/xhtml+xml"/>
    <item id="art" href="images/scene.png" media-type="image/png"/>
  </manifest>
  <spine>
    <itemref idref="chapter-1"/>
    <itemref idref="chapter-2"/>
  </spine>
</package>`,
  );

  zip.file(
    'OEBPS/nav.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <body>
    <nav epub:type="toc">
      <ol>
        <li><a href="text/chapter-1.xhtml">Chapter One</a></li>
        <li><a href="text/chapter-2.xhtml">Chapter Two</a></li>
      </ol>
    </nav>
  </body>
</html>`,
  );

  zip.file(
    'OEBPS/text/chapter-1.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h1>Chapter One</h1>
    <p>Hello <strong>brave</strong> reader.</p>
    <img src="../images/scene.png" alt="Scene" />
  </body>
</html>`,
  );

  zip.file(
    'OEBPS/text/chapter-2.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h2>Chapter Two</h2>
    <ul>
      <li>First</li>
      <li>Second</li>
    </ul>
  </body>
</html>`,
  );

  zip.file('OEBPS/images/scene.png', Buffer.from('png-bits'));

  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
}
