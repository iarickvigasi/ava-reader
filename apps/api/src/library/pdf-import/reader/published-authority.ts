import { qualifiedPdfConsumer } from './consumer-qualification';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import { requireReaderQualification } from '../publication/qualification';
export async function publishedPdfAuthority(
  prisma: Pick<
    PrismaService,
    'pdfImportOperation' | 'libraryItem' | 'pdfReaderQualification'
  >,
  ownerId: string,
  operationId: string,
  schema: string,
  build: string,
) {
  const op = await prisma.pdfImportOperation.findFirst({
    where: { id: operationId, ownerId, deletedAt: null },
    include: { publication: true },
  });
  if (
    !op ||
    !(await prisma.libraryItem.findFirst({
      where: { id: op.libraryItemId, userId: ownerId, bookId: op.bookId },
    }))
  )
    throw new NotFoundException('Book not found.');
  const publication = op.publication;
  if (
    op.status !== 'READY' ||
    !publication ||
    publication.finalContentId !== op.finalContentId
  )
    throw new ConflictException({
      code: 'PDF_BOOK_NOT_READY',
      message: 'This book is not ready.',
    });
  const qualification = await requireReaderQualification(
    prisma,
    publication.qualificationId,
    [],
  );
  const consumerQualification = await qualifiedPdfConsumer(
    prisma,
    qualification,
    schema,
    build,
  );
  return { op, publication, qualification, consumerQualification };
}
