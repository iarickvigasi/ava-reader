import { Buffer } from 'buffer';
import {
  BlobPurpose,
  BookFileFormat,
  BookFileKind,
  CatalogStatus,
  CollectionKind,
  LibrarySource,
  PrismaClient,
  ProcessingStatus,
} from '@prisma/client';
import { checksumBuffer, toPrismaBytes } from '../shared/blob-utils';

const prisma = new PrismaClient();

async function main() {
  const identifier = process.argv[2]?.trim();

  if (!identifier) {
    throw new Error(
      'Usage: pnpm --filter api db:seed:home-demo <primary-email-or-clerk-user-id>',
    );
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ clerkUserId: identifier }, { primaryEmail: identifier }],
    },
  });

  if (!user) {
    throw new Error(
      `No local user was found for "${identifier}". Sign in once first so /api/me can create the row.`,
    );
  }

  const architecture = await ensureBook({
    author: 'Alain de Botton',
    description:
      'A demo seed title used to verify the real populated dashboard state.',
    sourceFormat: BookFileFormat.PDF,
    sourceName: 'the-architecture-of-happiness.pdf',
    sourceText: 'Demo PDF content',
    title: 'The Architecture of Happiness',
  });

  const meditations = await ensureBook({
    author: 'Marcus Aurelius',
    description: 'Stoic reflections for the public catalog seed.',
    sourceFormat: BookFileFormat.EPUB,
    sourceName: 'meditations.epub',
    sourceText: 'Demo EPUB content',
    title: 'Meditations',
  });

  const frankenstein = await ensureBook({
    author: 'Mary Shelley',
    description: 'A public-domain gothic novel for catalog testing.',
    sourceFormat: BookFileFormat.EPUB,
    sourceName: 'frankenstein.epub',
    sourceText: 'Demo EPUB content',
    title: 'Frankenstein',
  });

  const meditationsCatalog = await prisma.catalogEntry.upsert({
    where: { bookId: meditations.id },
    update: {
      editorialDescription:
        'Stoic reflections and self-discipline for slow, immersive reading.',
      editorialTitle: 'Meditations',
      isFeatured: true,
      sortOrder: 10,
      status: CatalogStatus.PUBLISHED,
    },
    create: {
      bookId: meditations.id,
      editorialDescription:
        'Stoic reflections and self-discipline for slow, immersive reading.',
      editorialTitle: 'Meditations',
      isFeatured: true,
      sortOrder: 10,
      status: CatalogStatus.PUBLISHED,
    },
  });

  const frankensteinCatalog = await prisma.catalogEntry.upsert({
    where: { bookId: frankenstein.id },
    update: {
      editorialDescription:
        'Science, obsession, and consequence in one of literature’s great cautionary tales.',
      editorialTitle: 'Frankenstein',
      isFeatured: true,
      sortOrder: 20,
      status: CatalogStatus.PUBLISHED,
    },
    create: {
      bookId: frankenstein.id,
      editorialDescription:
        'Science, obsession, and consequence in one of literature’s great cautionary tales.',
      editorialTitle: 'Frankenstein',
      isFeatured: true,
      sortOrder: 20,
      status: CatalogStatus.PUBLISHED,
    },
  });

  const currentItem = await ensureLibraryItem({
    bookId: architecture.id,
    source: LibrarySource.IMPORTED,
    userId: user.id,
  });
  const stoicItem = await ensureLibraryItem({
    bookId: meditations.id,
    originCatalogEntryId: meditationsCatalog.id,
    source: LibrarySource.CATALOG,
    userId: user.id,
  });
  const classicItem = await ensureLibraryItem({
    bookId: frankenstein.id,
    originCatalogEntryId: frankensteinCatalog.id,
    source: LibrarySource.CATALOG,
    userId: user.id,
  });

  await prisma.readingProgress.upsert({
    where: { libraryItemId: currentItem.id },
    update: {
      chapterLabel: 'Chapter 4: The Virtues of Buildings',
      completionPercent: 65,
      lastReadAt: new Date(),
      minutesRead: 186,
    },
    create: {
      userId: user.id,
      libraryItemId: currentItem.id,
      chapterLabel: 'Chapter 4: The Virtues of Buildings',
      completionPercent: 65,
      lastReadAt: new Date(),
      minutesRead: 186,
    },
  });

  await prisma.readingProgress.upsert({
    where: { libraryItemId: stoicItem.id },
    update: {
      chapterLabel: 'Book VII',
      completionPercent: 100,
      lastReadAt: daysAgo(4),
      minutesRead: 120,
    },
    create: {
      userId: user.id,
      libraryItemId: stoicItem.id,
      chapterLabel: 'Book VII',
      completionPercent: 100,
      lastReadAt: daysAgo(4),
      minutesRead: 120,
    },
  });

  await prisma.readingProgress.upsert({
    where: { libraryItemId: classicItem.id },
    update: {
      chapterLabel: 'Letter 2',
      completionPercent: 24,
      lastReadAt: daysAgo(2),
      minutesRead: 54,
    },
    create: {
      userId: user.id,
      libraryItemId: classicItem.id,
      chapterLabel: 'Letter 2',
      completionPercent: 24,
      lastReadAt: daysAgo(2),
      minutesRead: 54,
    },
  });

  await prisma.readingSession.deleteMany({
    where: {
      userId: user.id,
      libraryItemId: {
        in: [currentItem.id, stoicItem.id, classicItem.id],
      },
    },
  });

  const dailyMinutes = [30, 20, 40, 28, 36, 15, 45];
  await prisma.readingSession.createMany({
    data: dailyMinutes.map((durationMinutes, index) => {
      const trackedDay = startOfDay(daysAgo(6 - index));
      return {
        userId: user.id,
        libraryItemId: index % 2 === 0 ? currentItem.id : stoicItem.id,
        trackedDay,
        durationMinutes,
        startedAt: trackedDay,
        endedAt: new Date(trackedDay.getTime() + durationMinutes * 60_000),
      };
    }),
  });

  await prisma.annotation.deleteMany({
    where: {
      userId: user.id,
      libraryItemId: {
        in: [currentItem.id, stoicItem.id, classicItem.id],
      },
    },
  });

  await prisma.annotation.createMany({
    data: [
      {
        userId: user.id,
        libraryItemId: currentItem.id,
        excerpt:
          'Good buildings give us the chance to experience a version of ourselves that feels more composed and coherent.',
        highlightColor: 'Archival Yellow',
      },
      {
        userId: user.id,
        libraryItemId: stoicItem.id,
        excerpt:
          'The happiness of your life depends upon the quality of your thoughts.',
        highlightColor: 'Desert Gold',
      },
      {
        userId: user.id,
        libraryItemId: classicItem.id,
        excerpt: 'Beware; for I am fearless, and therefore powerful.',
        highlightColor: 'Evening Amber',
      },
    ],
  });

  const philosophyCollection = await prisma.collection.upsert({
    where: {
      userId_name: {
        userId: user.id,
        name: 'Philosophy Stack',
      },
    },
    update: {
      description: 'Books for slow thought and clear attention.',
      kind: CollectionKind.CUSTOM,
      sortOrder: 10,
    },
    create: {
      userId: user.id,
      name: 'Philosophy Stack',
      description: 'Books for slow thought and clear attention.',
      kind: CollectionKind.CUSTOM,
      sortOrder: 10,
    },
  });

  const lateNightCollection = await prisma.collection.upsert({
    where: {
      userId_name: {
        userId: user.id,
        name: 'Late Night Fiction',
      },
    },
    update: {
      description: 'A darker shelf for evening reading.',
      kind: CollectionKind.CUSTOM,
      sortOrder: 20,
    },
    create: {
      userId: user.id,
      name: 'Late Night Fiction',
      description: 'A darker shelf for evening reading.',
      kind: CollectionKind.CUSTOM,
      sortOrder: 20,
    },
  });

  await ensureCollectionMembership(philosophyCollection.id, currentItem.id);
  await ensureCollectionMembership(philosophyCollection.id, stoicItem.id);
  await ensureCollectionMembership(lateNightCollection.id, classicItem.id);

  console.log(
    `Seeded demo home data for ${user.primaryEmail} (${user.clerkUserId}).`,
  );
}

