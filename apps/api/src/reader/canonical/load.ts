import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { OwnedLibraryItem } from '../library-item-access';
import { loadImportedEpubReader } from '../../library/epub-import/load-imported-reader';
import { loadAcceptedPdfReader } from '../../library/pdf-import/reader/load-published-reader';
import { readerSemanticValidator, type ReaderCapability } from './semantic';
export async function loadCanonicalReader(
  prisma: PrismaService,
  item: OwnedLibraryItem,
  capability: ReaderCapability,
) {
  try {
    const pdf = await loadAcceptedPdfReader(
      prisma,
      { ownerId: item.userId, libraryItemId: item.id, ...capability },
      readerSemanticValidator,
    );
    if (pdf) return pdf as PdfAcceptedReader;
    return await loadImportedEpubReader(
      prisma,
      { ownerId: item.userId, libraryItemId: item.id, ...capability },
      readerSemanticValidator,
    );
  } catch (error) {
    if (error instanceof HttpException) throw error;
    throw new ServiceUnavailableException(
      'Accepted reader content is unavailable.',
    );
  }
}
export type PdfAcceptedReader = NonNullable<
  Awaited<ReturnType<typeof loadAcceptedPdfReader>>
> & { kind?: 'pdf-import' };
export type AcceptedReader = NonNullable<
  Awaited<ReturnType<typeof loadCanonicalReader>>
>;
