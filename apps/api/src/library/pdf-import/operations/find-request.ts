import { GoneException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import { ownedPdfImport } from './owned-import';
import { pdfLibrarySummary } from './library-summary';

export async function findPdfRequest(
  prisma: PrismaService,
  userId: string,
  requestKey: string,
) {
  const operation = await prisma.pdfImportOperation.findUnique({
    where: {
      ownerId_idempotencyKey: { ownerId: userId, idempotencyKey: requestKey },
    },
  });
  if (!operation) throw new NotFoundException('Import not found.');
  if (operation.deletedAt) throw new GoneException('This import was deleted.');
  return pdfLibrarySummary(await ownedPdfImport(prisma, userId, operation.id));
}
