import { ConflictException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { requireReaderQualification } from '../pdf-import/publication/qualification';
import { qualifiedPdfConsumer } from '../pdf-import/reader/consumer-qualification';
export type EpubAuthorityStore = Pick<
  PrismaService,
  | 'canonicalEpubImport'
  | 'libraryItem'
  | 'pdfReaderQualification'
  | 'pdfImportOperation'
>;
export async function importedEpubAuthority(
  prisma: EpubAuthorityStore,
  ownerId: string,
  importId: string,
  schema: string,
  build: string,
) {
  const record = await prisma.canonicalEpubImport.findFirst({
    where: { id: importId, ownerId },
    include: { acceptance: true },
  });
  if (
    !record ||
    !(await prisma.libraryItem.findFirst({
      where: {
        id: record.libraryItemId,
        userId: ownerId,
        bookId: record.bookId,
      },
    }))
  )
    throw new NotFoundException('Book not found.');
  if (!record.acceptance)
    throw new ConflictException({
      code: 'EPUB_BOOK_NOT_READY',
      message: 'This book is being prepared.',
    });
  const qualification = await requireReaderQualification(
    prisma,
    record.acceptance.qualificationId,
    [],
  );
  const consumerQualification = await qualifiedPdfConsumer(
    prisma,
    qualification,
    schema,
    build,
  );
  return { record, qualification, consumerQualification };
}
