import type { LibrarySource, Prisma } from '@prisma/client';
import { buildBookSlugBase } from '../../shared/book-slug';
import { resolveUniqueSlug } from '../../shared/slugify';

// Creates the LibraryItem with a unique per-user slug built from
// title+authors, and its zeroed ReadingProgress row.
export async function createLibraryItemTx(
  tx: Prisma.TransactionClient,
  input: {
    bookId: string;
    originCatalogEntryId?: string;
    source: LibrarySource;
    userId: string;
  },
) {
  const book = await tx.book.findUniqueOrThrow({
    where: { id: input.bookId },
    select: { title: true, authors: true },
  });
  const baseSlug = buildBookSlugBase({
    title: book.title,
    authors: book.authors,
  });
  const slug = await resolveUniqueSlug(baseSlug, async (candidate) => {
    const conflict = await tx.libraryItem.findUnique({
      where: {
        userId_slug: { userId: input.userId, slug: candidate },
      },
      select: { id: true },
    });
    return conflict !== null;
  });

  return tx.libraryItem.create({
    data: {
      userId: input.userId,
      bookId: input.bookId,
      slug,
      source: input.source,
      originCatalogEntryId: input.originCatalogEntryId,
      progress: {
        create: {
          userId: input.userId,
        },
      },
    },
    include: {
      book: {
        include: {
          files: true,
        },
      },
      progress: true,
    },
  });
}
