import JSZip from 'jszip';
import { buildReaderPackageFromEpub } from './epub-reader-package';

describe('EPUB entity decoding during import', () => {
  it.each(['&nbsp;', '&#160;', '&#xA0;'])(
    'normalizes %s in headings, their inlines, and chapter labels',
    async (space) => {
      const readerPackage = await importEpub(
        `<h1>1${space}Ist Lieben eine Kunst?</h1><p>Chapter content.</p>`,
      );

      const chapter = readerPackage.chapters[0];
      const title = '1 Ist Lieben eine Kunst?';
      expect(chapter).toMatchObject({ label: title, title });
      expect(chapter.blocks[0]).toMatchObject({
        kind: 'heading',
        text: title,
        inlines: [{ kind: 'text', text: title }],
      });
      expect(readerPackage.toc[0].label).toBe(title);
    },
  );

  it('decodes named entities in nested paragraph inlines, lists, and image descriptions', async () => {
    // Image paths resolve against the in-memory EPUB ZIP.
    //noinspection HtmlUnknownTarget
    const readerPackage = await importEpub(`
      <h1>Chapter One</h1>
      <p>&ldquo;Die <strong>Kunst&nbsp;<em>des Liebens</em></strong>&rdquo;&nbsp;&mdash; caf&eacute; &amp; tea.</p>
      <ul><li>First&nbsp;<strong>item</strong></li><li>Second &ldquo;item&rdquo;&hellip;</li></ul>
      <img src="cover.png" alt="&ldquo;Caf&eacute;&rdquo; &amp; tea"/>
      <p>Look <img src="cover.png" alt="&copy; Caf&eacute;"/> here.</p>
    `);

    const blocks = readerPackage.chapters[0].blocks;
    expect(blocks[1]).toMatchObject({
      kind: 'paragraph',
      text: '“Die Kunst des Liebens” — café & tea.',
      inlines: [
        { kind: 'text', text: '“Die ' },
        { kind: 'text', text: 'Kunst ', bold: true },
        { kind: 'text', text: 'des Liebens', bold: true, italic: true },
        { kind: 'text', text: '” — café & tea.' },
      ],
    });
    expect(blocks[2]).toMatchObject({
      kind: 'list',
      text: 'First item\nSecond “item”…',
      items: [
        {
          text: 'First item',
          inlines: [
            { kind: 'text', text: 'First ' },
            { kind: 'text', text: 'item', bold: true },
          ],
        },
        {
          text: 'Second “item”…',
          inlines: [{ kind: 'text', text: 'Second “item”…' }],
        },
      ],
    });
    expect(blocks[3]).toMatchObject({
      kind: 'image',
      alt: '“Café” & tea',
      text: '“Café” & tea',
    });
    expect(blocks[4]).toMatchObject({
      kind: 'paragraph',
      inlines: [
        { kind: 'text', text: 'Look ' },
        { kind: 'image', alt: '© Café' },
        { kind: 'text', text: ' here.' },
      ],
    });
  });

  it.each(['nav', 'ncx'] as const)(
    'decodes %s labels once and preserves intentionally escaped entity text',
    async (format) => {
      const readerPackage = await importEpub('<h1>Chapter One</h1>', {
        format,
        label: '&ldquo;Caf&eacute;&rdquo; &mdash; &amp;nbsp;',
      });

      const label = '“Café” — &nbsp;';
      expect(readerPackage.toc[0].label).toBe(label);
      expect(readerPackage.chapters[0].label).toBe(label);
    },
  );

  it('preserves escaped references, unknown entities, and encoded markup as literal text', async () => {
    // The unknown entity is deliberate input; images live in the EPUB ZIP.
    //noinspection HtmlUnknownTarget,CheckDtdRefs
    const readerPackage = await importEpub(`
      <h1>Literal &amp;nbsp; &amp;#160;</h1>
      <p>&lt;strong&gt;literal&lt;/strong&gt; &amp;nbsp; &amp;#xA0; &unknownEntity;</p>
      <ul><li>&amp;ldquo; &lt;em&gt;text&lt;/em&gt;</li></ul>
      <img src="cover.png" alt="&amp;nbsp; &lt;cover&gt;"/>
    `);

    const chapter = readerPackage.chapters[0];
    expect(chapter.title).toBe('Literal &nbsp; &#160;');
    expect(chapter.blocks).toHaveLength(4);
    expect(chapter.blocks[0]).toMatchObject({
      kind: 'heading',
      text: 'Literal &nbsp; &#160;',
      inlines: [{ kind: 'text', text: 'Literal &nbsp; &#160;' }],
    });
    // Expected reader text includes the deliberately unresolved entity.
    //noinspection CheckDtdRefs
    expect(chapter.blocks[1]).toMatchObject({
      kind: 'paragraph',
      text: '<strong>literal</strong> &nbsp; &#xA0; &unknownEntity;',
      inlines: [
        {
          kind: 'text',
          text: '<strong>literal</strong> &nbsp; &#xA0; &unknownEntity;',
        },
      ],
    });
    expect(chapter.blocks[2]).toMatchObject({
      kind: 'list',
      items: [
        {
          text: '&ldquo; <em>text</em>',
          inlines: [{ kind: 'text', text: '&ldquo; <em>text</em>' }],
        },
      ],
    });
    expect(chapter.blocks[3]).toMatchObject({
      kind: 'image',
      alt: '&nbsp; <cover>',
      text: '&nbsp; <cover>',
    });
  });
});

async function importEpub(
  body: string,
  navigation?: { format: 'nav' | 'ncx'; label: string },
) {
  const zip = new JSZip();
  zip.file(
    'META-INF/container.xml',
    `<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
      <rootfiles><rootfile full-path="content.opf"/></rootfiles>
    </container>`,
  );

  const navigationItem = navigation
    ? navigation.format === 'nav'
      ? '<item id="toc" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>'
      : '<item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>'
    : '';
  zip.file(
    'content.opf',
    `<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
      <manifest>
        <item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/>
        <item id="cover" href="cover.png" media-type="image/png"/>
        ${navigationItem}
      </manifest>
      <spine toc="toc"><itemref idref="chapter"/></spine>
    </package>`,
  );
  zip.file(
    'chapter.xhtml',
    `<html xmlns="http://www.w3.org/1999/xhtml" lang="de" xml:lang="de"><body>${body}</body></html>`,
  );
  zip.file('cover.png', Buffer.from('image-bytes'));

  if (navigation?.format === 'nav') {
    // epub:type is a namespaced EPUB navigation attribute.
    //noinspection HtmlUnknownAttribute
    zip.file(
      'nav.xhtml',
      `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="de" xml:lang="de">
        <body><nav epub:type="toc"><ol>
          <li><a href="chapter.xhtml">${navigation.label}</a></li>
        </ol></nav></body>
      </html>`,
    );
  } else if (navigation?.format === 'ncx') {
    zip.file(
      'toc.ncx',
      `<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
        <navMap><navPoint id="chapter" playOrder="1">
          <navLabel><text>${navigation.label}</text></navLabel>
          <content src="chapter.xhtml"/>
        </navPoint></navMap>
      </ncx>`,
    );
  }

  return buildReaderPackageFromEpub({
    authors: ['Example Author'],
    buffer: Buffer.from(await zip.generateAsync({ type: 'uint8array' })),
    checksum: 'entity-fixture-checksum',
    language: 'de',
    title: 'Example Book',
  });
}
