import type { PrismaService } from '../prisma/prisma.service';
import { readCurrentReadingBook } from './read-current-reading-book';

// This projection is the directory privacy boundary. Never serialize a User row.
export async function readPublishedReaders(prisma: PrismaService) {
  const readers = await prisma.user.findMany({
    where: { profilePublished: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      displayName: true,
      displayNameOverride: true,
      avatarUrl: true,
      introduction: true,
      shareCurrentBook: true,
    },
  });
  return Promise.all(
    readers.map(async (reader) => {
      const book = reader.shareCurrentBook
        ? await readCurrentReadingBook(prisma, reader.id)
        : null;
      return {
        id: reader.id,
        displayName: reader.displayNameOverride ?? reader.displayName,
        avatarUrl: reader.avatarUrl,
        introduction: reader.introduction ?? '',
        currentBook: book ? { title: book.title, authors: book.authors } : null,
      };
    }),
  );
}
