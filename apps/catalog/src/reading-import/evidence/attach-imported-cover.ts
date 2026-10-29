import type { Prisma } from '#catalog-client';
export async function attachImportedCover(
  db: Prisma.TransactionClient,
  editionId: string,
  blobId?: string | null,
) {
  if (!blobId) return;
  const blob = await db.publicBlob.findFirst({
    where: {
      id: blobId,
      purpose: 'BOOK_COVER',
      mimeType: { in: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
    },
    select: { id: true },
  });
  if (!blob) throw new Error('Imported cover is not a Catalog image cover');
  await db.edition.updateMany({
    where: { id: editionId, coverImageUrl: null },
    data: { coverImageUrl: `/catalog/api/edition-covers/${blob.id}` },
  });
}
