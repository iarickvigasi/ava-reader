import type { Prisma } from '@prisma/client';
import type { MetadataClaim } from '../../pdf-conversion/contracts/generated/ava-book-2';
import { sourceDisplayMetadata } from '../../pdf-conversion/runtime/fill-reconstructed-metadata';
import { titleFromFilename } from '../../shared/blob-utils';
export async function fillImportedMetadata(
  tx: Prisma.TransactionClient,
  bookId: string,
  filename: string,
  claims: MetadataClaim[],
) {
  const book = await tx.book.findUniqueOrThrow({ where: { id: bookId } });
  const candidate = sourceDisplayMetadata(claims);
  const fill: { title?: string; authors?: string[]; language?: string } = {};
  if (
    candidate.title &&
    book.title === titleFromFilename(filename) &&
    candidate.title !== book.title
  )
    fill.title = candidate.title;
  if (candidate.authors && !book.authors.length)
    fill.authors = candidate.authors;
  if (candidate.language && !book.language) fill.language = candidate.language;
  for (const key of book.metadataUserFields)
    delete fill[key as keyof typeof fill];
  if (Object.keys(fill).length)
    await tx.book.updateMany({
      where: { id: bookId, metadataEditVersion: book.metadataEditVersion },
      data: { ...fill, metadataEditVersion: { increment: 1 } },
    });
}
