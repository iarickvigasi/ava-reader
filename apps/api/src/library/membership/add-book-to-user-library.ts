import {
  BookFileFormat,
  type LibrarySource,
  type Prisma,
} from '@prisma/client';
import { findPrimarySourceFile } from '../../shared/primary-book-file';
import { createLibraryItemTx } from './create-library-item';
import { ensureCollectionMembershipTx } from './ensure-collection-membership';
import { ensureDefaultCollectionsTx } from './ensure-default-collections';

export type LibraryMutationPayload = {
  addedAt: string;
  book: {
    authors: string[];
    format: BookFileFormat;
    id: string;
    title: string;
  };
  libraryItemId: string;
  slug: string;
  source: LibrarySource;
  state: 'added' | 'existing';
};

// The shared add-to-library core behind import and catalog adds: idempotent
// per user+book (docs/specs/3-library/3.4-import.md §5).
export async function addBookToUserLibraryTx(
  tx: Prisma.TransactionClient,
  input: {
    bookId: string;
    originCatalogEntryId?: string;
    source: LibrarySource;
    userId: string;
  },
): Promise<LibraryMutationPayload> {
  await ensureDefaultCollectionsTx(tx, input.userId);

  const existing = await tx.libraryItem.findUnique({
    where: {
      userId_bookId: {
        userId: input.userId,
        bookId: input.bookId,
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

  const libraryItem = existing ?? (await createLibraryItemTx(tx, input));

  if (
    existing &&
    input.originCatalogEntryId &&
    !existing.originCatalogEntryId
  ) {
    await tx.libraryItem.update({
      where: { id: existing.id },
      data: {
        originCatalogEntryId: input.originCatalogEntryId,
      },
    });
  }

  if (!libraryItem.progress) {
    await tx.readingProgress.create({
      data: {
        libraryItemId: libraryItem.id,
        userId: input.userId,
      },
    });
  }

  await ensureCollectionMembershipTx(tx, {
    libraryItemId: libraryItem.id,
    source: input.source,
    userId: input.userId,
  });

  const primaryFile = findPrimarySourceFile(libraryItem.book.files);

  return {
    addedAt: libraryItem.addedAt.toISOString(),
    book: {
      authors: libraryItem.book.authors,
      format: primaryFile?.format ?? BookFileFormat.UNKNOWN,
      id: libraryItem.book.id,
      title: libraryItem.book.title,
    },
    libraryItemId: libraryItem.id,
    slug: libraryItem.slug,
    source: input.source,
    state: existing ? 'existing' : 'added',
  };
}
