import JSZip from 'jszip';
import { BookFileFormat } from '@prisma/client';
import { extractBookMetadata } from './metadata-extractor';

describe('extractBookMetadata', () => {
  it('extracts EPUB metadata and embedded cover images', async () => {
    const epubBuffer = await createEpubBuffer({
      coverBytes: Buffer.from('fake-image-bits'),
      coverHref: 'images/cover.jpg',
    });

    const metadata = await extractBookMetadata({
      buffer: epubBuffer,
      mimetype: 'application/epub+zip',
      originalname: 'example.epub',
    });

    expect(metadata.format).toBe(BookFileFormat.EPUB);
    expect(metadata.title).toBe('Example Title');
    expect(metadata.author).toBe('Example Author');
    expect(metadata.description).toBe('Example Description');
    expect(metadata.language).toBe('en');
    expect(metadata.publishedYear).toBe(2024);
    expect(metadata.coverImage).toEqual({
      bytes: Buffer.from('fake-image-bits'),
      mimeType: 'image/jpeg',
      originalFilename: 'cover.jpg',
    });
  });

  it('returns null coverImage when the EPUB has no embedded cover', async () => {
    const epubBuffer = await createEpubBuffer({});

    const metadata = await extractBookMetadata({
      buffer: epubBuffer,
      mimetype: 'application/epub+zip',
      originalname: 'example.epub',
    });

    expect(metadata.coverImage).toBeNull();
  });
});

async function createEpubBuffer(input: {
  coverBytes?: Buffer;
  coverHref?: string;
}) {
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

  const coverManifestItem =
    input.coverBytes && input.coverHref
      ? `<item id="cover-image" href="${input.coverHref}" media-type="image/jpeg"/>`
      : '';
  const coverMeta =
    input.coverBytes && input.coverHref
      ? '<meta name="cover" content="cover-image"/>'
      : '';

  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0">
  <metadata>
    <dc:title>Example Title</dc:title>
    <dc:creator>Example Author</dc:creator>
    <dc:description>Example Description</dc:description>
    <dc:language>en</dc:language>
    <dc:date>2024-01-15</dc:date>
    ${coverMeta}
  </metadata>
  <manifest>
    ${coverManifestItem}
  </manifest>
</package>`,
  );

  if (input.coverBytes && input.coverHref) {
    zip.file(`OEBPS/${input.coverHref}`, input.coverBytes);
  }

  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
}
