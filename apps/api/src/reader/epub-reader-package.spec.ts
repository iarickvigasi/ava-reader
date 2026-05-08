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
    // chapter-1.xhtml is split at #part-one, so we get three chapters:
    //   1) Chapter One leading section, 2) Part One, 3) Chapter Two.
    expect(readerPackage.manifest.totalChapters).toBe(3);
    expect(readerPackage.toc).toHaveLength(2);
    const firstTocEntry = expectDefined(readerPackage.toc[0]);
    const firstNestedTocEntry = expectDefined(firstTocEntry.children[0]);
    const secondTocEntry = expectDefined(readerPackage.toc[1]);
    const secondNestedTocEntry = expectDefined(secondTocEntry.children[0]);

    expect(firstTocEntry.chapterId).toMatch(/^chapter-1-/);
    expect(firstTocEntry.id).toBe('toc:0');
    expect(firstTocEntry.label).toBe('Chapter One');
    expect(firstNestedTocEntry.anchorId).toBe('part-one');
    // The Part One segment is now its own chapter, so its anchor block is the
    // chapter's first block (b1).
    expect(firstNestedTocEntry.blockId).toContain('::b1');
    expect(firstNestedTocEntry.chapterId).toMatch(/^chapter-2-/);
    expect(firstNestedTocEntry.href).toBe('text/chapter-1.xhtml#part-one');
    expect(firstNestedTocEntry.id).toBe('toc:0.0');
    expect(firstNestedTocEntry.label).toBe('Part One');
    expect(secondTocEntry.chapterId).toBeNull();
    expect(secondTocEntry.href).toBeNull();
    expect(secondTocEntry.label).toBe('Part II');
    expect(secondNestedTocEntry.chapterId).toMatch(/^chapter-3-/);
    expect(secondNestedTocEntry.id).toBe('toc:1.0');
    expect(secondNestedTocEntry.label).toBe('Chapter Two');
    expect(readerPackage.chapters[0].chapterId).toMatch(/^chapter-1-/);
    expect(readerPackage.chapters[0].blocks).toHaveLength(1);
    expect(readerPackage.chapters[0].blocks[0]).toMatchObject({
      kind: 'heading',
      text: 'Chapter One',
    });
    expect(readerPackage.chapters[1].chapterId).toMatch(/^chapter-2-/);
    expect(readerPackage.chapters[1].href).toBe(
      'text/chapter-1.xhtml#part-one',
    );
    expect(readerPackage.chapters[1].blocks[0]).toMatchObject({
      anchorId: 'part-one',
      kind: 'heading',
      text: 'Part One',
    });
    expect(readerPackage.chapters[1].blocks[1]).toMatchObject({
      kind: 'paragraph',
      text: 'Hello brave reader.',
    });
    expect(readerPackage.chapters[1].blocks[2]).toMatchObject({
      kind: 'image',
    });
    const partOneImageBlock = expectDefined(
      readerPackage.chapters[1].blocks[2],
    );
    if (partOneImageBlock.kind !== 'image') {
      throw new Error('Expected the third block of Part One to be an image.');
    }
    expect(partOneImageBlock.src).toMatch(/^data:image\/png;base64,/);
    expect(readerPackage.chapters[2].chapterId).toMatch(/^chapter-3-/);
    expect(readerPackage.chapters[2].blocks[1]).toMatchObject({
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
    // chapter-1.xhtml is split at #part-one, so Part One becomes the second
    // chapter overall and Chapter Two becomes the third.
    expect(firstNestedTocEntry.chapterId).toMatch(/^chapter-2-/);
    expect(firstNestedTocEntry.id).toBe('toc:0.0');
    expect(firstNestedTocEntry.label).toBe('Part One');
    expect(secondTocEntry.chapterId).toMatch(/^chapter-3-/);
    expect(secondTocEntry.id).toBe('toc:1');
    expect(secondTocEntry.label).toBe('Chapter Two');
  });

  it('splits a single spine document into multiple chapters at TOC anchor boundaries', async () => {
    // Mirrors Project Gutenberg's "Pride and Prejudice" layout: a single
    // XHTML spine doc contains many logical chapters separated only by anchor
    // ids that the NCX TOC links to. Each anchor must produce its own
    // ReaderChapter so navigation, highlighting, and per-chapter pagination
    // work the same as for "one chapter per file" EPUBs.
    const epubBuffer = await createReaderEpubBufferWithMultiChapterSpine();

    const readerPackage = await buildReaderPackageFromEpub({
      authors: ['Jane Austen'],
      buffer: epubBuffer,
      checksum: 'source-checksum',
      language: 'en',
      title: 'Pride and Prejudice',
    });

    expect(readerPackage.chapters).toHaveLength(4);

    const [chapterFront, chapterOne, chapterTwo, chapterThree] =
      readerPackage.chapters;
    expect(chapterFront.href).toBe('text/spine-1.xhtml');
    expect(chapterFront.label).toBe('Front matter');
    expect(chapterFront.blocks[0]).toMatchObject({
      kind: 'heading',
      text: 'Pride and Prejudice',
    });

    expect(chapterOne.href).toBe('text/spine-1.xhtml#chapter-i');
    expect(chapterOne.label).toBe('Chapter I');
    expect(chapterOne.blocks[0]).toMatchObject({
      anchorId: 'chapter-i',
      kind: 'heading',
      text: 'CHAPTER I.',
    });
    expect(chapterOne.blocks[1]).toMatchObject({
      kind: 'paragraph',
      text: 'It is a truth universally acknowledged.',
    });
    expect(chapterOne.previousChapterId).toBe(chapterFront.chapterId);
    expect(chapterOne.nextChapterId).toBe(chapterTwo.chapterId);

    expect(chapterTwo.href).toBe('text/spine-1.xhtml#chapter-ii');
    expect(chapterTwo.label).toBe('Chapter II');
    expect(chapterTwo.blocks[0]).toMatchObject({
      anchorId: 'chapter-ii',
      kind: 'heading',
      text: 'CHAPTER II.',
    });

    // The second spine doc has no TOC anchors → stays as one chapter.
    expect(chapterThree.href).toBe('text/spine-2.xhtml');
    expect(chapterThree.label).toBe('Chapter III');
    expect(chapterThree.previousChapterId).toBe(chapterTwo.chapterId);
    expect(chapterThree.nextChapterId).toBeNull();

    // TOC entries must point at the right per-chapter ids so the active
    // chapter highlighting can distinguish between the three logical chapters
    // that share spine-1.xhtml.
    const tocByLabel = new Map(
      readerPackage.toc.map((node) => [node.label, node]),
    );
    expect(tocByLabel.get('Chapter I')?.chapterId).toBe(chapterOne.chapterId);
    expect(tocByLabel.get('Chapter I')?.blockId).toBe(chapterOne.blocks[0].id);
    expect(tocByLabel.get('Chapter II')?.chapterId).toBe(chapterTwo.chapterId);
    expect(tocByLabel.get('Chapter II')?.blockId).toBe(chapterTwo.blocks[0].id);
    expect(tocByLabel.get('Chapter III')?.chapterId).toBe(
      chapterThree.chapterId,
    );

    // Block numbering restarts per chapter — each chapter's first block is
    // ::b1 regardless of where its segment started in the source spine doc.
    expect(chapterOne.blocks[0].id.endsWith('::b1')).toBe(true);
    expect(chapterTwo.blocks[0].id.endsWith('::b1')).toBe(true);
  });

  it('propagates a wrapping div anchor to its first child block', async () => {
    // Some EPUBs only set the chapter anchor id on a wrapping <div> rather
    // than on the heading itself. The splitter only sees anchors on block
    // elements, so the normalizer must hand the container's id down to the
    // first child block.
    const epubBuffer = await createReaderEpubBufferWithDivAnchor();

    const readerPackage = await buildReaderPackageFromEpub({
      authors: ['Author'],
      buffer: epubBuffer,
      checksum: 'source-checksum',
      language: 'en',
      title: 'Title',
    });

    expect(readerPackage.chapters).toHaveLength(2);
    const [front, chapterOne] = readerPackage.chapters;
    expect(front.href).toBe('text/spine.xhtml');
    expect(chapterOne.href).toBe('text/spine.xhtml#chap-1');
    expect(chapterOne.blocks[0]).toMatchObject({
      anchorId: 'chap-1',
      kind: 'heading',
      text: 'Chapter One',
    });
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

  it('falls back to one toc entry per chapter when the parsed toc is degenerate', async () => {
    const epubBuffer = await createReaderEpubBufferWithDegenerateToc();

    const readerPackage = await buildReaderPackageFromEpub({
      authors: ['Hermann Hesse'],
      buffer: epubBuffer,
      checksum: 'source-checksum',
      language: 'de',
      title: 'Demian',
    });

    expect(readerPackage.chapters).toHaveLength(3);
    expect(readerPackage.toc).toHaveLength(3);
    expect(readerPackage.toc[0]).toMatchObject({
      chapterId: readerPackage.chapters[0]?.chapterId,
      label: 'Erstes Kapitel',
    });
    expect(readerPackage.toc[1]).toMatchObject({
      chapterId: readerPackage.chapters[1]?.chapterId,
      label: 'Zweites Kapitel',
    });
    expect(readerPackage.toc[2]).toMatchObject({
      chapterId: readerPackage.chapters[2]?.chapterId,
      label: 'Drittes Kapitel',
    });
  });

  it('uses generic chapter labels when the parsed toc is sparse and chapter title extraction is unreliable', async () => {
    const epubBuffer = await createReaderEpubBufferWithPartialNcx();

    const readerPackage = await buildReaderPackageFromEpub({
      authors: ['Герман Гессе'],
      buffer: epubBuffer,
      checksum: 'source-checksum',
      language: 'uk',
      title: 'Степовий вовк',
    });

    expect(readerPackage.chapters).toHaveLength(5);
    expect(readerPackage.toc).toHaveLength(5);
    // Sparse NCX (2 entries vs 5 spine docs) is untrusted for labels. Title
    // extraction succeeds for only 1 of 5 chapters (the one with a short
    // first dialogue line), well below the 80% threshold, so we fall
    // through to uniform "Chapter N" labels for the whole book — avoiding
    // the noisy mix where one chapter is labeled with a stray dialogue line.
    expect(readerPackage.toc.map((node) => node.label)).toEqual([
      'Chapter 1',
      'Chapter 2',
      'Chapter 3',
      'Chapter 4',
      'Chapter 5',
    ]);
    expect(readerPackage.toc[0]).toMatchObject({
      chapterId: readerPackage.chapters[0]?.chapterId,
    });
    expect(readerPackage.toc[4]).toMatchObject({
      chapterId: readerPackage.chapters[4]?.chapterId,
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

  it('resolves NAV hrefs relative to the NAV document location', async () => {
    const epubBuffer = await createReaderEpubBufferWithSubdirectoryNav();

    const readerPackage = await buildReaderPackageFromEpub({
      authors: ['Example Author'],
      buffer: epubBuffer,
      checksum: 'source-checksum',
      language: 'en',
      title: 'Example Title',
    });

    expect(readerPackage.toc).toHaveLength(2);
    const firstTocEntry = expectDefined(readerPackage.toc[0]);
    const secondTocEntry = expectDefined(readerPackage.toc[1]);

    expect(firstTocEntry.chapterId).toMatch(/^chapter-1-/);
    expect(firstTocEntry.label).toBe('Chapter One');
    expect(firstTocEntry.href).toBe('text/chapter-1.xhtml');
    expect(secondTocEntry.chapterId).toMatch(/^chapter-2-/);
    expect(secondTocEntry.label).toBe('Chapter Two');
    expect(secondTocEntry.href).toBe('text/chapter-2.xhtml');
  });

  it('reads stylesheet classes for align, font-size, and text-indent', async () => {
    // Mirrors the user's Dune sample: a stylesheet (linked via <head>)
    // defines class-based styles that must be picked up because the
    // chapter HTML uses class names exclusively (no inline style="").
    const epubBuffer = await createReaderEpubBufferWithLinkedStylesheet();

    const readerPackage = await buildReaderPackageFromEpub({
      authors: ['Frank Herbert'],
      buffer: epubBuffer,
      checksum: 'source-checksum',
      language: 'en',
      title: 'Dune-ish',
    });

    const chapter = expectDefined(readerPackage.chapters[0]);

    // Block 0: epigraph paragraph (.nonindent) → indent disabled.
    expect(chapter.blocks[0]).toMatchObject({
      kind: 'paragraph',
      textIndent: 0,
    });
    expect(chapter.blocks[0]).not.toHaveProperty('align');

    // Block 1: epigraph attribution (.center01) → centered + smaller.
    expect(chapter.blocks[1]).toMatchObject({
      kind: 'paragraph',
      align: 'center',
      fontSizeScale: 0.85,
    });

    // Block 2: first body paragraph (.nonindent again).
    expect(chapter.blocks[2]).toMatchObject({
      kind: 'paragraph',
      textIndent: 0,
    });

    // Block 3: subsequent body paragraph (.indent) → 1em indent.
    expect(chapter.blocks[3]).toMatchObject({
      kind: 'paragraph',
      textIndent: 1,
    });

    // Block 4: another .indent paragraph — same hint.
    expect(chapter.blocks[4]).toMatchObject({
      kind: 'paragraph',
      textIndent: 1,
    });

    // Block 5: .semibold class → block-level font-weight: 600.
    expect(chapter.blocks[5]).toMatchObject({
      kind: 'paragraph',
      fontWeight: 600,
    });

    // Block 6: paragraph with an inline <span style="font-weight:500">
    // — block has no fontWeight, but the inline carries one.
    const block6 = chapter.blocks[6];
    expect(block6.kind).toBe('paragraph');
    if (block6.kind !== 'paragraph') {
      throw new Error('Expected paragraph');
    }
    expect(block6).not.toHaveProperty('fontWeight');
    const emphasized = block6.inlines.find(
      (inline) =>
        inline.kind === 'text' && inline.text.includes('medium-weight'),
    );
    expect(emphasized).toMatchObject({
      kind: 'text',
      fontWeight: 500,
    });
  });

  it('survives a missing or unreadable stylesheet', async () => {
    // The chapter <link>s a stylesheet that doesn't exist in the zip.
    // Loading it must not break chapter parsing — blocks just come
    // through without any class-derived hints.
    const epubBuffer = await createReaderEpubBufferWithMissingStylesheet();

    const readerPackage = await buildReaderPackageFromEpub({
      authors: ['Author'],
      buffer: epubBuffer,
      checksum: 'source-checksum',
      language: 'en',
      title: 'Title',
    });

    const chapter = expectDefined(readerPackage.chapters[0]);
    expect(chapter.blocks).toHaveLength(1);
    expect(chapter.blocks[0]).toMatchObject({
      kind: 'paragraph',
      text: 'Hello world.',
    });
    // No hints because the stylesheet didn't load.
    expect(chapter.blocks[0]).not.toHaveProperty('textIndent');
    expect(chapter.blocks[0]).not.toHaveProperty('align');
    expect(chapter.blocks[0]).not.toHaveProperty('fontSizeScale');
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

async function createReaderEpubBufferWithPartialNcx() {
  const zip = new JSZip();

  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );

  zip.file(
    'content.opf',
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="BookId">
  <manifest>
    <item id="ncx" href="book.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="cover" href="Cover.html" media-type="application/xhtml+xml"/>
    <item id="ch1" href="Chapter001_1.html" media-type="application/xhtml+xml"/>
    <item id="ch2" href="Chapter001_2.html" media-type="application/xhtml+xml"/>
    <item id="ch3" href="Chapter001_3.html" media-type="application/xhtml+xml"/>
    <item id="ch4" href="Chapter001_4.html" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="cover"/>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
    <itemref idref="ch3"/>
    <itemref idref="ch4"/>
  </spine>
</package>`,
  );

  zip.file(
    'book.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <navMap>
    <navPoint id="np-1" playOrder="1">
      <navLabel><text>Обкладинка</text></navLabel>
      <content src="Cover.html"/>
    </navPoint>
    <navPoint id="np-2" playOrder="2">
      <navLabel><text>Текст твору</text></navLabel>
      <content src="Chapter001_1.html"/>
    </navPoint>
  </navMap>
</ncx>`,
  );

  // Real ukrlib EPUBs lack proper <h1>-<h6> chapter titles. Most chapters
  // open with a long body paragraph (no extractable title), but one happens
  // to begin with a short line of dialogue that the paragraph fallback would
  // mistake for a title — the case that makes us treat extraction as
  // unreliable for the whole book.
  const longBodyParagraph =
    'Коли я повертався додому, я ще не знав, як скінчиться ця історія, і скільки ' +
    'дивних думок вона залишить мені на пам’ять про той вечір.';
  zip.file(
    'Cover.html',
    `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body><p>${longBodyParagraph}</p></body>
</html>`,
  );

  zip.file(
    'Chapter001_1.html',
    `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body><p>${longBodyParagraph}</p></body>
</html>`,
  );

  zip.file(
    'Chapter001_2.html',
    `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body><p>${longBodyParagraph}</p></body>
</html>`,
  );

  zip.file(
    'Chapter001_3.html',
    `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body><p>— Колись пізніше покажу.</p><p>${longBodyParagraph}</p></body>
</html>`,
  );

  zip.file(
    'Chapter001_4.html',
    `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body><p>${longBodyParagraph}</p></body>
</html>`,
  );

  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
}

async function createReaderEpubBufferWithDegenerateToc() {
  const zip = new JSZip();

  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );

  zip.file(
    'content.opf',
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="uuid_id">
  <manifest>
    <item id="titlepage" href="titlepage.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter-1" href="index_split_001.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter-2" href="index_split_002.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter-3" href="index_split_003.xhtml" media-type="application/xhtml+xml"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="titlepage"/>
    <itemref idref="chapter-1"/>
    <itemref idref="chapter-2"/>
    <itemref idref="chapter-3"/>
  </spine>
</package>`,
  );

  zip.file(
    'toc.ncx',
    `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <navMap>
    <navPoint id="start" playOrder="1">
      <navLabel><text>Start</text></navLabel>
      <content src="titlepage.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`,
  );

  zip.file(
    'titlepage.xhtml',
    `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body></body>
</html>`,
  );

  zip.file(
    'index_split_001.xhtml',
    `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body><h1>Erstes Kapitel</h1><p>Erste Zeile.</p></body>
</html>`,
  );

  zip.file(
    'index_split_002.xhtml',
    `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body><h1>Zweites Kapitel</h1><p>Zweite Zeile.</p></body>
</html>`,
  );

  zip.file(
    'index_split_003.xhtml',
    `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body><h1>Drittes Kapitel</h1><p>Dritte Zeile.</p></body>
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

async function createReaderEpubBufferWithSubdirectoryNav() {
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
    <item id="nav" href="text/nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chapter-1" href="text/chapter-1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter-2" href="text/chapter-2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter-1"/>
    <itemref idref="chapter-2"/>
  </spine>
</package>`,
  );

  zip.file(
    'OEBPS/text/nav.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <body>
    <nav epub:type="toc">
      <ol>
        <li><a href="chapter-1.xhtml">Chapter One</a></li>
        <li><a href="chapter-2.xhtml">Chapter Two</a></li>
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

async function createReaderEpubBufferWithLinkedStylesheet() {
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
    <item id="css" href="css/style.css" media-type="text/css"/>
  </manifest>
  <spine>
    <itemref idref="chapter-1"/>
  </spine>
</package>`,
  );

  zip.file(
    'OEBPS/css/style.css',
    `
    .indent { text-indent: 1em; }
    .nonindent { text-indent: 0; }
    .center01 { text-align: center; font-size: 0.85em; }
    .semibold { font-weight: 600; }
    `,
  );

  zip.file(
    'OEBPS/text/chapter-1.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <link rel="stylesheet" type="text/css" href="../css/style.css" />
  </head>
  <body>
    <div class="block">
      <p class="nonindent">With the Lady Jessica and Arrakis.</p>
      <p class="center01">FROM ANALYSIS<br/>BY THE PRINCESS IRULAN</p>
    </div>
    <p class="nonindent">All around the Lady Jessica stood the packaged freight.</p>
    <p class="indent">Jessica stood in the center of the hall.</p>
    <p class="indent">Some architect had reached far back into history.</p>
    <p class="semibold">A semibold note from the publisher.</p>
    <p>Mid-sentence <span style="font-weight: 500">medium-weight</span> emphasis.</p>
  </body>
</html>`,
  );

  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
}

async function createReaderEpubBufferWithMissingStylesheet() {
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
  </manifest>
  <spine>
    <itemref idref="chapter-1"/>
  </spine>
</package>`,
  );

  zip.file(
    'OEBPS/text/chapter-1.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <link rel="stylesheet" type="text/css" href="../css/missing.css" />
  </head>
  <body>
    <p class="indent">Hello world.</p>
  </body>
</html>`,
  );

  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
}

async function createReaderEpubBufferWithMultiChapterSpine() {
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
    <item id="spine-1" href="text/spine-1.xhtml" media-type="application/xhtml+xml"/>
    <item id="spine-2" href="text/spine-2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="spine-1"/>
    <itemref idref="spine-2"/>
  </spine>
</package>`,
  );

  zip.file(
    'OEBPS/toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx version="2005-1">
  <navMap>
    <navPoint id="np-front" playOrder="1">
      <navLabel><text>Front matter</text></navLabel>
      <content src="text/spine-1.xhtml"/>
    </navPoint>
    <navPoint id="np-1" playOrder="2">
      <navLabel><text>Chapter I</text></navLabel>
      <content src="text/spine-1.xhtml#chapter-i"/>
    </navPoint>
    <navPoint id="np-2" playOrder="3">
      <navLabel><text>Chapter II</text></navLabel>
      <content src="text/spine-1.xhtml#chapter-ii"/>
    </navPoint>
    <navPoint id="np-3" playOrder="4">
      <navLabel><text>Chapter III</text></navLabel>
      <content src="text/spine-2.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`,
  );

  zip.file(
    'OEBPS/text/spine-1.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h1>Pride and Prejudice</h1>
    <p>By Jane Austen.</p>
    <h2 id="chapter-i">CHAPTER I.</h2>
    <p>It is a truth universally acknowledged.</p>
    <p>However little known the feelings.</p>
    <h2 id="chapter-ii">CHAPTER II.</h2>
    <p>Mr. Bennet was among the earliest.</p>
  </body>
</html>`,
  );

  zip.file(
    'OEBPS/text/spine-2.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h2>Chapter III</h2>
    <p>Not all that Mrs. Bennet could do.</p>
  </body>
</html>`,
  );

  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
}

async function createReaderEpubBufferWithDivAnchor() {
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
    <item id="spine" href="text/spine.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="spine"/>
  </spine>
</package>`,
  );

  zip.file(
    'OEBPS/toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx version="2005-1">
  <navMap>
    <navPoint id="np-front" playOrder="1">
      <navLabel><text>Front matter</text></navLabel>
      <content src="text/spine.xhtml"/>
    </navPoint>
    <navPoint id="np-1" playOrder="2">
      <navLabel><text>Chapter One</text></navLabel>
      <content src="text/spine.xhtml#chap-1"/>
    </navPoint>
  </navMap>
</ncx>`,
  );

  zip.file(
    'OEBPS/text/spine.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h1>The Book</h1>
    <p>Front matter.</p>
    <div id="chap-1" class="chapter">
      <h2>Chapter One</h2>
      <p>The chapter begins here.</p>
    </div>
  </body>
</html>`,
  );

  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
}

function expectDefined<T>(value: T | undefined): T {
  expect(value).toBeDefined();

  if (value === undefined) {
    throw new Error('Expected value to be defined.');
  }

  return value;
}
