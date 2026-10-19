import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

export async function ownedPdfImport(
  prisma: Prisma.TransactionClient,
  userId: string,
  operationId: string,
) {
  const operation = await prisma.pdfImportOperation.findFirst({
    where: { id: operationId, ownerId: userId, deletedAt: null },
  });
  if (
    !operation ||
    !(await prisma.libraryItem.findFirst({
      where: {
        id: operation.libraryItemId,
        userId,
        bookId: operation.bookId,
      },
      select: { id: true },
    }))
  )
    throw new NotFoundException('Import not found.');
  return operation;
}