async function ensureBook(input: {
  author: string;
  description: string;
  sourceFormat: BookFileFormat;
  sourceName: string;
  sourceText: string;
  title: string;
}) {
  const existing = await prisma.book.findFirst({
    where: {
      title: input.title,
      author: input.author,
    },
  });

  if (existing) {
    return existing;
  }

  const coverSvg = createCoverSvg(input.title, input.author);
  const coverBuffer = Buffer.from(coverSvg, 'utf8');
  const sourceBuffer = Buffer.from(input.sourceText, 'utf8');

  const coverBlob = await prisma.storedBlob.create({
    data: {
      purpose: BlobPurpose.BOOK_COVER,
      mimeType: 'image/svg+xml',
      sizeBytes: coverBuffer.byteLength,
      originalFilename: `${slugify(input.title)}.svg`,
      checksum: checksumBuffer(coverBuffer),
      bytes: toPrismaBytes(coverBuffer),
    },
  });

  const sourceBlob = await prisma.storedBlob.create({
    data: {
      purpose: BlobPurpose.BOOK_SOURCE,
      mimeType:
        input.sourceFormat === BookFileFormat.PDF
          ? 'application/pdf'
          : 'application/epub+zip',
      sizeBytes: sourceBuffer.byteLength,
      originalFilename: input.sourceName,
      checksum: checksumBuffer(sourceBuffer),
      bytes: toPrismaBytes(sourceBuffer),
    },
  });

  return prisma.book.create({
    data: {
      title: input.title,
      author: input.author,
      description: input.description,
      coverBlobId: coverBlob.id,
      files: {
        create: {
          blobId: sourceBlob.id,
          format: input.sourceFormat,
          kind: BookFileKind.SOURCE,
          processingStatus: ProcessingStatus.READY,
          isPrimary: true,
        },
      },
      processingRuns:
        input.sourceFormat === BookFileFormat.EPUB
          ? {
              create: {
                pipeline: 'normalize-reader-package-v1',
                status: ProcessingStatus.PENDING,
              },
            }
          : undefined,
    },
  });
}

