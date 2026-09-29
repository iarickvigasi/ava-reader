import type { Prisma } from '@prisma/client';
import type { CanonicalBookV2 } from '../../pdf-conversion/contracts/generated/ava-book-2';
import { validatedEpubLanguage } from './package-language';
import { sourceDisplayMetadata } from '../../pdf-conversion/runtime/fill-reconstructed-metadata';
import { titleFromFilename } from '../../shared/blob-utils';
export async function fillImportedMetadata(
  tx: Prisma.TransactionClient,
  bookId: string,
  filename: string,
  canonical: Pick<CanonicalBookV2, 'metadata' | 'profile_id'>,
) {
  const book = await tx.book.findUniqueOrThrow({ where: { id: bookId } });
  const candidate = sourceDisplayMetadata(canonical.metadata);
  const language = validatedEpubLanguage(canonical);
  const fill: { title?: string; authors?: string[]; language?: string } = {};
  if (
    candidate.title &&
    book.title === titleFromFilename(filename) &&
    candidate.title !== book.title
  )
    fill.title = candidate.title;
  if (candidate.authors && !book.authors.length)
    fill.authors = candidate.authors;
  if (!book.language) fill.language = language;
  for (const key of book.metadataUserFields)
    delete fill[key as keyof typeof fill];
  if (Object.keys(fill).length)
    await tx.book.updateMany({
      where: { id: bookId, metadataEditVersion: book.metadataEditVersion },
      data: { ...fill, metadataEditVersion: { increment: 1 } },
    });
}
