import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import { ownedPdfImport } from '../operations/owned-import';

export async function getPdfCover(
  prisma: PrismaService,
  userId: string,
  operationId: string,
) {
  const operation = await ownedPdfImport(prisma, userId, operationId);
  const book = await prisma.book.findUniqueOrThrow({
    where: { id: operation.bookId },
    select: { coverBlobId: true },
  });
  if (!book.coverBlobId) throw new NotFoundException('Cover not found.');
  const artifact = await prisma.pdfArtifact.findFirst({
    where: {
      operationId,
      ownerId: userId,
      role: 'COVER',
      blobId: book.coverBlobId,
      mimeType: { in: ['image/png', 'image/jpeg'] },
    },
    include: { blob: true },
  });
  if (!artifact) throw new NotFoundException('Cover not found.');
  await ownedPdfImport(prisma, userId, operationId);
  return artifact.blob;
}
