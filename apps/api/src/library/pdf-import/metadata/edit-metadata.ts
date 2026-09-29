import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import { ownedPdfImport } from '../operations/owned-import';
import { parsePdfMetadata } from './metadata-input';
import { pdfMetadataSelect } from './read-metadata';

export async function editPdfMetadata(
  prisma: PrismaService,
  userId: string,
  operationId: string,
  value: unknown,
) {
  const { expectedVersion, ...changes } = parsePdfMetadata(value);
  return prisma.$transaction(async (tx) => {
    const operation = await ownedPdfImport(tx, userId, operationId);
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${operation.libraryItemId}, 0))`,
    );
    await ownedPdfImport(tx, userId, operationId);
    const book = await tx.book.findUniqueOrThrow({
      where: { id: operation.bookId },
    });
    const result = await tx.book.updateMany({
      where: { id: book.id, metadataEditVersion: expectedVersion },
      data: {
        ...changes,
        metadataEditVersion: { increment: 1 },
        metadataUserFields: [
          ...new Set([...book.metadataUserFields, ...Object.keys(changes)]),
        ],
      },
    });
    if (!result.count)
      throw new ConflictException(
        'Book details changed; refresh before editing.',
      );
    const metadata = await tx.book.findUniqueOrThrow({
      where: { id: book.id },
      select: pdfMetadataSelect,
    });
    return { operationId, libraryItemId: operation.libraryItemId, ...metadata };
  });
}
