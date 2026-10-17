import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
export const CANONICAL_EPUB_PIPELINE = 'normalize-canonical-epub-v1';
export async function enqueueCanonicalEpub(
  tx: Prisma.TransactionClient,
  bookId: string,
  ownerId: string,
  libraryItemId: string,
) {
  const source = await tx.bookFile.findFirstOrThrow({
    where: { bookId, kind: 'SOURCE', format: 'EPUB', isPrimary: true },
  });
  return tx.bookProcessingRun.create({
    data: {
      bookId,
      sourceFileId: source.id,
      pipeline: CANONICAL_EPUB_PIPELINE,
      status: 'PENDING',
      canonicalContentId: `epub-import-${randomUUID()}`,
      canonicalOwnerId: ownerId,
      canonicalLibraryItemId: libraryItemId,
    },
  });
}
