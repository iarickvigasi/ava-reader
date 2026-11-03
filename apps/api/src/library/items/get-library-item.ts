import type { PrismaService } from '../../prisma/prisma.service';
import { loadBookInfoItem } from './load-book-info-item';
import { loadBookReadingSnapshot } from './load-book-reading-snapshot';
import { serializeBookInfo } from './serialize-book-info';

// The book-info payload (docs/specs/3-library/3.2-book-info.md).
export async function getLibraryItem(options: {
  prisma: PrismaService;
  ref: string;
  userId: string;
}) {
  const item = await loadBookInfoItem(options);
  const readingSnapshot = await options.prisma.$transaction(
    (tx) => loadBookReadingSnapshot(tx, options.userId, item.id),
    { isolationLevel: 'RepeatableRead' },
  );
  return { book: serializeBookInfo(item, readingSnapshot) };
}
