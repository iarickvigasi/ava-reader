import JSZip from 'jszip';
import { buildReaderPackageFromEpub } from './epub-reader-package';

describe('buildReaderPackageFromEpub', () => {
  it('builds a nested reader toc from an EPUB nav document and resolves subsection anchors', async () => {
    const epubBuffer = await createReaderEpubBuffer();

    const readerPackage = await buildReaderPackageFromEpub({
      authors: ['Example Author'],
      buffer: epubBuffer,
      checksum: 'source-checksum',
      language: 'en',
      title: 'Example Title',
    });

    expect(readerPackage.version).toBe(2);
    expect(readerPackage.manifest.authors).toEqual(['Example Author']);
    expect(readerPackage.manifest.totalChapters).toBe(2);
    expect(readerPackage.toc).toHaveLength(2);
    const firstTocEntry = expectDefined(readerPackage.toc[0]);
    const firstNestedTocEntry = expectDefined(firstTocEntry.children[0]);
    const secondTocEntry = expectDefined(readerPackage.toc[1]);
    const secondNestedTocEntry = expectDefined(secondTocEntry.children[0]);

    expect(firstTocEntry.chapterId).toMatch(/^chapter-1-/);
    expect(firstTocEntry.id).toBe('toc:0');
    expect(firstTocEntry.label).toBe('Chapter One');
    expect(firstNestedTocEntry.anchorId).toBe('part-one');
    expect(firstNestedTocEntry.blockId).toContain('::b2');
    expect(firstNestedTocEntry.chapterId).toMatch(/^chapter-1-/);
    expect(firstNestedTocEntry.href).toBe('text/chapter-1.xhtml#part-one');
    expect(firstNestedTocEntry.id).toBe('toc:0.0');
    expect(firstNestedTocEntry.label).toBe('Part One');
    expect(secondTocEntry.chapterId).toBeNull();
    expect(secondTocEntry.href).toBeNull();
    expect(secondTocEntry.label).toBe('Part II');
    expect(secondNestedTocEntry.chapterId).toMatch(/^chapter-2-/);
    expect(secondNestedTocEntry.id).toBe('toc:1.0');
    expect(secondNestedTocEntry.label).toBe('Chapter Two');
    expect(readerPackage.chapters[0].chapterId).toMatch(/^chapter-1-/);
    expect(readerPackage.chapters[0].blocks[0]).toMatchObject({
      kind: 'heading',
      text: 'Chapter One',
    });
    expect(readerPackage.chapters[0].blocks[1]).toMatchObject({
      anchorId: 'part-one',
      kind: 'heading',
      text: 'Part One',
    });
    expect(readerPackage.chapters[0].blocks[2]).toMatchObject({
      kind: 'paragraph',
      text: 'Hello brave reader.',
    });
    expect(readerPackage.chapters[0].blocks[3]).toMatchObject({
      kind: 'image',
    });
    const fourthBlock = expectDefined(readerPackage.chapters[0].blocks[3]);
    if (fourthBlock.kind !== 'image') {
      throw new Error('Expected the fourth block to be an image.');
    }
    expect(fourthBlock.src).toMatch(/^data:image\/png;base64,/);
    expect(readerPackage.chapters[1].blocks[1]).toMatchObject({
      kind: 'list',
      text: 'First\nSecond',
    });
  });

  it('preserves nested toc structure from NCX files when no nav document exists', async () => {
    const epubBuffer = await createReaderEpubBufferWithNcx();

    const readerPackage = await buildReaderPackageFromEpub({
      authors: ['Example Author'],
      buffer: epubBuffer,
      checksum: 'source-checksum',
      language: 'en',
      title: 'Example Title',
    });

    const firstTocEntry = expectDefined(readerPackage.toc[0]);
    const firstNestedTocEntry = expectDefined(firstTocEntry.children[0]);
    const secondTocEntry = expectDefined(readerPackage.toc[1]);

    expect(firstTocEntry.chapterId).toMatch(/^chapter-1-/);
    expect(firstTocEntry.id).toBe('toc:0');
    expect(firstTocEntry.label).toBe('Chapter One');
    expect(firstNestedTocEntry.chapterId).toMatch(/^chapter-1-/);
    expect(firstNestedTocEntry.id).toBe('toc:0.0');
    expect(firstNestedTocEntry.label).toBe('Part One');
    expect(secondTocEntry.chapterId).toMatch(/^chapter-2-/);
    expect(secondTocEntry.id).toBe('toc:1');
    expect(secondTocEntry.label).toBe('Chapter Two');
  });

  it('falls back to toc order when the epub has no readable spine', async () => {
    const epubBuffer = await createReaderEpubBufferWithoutSpine();

    const readerPackage = await buildReaderPackageFromEpub({
      authors: ['Example Author'],
      buffer: epubBuffer,
      checksum: 'source-checksum',
      language: 'en',
      title: 'Example Title',
    });

    expect(readerPackage.chapters).toHaveLength(2);
    expect(readerPackage.chapters[0]?.href).toBe('text/chapter-2.xhtml');
    expect(readerPackage.chapters[1]?.href).toBe('text/chapter-1.xhtml');
    expect(readerPackage.toc[0]).toMatchObject({
      chapterId: readerPackage.chapters[0]?.chapterId,
      label: 'Chapter Two',
    });
    expect(readerPackage.toc[1]).toMatchObject({
      chapterId: readerPackage.chapters[1]?.chapterId,
      label: 'Chapter One',
    });
  });

  it('falls back to readable manifest documents when both spine and toc are missing', async () => {
    const epubBuffer = await createReaderEpubBufferWithoutSpineOrToc();

    const readerPackage = await buildReaderPackageFromEpub({
      authors: ['Example Author'],
      buffer: epubBuffer,
      checksum: 'source-checksum',
      language: 'en',
      title: 'Example Title',
    });

    expect(readerPackage.chapters).toHaveLength(2);
    expect(readerPackage.chapters[0]).toMatchObject({
      href: 'text/chapter-1.xhtml',
      label: 'Chapter One',
    });
    expect(readerPackage.chapters[1]).toMatchObject({
      href: 'text/chapter-2.xhtml',
      label: 'Chapter Two',
    });
  });

  it('uses numbered chapter labels when epub labels only repeat the book title', async () => {
    const epubBuffer =
      await createReaderEpubBufferWithBookTitleAsChapterLabel();

    const readerPackage = await buildReaderPackageFromEpub({
      authors: ['Example Author'],
      buffer: epubBuffer,
      checksum: 'source-checksum',
      language: 'en',
      title: 'Example Title',
    });

    expect(readerPackage.chapters).toHaveLength(2);
    expect(readerPackage.chapters[0]).toMatchObject({
      label: 'Chapter 1',
      title: 'Example Title',
    });
    expect(readerPackage.chapters[1]).toMatchObject({
      label: 'Chapter 2',
      title: 'Example Title',
    });
    expect(readerPackage.toc[0]).toMatchObject({
      label: 'Chapter 1',
    });
    expect(readerPackage.toc[1]).toMatchObject({
      label: 'Chapter 2',
    });
  });

  it('throws on malformed EPUB archives', async () => {
    await expect(
      buildReaderPackageFromEpub({
        authors: [],
        buffer: Buffer.from('not-an-epub'),
        checksum: 'bad',
        language: null,
        title: 'Broken',
      }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('promotes images inside paragraph wrappers to block-level images', async () => {
    const epubBuffer = await createReaderEpubBufferWithWrappedImage();

    const readerPackage = await buildReaderPackageFromEpub({
      authors: ['Example Author'],
      buffer: epubBuffer,
      checksum: 'source-checksum',
      language: 'en',
      title: 'Example Title',
    });

    expect(readerPackage.chapters).toHaveLength(1);
    const chapter = expectDefined(readerPackage.chapters[0]);
    expect(chapter.blocks).toHaveLength(1);
    expect(chapter.blocks[0]).toMatchObject({
      kind: 'image',
      alt: 'cover',
    });
    const imageBlock = expectDefined(chapter.blocks[0]);
    if (imageBlock.kind !== 'image') {
      throw new Error('Expected the block to be an image.');
    }
    expect(imageBlock.src).toMatch(/^data:image\/png;base64,/);
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
        <li>
          <a href="text/chapter-1.xhtml">Chapter One</a>
          <ol>
            <li><a href="text/chapter-1.xhtml#part-one">Part One</a></li>
          </ol>
        </li>
        <li>
          <span>Part II</span>
          <ol>
            <li><a href="text/chapter-2.xhtml">Chapter Two</a></li>
          </ol>
        </li>
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
    <h2 id="part-one">Part One</h2>
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

async function createReaderEpubBufferWithNcx() {
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
<package xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0">
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="chapter-1" href="text/chapter-1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter-2" href="text/chapter-2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="chapter-1"/>
    <itemref idref="chapter-2"/>
  </spine>
</package>`,
  );

  zip.file(
    'OEBPS/toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx version="2005-1">
  <navMap>
    <navPoint id="nav-1" playOrder="1">
      <navLabel><text>Chapter One</text></navLabel>
      <content src="text/chapter-1.xhtml"/>
      <navPoint id="nav-1-1" playOrder="2">
        <navLabel><text>Part One</text></navLabel>
        <content src="text/chapter-1.xhtml#part-one"/>
      </navPoint>
    </navPoint>
    <navPoint id="nav-2" playOrder="3">
      <navLabel><text>Chapter Two</text></navLabel>
      <content src="text/chapter-2.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`,
  );

  zip.file(
    'OEBPS/text/chapter-1.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h1>Chapter One</h1>
    <h2 id="part-one">Part One</h2>
    <p>Hello brave reader.</p>
  </body>
</html>`,
  );

  zip.file(
    'OEBPS/text/chapter-2.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h2>Chapter Two</h2>
    <p>Second chapter.</p>
  </body>
</html>`,
  );

  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
}

async function createReaderEpubBufferWithoutSpine() {
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
  </manifest>
</package>`,
  );

  zip.file(
    'OEBPS/nav.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <body>
    <nav epub:type="toc">
      <ol>
        <li><a href="text/chapter-2.xhtml">Chapter Two</a></li>
        <li><a href="text/chapter-1.xhtml">Chapter One</a></li>
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
    <p>First chapter.</p>
  </body>
</html>`,
  );

  zip.file(
    'OEBPS/text/chapter-2.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h1>Chapter Two</h1>
    <p>Second chapter.</p>
  </body>
</html>`,
  );

  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
}

async function createReaderEpubBufferWithoutSpineOrToc() {
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
    <item href="text/chapter-1.xhtml"/>
    <item href="text/chapter-2.xhtml"/>
    <item id="cover" href="images/cover.png" media-type="image/png"/>
  </manifest>
</package>`,
  );

  zip.file(
    'OEBPS/text/chapter-1.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h1>Chapter One</h1>
    <p>First chapter.</p>
  </body>
</html>`,
  );

  zip.file(
    'OEBPS/text/chapter-2.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h1>Chapter Two</h1>
    <p>Second chapter.</p>
  </body>
</html>`,
  );

  zip.file('OEBPS/images/cover.png', Buffer.from('png-bits'));

  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
}

async function createReaderEpubBufferWithBookTitleAsChapterLabel() {
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
    <item id="chapter-1" href="text/chapter-1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter-2" href="text/chapter-2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
</package>`,
  );

  zip.file(
    'OEBPS/text/chapter-1.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h1>Example Title</h1>
    <p>First chapter.</p>
  </body>
</html>`,
  );

  zip.file(
    'OEBPS/text/chapter-2.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h1>Example Title</h1>
    <p>Second chapter.</p>
  </body>
</html>`,
  );

  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
}

async function createReaderEpubBufferWithWrappedImage() {
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
<package xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0">
  <manifest>
    <item id="cover" href="text/cover.xhtml" media-type="application/xhtml+xml"/>
    <item id="cover-image" href="images/cover.png" media-type="image/png"/>
  </manifest>
  <spine>
    <itemref idref="cover"/>
  </spine>
  <guide>
    <reference href="text/cover.xhtml" title="Cover" type="cover"/>
  </guide>
</package>`,
  );

  zip.file(
    'OEBPS/text/cover.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
  <head>
    <title>Cover</title>
    <style type="text/css">@page{margin:0em;}</style>
  </head>
  <body style="vertical-align: middle; margin-top:0em; margin-bottom:0em;">
    <p class="cover"><img alt="cover" src="../images/cover.png"/></p>
  </body>
</html>`,
  );

  zip.file('OEBPS/images/cover.png', Buffer.from('png-bits'));

  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
}

function expectDefined<T>(value: T | undefined): T {
  expect(value).toBeDefined();

  if (value === undefined) {
    throw new Error('Expected value to be defined.');
  }

  return value;
}
