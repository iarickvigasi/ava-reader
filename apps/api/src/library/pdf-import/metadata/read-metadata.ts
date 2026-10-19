import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import { ownedPdfImport } from '../operations/owned-import';

export const pdfMetadataSelect = {
  title: true,
  authors: true,
  language: true,
  metadataEditVersion: true,
} satisfies Prisma.BookSelect;

export async function readPdfMetadata(
  prisma: PrismaService,
  userId: string,
  operationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const operation = await ownedPdfImport(tx, userId, operationId);
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${operation.libraryItemId}, 0))`,
    );
    await ownedPdfImport(tx, userId, operationId);
    const metadata = await tx.book.findUniqueOrThrow({
      where: { id: operation.bookId },
      select: pdfMetadataSelect,
    });
    return { operationId, libraryItemId: operation.libraryItemId, ...metadata };
  });
}
