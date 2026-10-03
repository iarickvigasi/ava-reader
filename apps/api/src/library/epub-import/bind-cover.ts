import type { Prisma } from '@prisma/client';
import type { CanonicalBookV2 } from '../../pdf-conversion/contracts/generated/ava-book-2';
export async function bindImportedCover(
  tx: Prisma.TransactionClient,
  bookId: string,
  book: CanonicalBookV2,
  resources: Map<string, string>,
) {
  if (!book.cover_resource_id) return;
  const cover = book.resources.find((r) => r.id === book.cover_resource_id);
  const blobId = cover && resources.get(cover.sha256);
  if (
    !cover ||
    !blobId ||
    !['image/png', 'image/jpeg'].includes(cover.media_type)
  )
    throw new Error('EPUB_COVER_BINDING_INVALID');
  const updated = await tx.book.updateMany({
    where: { id: bookId, canonicalImportPrivate: true },
    data: { coverBlobId: blobId },
  });
  if (updated.count !== 1) throw new Error('EPUB_COVER_BINDING_INVALID');
}
