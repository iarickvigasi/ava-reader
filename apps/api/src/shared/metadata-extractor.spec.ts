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
    expect(metadata.authors).toEqual(['Example Author']);
    expect(metadata.description).toBe('Example Description');
    expect(metadata.genres).toEqual([]);
    expect(metadata.language).toBe('en');
    expect(metadata.publishedYear).toBe(2024);
    expect(metadata.coverImage).toEqual({
      bytes: Buffer.from('fake-image-bits'),
      mimeType: 'image/jpeg',
      originalFilename: 'cover.jpg',
    });
  });

  it('decodes numeric character references in EPUB metadata', async () => {
    const epubBuffer = await createEpubBuffer({
      title: 'It&#8217;s &#x201C;Fine&#x201D;',
    });

    const metadata = await extractBookMetadata({
      buffer: epubBuffer,
      mimetype: 'application/epub+zip',
      originalname: 'example.epub',
    });

    expect(metadata.title).toBe('It’s “Fine”');
  });

  it('extracts EPUB subjects as normalized, deduplicated genres', async () => {
    const epubBuffer = await createEpubBuffer({
      dcSubjects: ['Science Fiction', ' Gothic ', 'Science Fiction'],
      subjects: ['Classic', 'Gothic'],
    });

    const metadata = await extractBookMetadata({
      buffer: epubBuffer,
      mimetype: 'application/epub+zip',
      originalname: 'example.epub',
    });

    expect(metadata.genres).toEqual(['Science Fiction', 'Gothic', 'Classic']);
  });

  it('splits subject chains and keeps only unique genre tokens', async () => {
    const epubBuffer = await createEpubBuffer({
      dcSubjects: [
        'Novelists, English -- 19th century -- Correspondence',
        'Austen, Jane, 1775-1817 -- Correspondence',
        'Management - General',
        'Self-Help',
        'Personal Growth - Success',
      ],
      subjects: ['Management', 'Business & Economics'],
    });

    const metadata = await extractBookMetadata({
      buffer: epubBuffer,
      mimetype: 'application/epub+zip',
      originalname: 'example.epub',
    });

    expect(metadata.genres).toEqual([
      'Novelists, English',
      '19th century',
      'Correspondence',
      'Austen, Jane, 1775-1817',
      'Management',
      'General',
      'Self-Help',
      'Personal Growth',
      'Success',
      'Business & Economics',
    ]);
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

  it('prefers creators with author roles and deduplicates names', async () => {
    const epubBuffer = await createEpubBuffer({
      creators: [
        {
          name: 'Editor Name',
          role: 'edt',
        },
        {
          name: 'Jason Fried',
          role: 'aut',
        },
        {
          name: 'David Heinemeier Hansson',
          role: 'AUT',
        },
        {
          name: 'jason fried',
          role: 'aut',
        },
      ],
    });

    const metadata = await extractBookMetadata({
      buffer: epubBuffer,
      mimetype: 'application/epub+zip',
      originalname: 'example.epub',
    });

    expect(metadata.authors).toEqual([
      'Jason Fried',
      'David Heinemeier Hansson',
    ]);
  });

  it('falls back to all creators when no author role exists', async () => {
    const epubBuffer = await createEpubBuffer({
      creators: [
        {
          name: 'Creator One',
        },
        {
          name: 'Creator Two',
          role: 'trl',
        },
      ],
    });

    const metadata = await extractBookMetadata({
      buffer: epubBuffer,
      mimetype: 'application/epub+zip',
      originalname: 'example.epub',
    });

    expect(metadata.authors).toEqual(['Creator One', 'Creator Two']);
  });
});

async function createEpubBuffer(input: {
  coverBytes?: Buffer;
  coverHref?: string;
  creators?: Array<{ name: string; role?: string }>;
  dcSubjects?: string[];
  subjects?: string[];
  title?: string;
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
  const dcSubjectTags =
    input.dcSubjects
      ?.map((subject) => `<dc:subject>${subject}</dc:subject>`)
      .join('\n    ') ?? '';
  const subjectTags =
    input.subjects
      ?.map((subject) => `<subject>${subject}</subject>`)
      .join('\n    ') ?? '';
  const creatorTags =
    input.creators
      ?.map((creator) => {
        const roleAttribute = creator.role ? ` opf:role="${creator.role}"` : '';
        return `<dc:creator${roleAttribute}>${creator.name}</dc:creator>`;
      })
      .join('\n    ') ?? '<dc:creator>Example Author</dc:creator>';

  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf" version="2.0">
  <metadata>
    <dc:title>${input.title ?? 'Example Title'}</dc:title>
    ${creatorTags}
    <dc:description>Example Description</dc:description>
    <dc:language>en</dc:language>
    <dc:date>2024-01-15</dc:date>
    ${dcSubjectTags}
    ${subjectTags}
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