async function ensureLibraryItem(input: {
  bookId: string;
  originCatalogEntryId?: string;
  source: LibrarySource;
  userId: string;
}) {
  const existing = await prisma.libraryItem.findUnique({
    where: {
      userId_bookId: {
        userId: input.userId,
        bookId: input.bookId,
      },
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.libraryItem.create({
    data: {
      userId: input.userId,
      bookId: input.bookId,
      source: input.source,
      originCatalogEntryId: input.originCatalogEntryId,
    },
  });
}

async function ensureCollectionMembership(
  collectionId: string,
  libraryItemId: string,
) {
  await prisma.collectionItem.upsert({
    where: {
      collectionId_libraryItemId: {
        collectionId,
        libraryItemId,
      },
    },
    update: {},
    create: {
      collectionId,
      libraryItemId,
    },
  });
}

function createCoverSvg(title: string, author: string) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#f0e4d5" />
          <stop offset="100%" stop-color="#d8c8b8" />
        </linearGradient>
      </defs>
      <rect width="720" height="960" fill="url(#bg)" />
      <rect x="54" y="54" width="612" height="852" fill="none" stroke="#264b5f" stroke-opacity="0.14" />
      <text x="72" y="140" font-family="Georgia, serif" font-size="28" fill="#655f37" letter-spacing="6">AVA READER</text>
      <text x="72" y="510" font-family="Georgia, serif" font-size="72" fill="#264b5f">${escapeXml(title)}</text>
      <text x="72" y="580" font-family="Arial, sans-serif" font-size="28" fill="#6e5678" letter-spacing="4">${escapeXml(author.toUpperCase())}</text>
    </svg>
  `;
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function startOfDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
